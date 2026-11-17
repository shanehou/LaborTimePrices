// HTTP API for the labor-hours site.
//
//   GET /api/health
//   GET /api/catalog
//   GET /api/fx
//   GET /api/search?q=<term>
//   GET /api/city/:id
//
// A cold city costs exactly two Numbeo requests; everything else is served
// from KV. See numbeo.js for the scraper and cache.js for the cache layout.

import { CATALOG } from "./catalog.js"
import {
  acquireRefreshLock,
  checkScrapeRateLimit,
  checkSearchRateLimit,
  cityKey,
  FRESH_MS,
  readJSON,
  searchKey,
  SEARCH_TTL_SECONDS,
  STALE_MS,
  CITY_TTL_SECONDS,
  writeJSON,
} from "./cache.js"
import { ApiError, errorResponse, jsonResponse } from "./errors.js"
import { fetchFrankfurterRates, FX_KEY, FX_TTL_SECONDS, readFxTable } from "./fx.js"
import {
  canonicalizePrices,
  isValidCityId,
  scrapeCity,
  searchCities,
  validateCityRecord,
} from "./numbeo.js"

const CATALOG_CACHE_CONTROL = "public, max-age=86400"
const CITY_CACHE_CONTROL = "public, max-age=300"
const SEARCH_CACHE_CONTROL = "public, max-age=86400"
const FX_CACHE_CONTROL = "public, max-age=3600"
const RATE_LIMIT_RETRY_AFTER = "60"

export default {
  async fetch(request, env, context) {
    try {
      return await route(request, env, context)
    } catch (error) {
      if (error instanceof ApiError) {
        return errorResponse(error.code, error.message, error.status)
      }
      return errorResponse("internal_error", "Unexpected server error", 500)
    }
  },
}

async function route(request, env, context) {
  const url = new URL(request.url)

  if (request.method !== "GET") {
    return errorResponse("not_found", "Not found", 404)
  }

  if (url.pathname === "/api/health") {
    return jsonResponse({ ok: true })
  }

  if (url.pathname === "/api/catalog") {
    return handleCatalog()
  }

  if (url.pathname === "/api/fx") {
    return handleFx(env)
  }

  if (url.pathname === "/api/search") {
    return handleSearch(request, url, env)
  }

  const cityMatch = url.pathname.match(/^\/api\/city\/([^/]+)$/)
  if (cityMatch) {
    return handleCity(request, cityMatch[1], env, context)
  }

  return errorResponse("not_found", "Not found", 404)
}

function handleCatalog() {
  const cities = Array.isArray(CATALOG)
    ? CATALOG.map((entry) => ({
        id: String(entry?.id ?? ""),
        name: String(entry?.name ?? ""),
        country: String(entry?.country ?? ""),
      }))
    : []
  return jsonResponse(
    { cities, count: cities.length },
    { cacheControl: CATALOG_CACHE_CONTROL },
  )
}

function clientIp(request) {
  return request.headers.get("cf-connecting-ip") || "unknown"
}

function rateLimitedResponse(message = "Rate limit exceeded") {
  const response = errorResponse("rate_limited", message, 429)
  response.headers.set("retry-after", RATE_LIMIT_RETRY_AFTER)
  return response
}

async function handleFx(env) {
  const kv = env.CITY_CACHE
  const cached = readFxTable(await readJSON(kv, FX_KEY))
  if (cached) {
    return jsonResponse(cached, { cacheControl: FX_CACHE_CONTROL })
  }
  try {
    const fresh = await fetchFrankfurterRates()
    await writeJSON(kv, FX_KEY, fresh, { expirationTtl: FX_TTL_SECONDS })
    return jsonResponse(fresh, { cacheControl: FX_CACHE_CONTROL })
  } catch (error) {
    const apiError =
      error instanceof ApiError
        ? error
        : new ApiError("upstream_unavailable", "Exchange rates are unavailable", 502)
    return errorResponse(apiError.code, apiError.message, apiError.status)
  }
}

async function handleSearch(request, url, env) {
  const query = (url.searchParams.get("q") ?? "").trim()
  if (query.length < 1 || query.length > 64) {
    throw new ApiError("bad_request", "Query parameter q must be 1-64 characters", 400)
  }

  const kv = env.CITY_CACHE
  if (await checkSearchRateLimit(kv, clientIp(request))) {
    return rateLimitedResponse("Too many searches, try again later")
  }

  const cached = await readJSON(kv, searchKey(query))
  if (Array.isArray(cached)) {
    return jsonResponse(
      { query, results: cached },
      { cacheControl: SEARCH_CACHE_CONTROL },
    )
  }

  const results = await searchCities(query)
  await writeJSON(kv, searchKey(query), results, {
    expirationTtl: SEARCH_TTL_SECONDS,
  })
  return jsonResponse(
    { query, results },
    { cacheControl: SEARCH_CACHE_CONTROL },
  )
}

function readStoredCity(stored) {
  if (!stored || typeof stored !== "object") return null
  if (stored.v !== 1) return null
  if (!stored.city || !validateCityRecord(stored.city)) return null
  const scrapedAt =
    typeof stored.scraped_at === "string" ? stored.scraped_at : stored.city.scraped_at
  if (typeof scrapedAt !== "string") return null
  return {
    city: { ...stored.city, prices: canonicalizePrices(stored.city.prices) },
    scraped_at: scrapedAt,
  }
}

function cityEnvelope(record) {
  return {
    v: 1,
    city: record,
    scraped_at: record.scraped_at,
    source_url: record.source_url,
  }
}

async function refreshCity(env, id) {
  try {
    const record = await scrapeCity(id)
    if (!validateCityRecord(record)) {
      throw new ApiError("parse_failed", "Scraped city record failed validation", 502)
    }
    await writeJSON(env.CITY_CACHE, cityKey(id), cityEnvelope(record), {
      expirationTtl: CITY_TTL_SECONDS,
    })
  } catch {
    // Keep serving the stale entry; the next request may retry.
  }
}

async function scheduleRefresh(env, context, id) {
  try {
    if (!(await acquireRefreshLock(env.CITY_CACHE, id))) return
  } catch {
    // A failed lock write must not break serving the stale record.
    return
  }
  const task = refreshCity(env, id)
  if (context && typeof context.waitUntil === "function") {
    context.waitUntil(task)
  } else {
    void task
  }
}

async function handleCity(request, rawId, env, context) {
  if (!isValidCityId(rawId)) {
    throw new ApiError("bad_request", "City id must be 1-7 digits", 400)
  }
  // "00001" and "1" are the same city; normalize so they share one KV entry.
  const id = String(Number.parseInt(rawId, 10))

  const kv = env.CITY_CACHE
  const stored = readStoredCity(await readJSON(kv, cityKey(id)))

  if (stored) {
    const age = Date.now() - Date.parse(stored.scraped_at)
    if (Number.isFinite(age) && age <= FRESH_MS) {
      return jsonResponse(
        { city: stored.city, cached: true, stale: false },
        { cacheControl: CITY_CACHE_CONTROL },
      )
    }
    if (Number.isFinite(age) && age <= STALE_MS) {
      await scheduleRefresh(env, context, id)
      return jsonResponse(
        { city: stored.city, cached: true, stale: true },
        { cacheControl: CITY_CACHE_CONTROL },
      )
    }
    // Older than the KV TTL (or an invalid timestamp): treat as a miss but keep
    // the entry as a fallback if the scrape fails.
  }

  if (await checkScrapeRateLimit(kv, clientIp(request))) {
    return rateLimitedResponse("Too many city scrapes, try again later")
  }

  try {
    const record = await scrapeCity(id)
    if (!validateCityRecord(record)) {
      throw new ApiError("parse_failed", "Scraped city record failed validation", 502)
    }
    await writeJSON(kv, cityKey(id), cityEnvelope(record), {
      expirationTtl: CITY_TTL_SECONDS,
    })
    return jsonResponse(
      { city: record, cached: false, stale: false },
      { cacheControl: CITY_CACHE_CONTROL },
    )
  } catch (error) {
    const apiError =
      error instanceof ApiError
        ? error
        : new ApiError("upstream_error", "Could not collect the city data", 502)
    if (stored) {
      return jsonResponse(
        { city: stored.city, cached: true, stale: true },
        { cacheControl: CITY_CACHE_CONTROL },
      )
    }
    return errorResponse(apiError.code, apiError.message, 502)
  }
}
