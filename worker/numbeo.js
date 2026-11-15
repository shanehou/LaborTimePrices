// Numbeo client: on-demand city scraping plus the city search proxy.
//
// Volume is deliberately tiny: a cold city needs exactly two upstream
// requests, everything is cached for up to 30 days by the router, and every
// request carries an identifying user agent. The HTML shape parsed here is the
// current server-rendered Numbeo cost-of-living page.

import { ApiError } from "./errors.js"

export const COLLECTOR_UA =
  "ltp.melkor.me-collector/1.0 (+https://ltp.melkor.me; personal low-volume)"
export const ACCEPT_LANGUAGE = "en-US,en;q=0.9"
export const UPSTREAM_TIMEOUT_MS = 10000

export const CITY_PAGE_BASE = "https://www.numbeo.com/cost-of-living/in/"
export const DISPATCHER_URL = "https://www.numbeo.com/common/dispatcher.jsp"
export const SEARCH_URL = "https://www.numbeo.com/common/CitySearchJson"

export const MIN_PRICES = 10
export const SEARCH_RESULTS_LIMIT = 10
export const SALARY_ITEM = "Average Monthly Net Salary (After Tax)"
export const CITY_ID_PATTERN = /^\d{1,7}$/

const COLLECTOR_HEADERS = {
  "user-agent": COLLECTOR_UA,
  "accept-language": ACCEPT_LANGUAGE,
}

const NAMED_ENTITIES = {
  amp: "&",
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
  quot: "\"",
  "#39": "'",
}

export function isValidCityId(id) {
  return typeof id === "string" && CITY_ID_PATTERN.test(id)
}

function codepointOr(match, code) {
  if (!Number.isInteger(code) || code <= 0 || code > 0x10ffff) return match
  try {
    return String.fromCodePoint(code)
  } catch {
    return match
  }
}

// Decodes the named and numeric entities Numbeo emits, leaving unknown
// entities untouched.
export function decodeEntities(input) {
  return String(input).replace(
    /&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g,
    (match, body) => {
      if (body.length > 1 && body[0] === "#" && body[1].toLowerCase() === "x") {
        return codepointOr(match, Number.parseInt(body.slice(2), 16))
      }
      if (body.startsWith("#")) {
        return codepointOr(match, Number.parseInt(body.slice(1), 10))
      }
      const named = NAMED_ENTITIES[body.toLowerCase()]
      return named === undefined ? match : named
    },
  )
}

// Turns a small HTML fragment into plain text. <sup>2</sup> becomes "2" before
// tags are stripped so "85 m<sup>2</sup>" stays "85 m2" instead of "85 m".
export function normalizeText(input) {
  return decodeEntities(
    String(input)
      .replace(/<sup[^>]*>\s*2\s*<\/sup>/gi, "2")
      .replace(/<[^>]*>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim()
}

// Parses a US-locale money string such as "$1,234.56" or "-$5.00". Returns
// null when the text holds no number.
export function parsePrice(input) {
  const text = normalizeText(input).replace(/[^0-9.,+-]/g, "")
  const match = text.match(/-?\d[\d,]*(?:\.\d+)?/)
  if (!match) return null
  const value = Number(match[0].replace(/,/g, ""))
  return Number.isFinite(value) ? value : null
}

function firstGroup(html, regex) {
  const match = regex.exec(html)
  return match ? match[1] : null
}

function categoryFromRow(row) {
  return firstGroup(row, /<div[^>]*class="[^"]*category_title[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
}

function itemFromRow(row) {
  return firstGroup(row, /<td[^>]*>([\s\S]*?)<\/td>/i)
}

function priceHtmlFromRow(row) {
  const firstCurrency = firstGroup(
    row,
    /<span[^>]*class="[^"]*first_currency[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
  )
  if (firstCurrency !== null) return firstCurrency
  return firstGroup(
    row,
    /<td[^>]*class="[^"]*priceValue[^"]*"[^>]*>([\s\S]*?)<\/td>/i,
  )
}

function cleanCityName(value) {
  return String(value).split(",")[0].trim()
}

// City name/country come from the "edit this city" form link, which carries
// country=...&city=... in either order. Falls back to the page title.
export function parseCityIdentity(html) {
  const source = String(html)
  let name = ""
  let country = ""

  for (const match of source.matchAll(/form\.jsp\?([^"'\s<>]+)/gi)) {
    const params = new URLSearchParams(match[1].replace(/&amp;/g, "&"))
    const city = params.get("city")
    const linkedCountry = params.get("country")
    if (!city || !city.trim()) continue
    if (!name) name = cleanCityName(city)
    if (!country && linkedCountry) country = linkedCountry.trim()
    if (name && country) break
  }

  if (!name) {
    const titleHtml = firstGroup(source, /<title[^>]*>([\s\S]*?)<\/title>/i)
    if (titleHtml !== null) {
      const title = normalizeText(titleHtml)
      const titleCity = title.match(/Cost of Living in (.+?)\./i)
      if (titleCity) name = cleanCityName(titleCity[1])
    }
  }

  return { name, country }
}

export function parseCityHtml(html, { id, source_url, scraped_at } = {}) {
  const source = String(html ?? "")
  let category = ""
  let monthlySalary = null
  const prices = []

  for (const match of source.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = match[1]

    const rowCategory = categoryFromRow(row)
    if (rowCategory !== null) {
      category = normalizeText(rowCategory)
      continue
    }

    const itemHtml = itemFromRow(row)
    if (itemHtml === null) continue
    const item = normalizeText(itemHtml)
    if (!item) continue

    const priceHtml = priceHtmlFromRow(row)
    if (priceHtml === null) continue
    const price = parsePrice(priceHtml)

    if (item === SALARY_ITEM) {
      monthlySalary = price !== null && price > 0 ? price : null
      continue
    }
    // Mortgage interest rates are percentages, not USD prices. Numbeo writes
    // them as "(20-Year Fixed, in %)" or "(in %)".
    if (item.includes("in %")) continue
    if (price === null || price <= 0) continue

    prices.push({ category, item, price_usd: price })
  }

  if (prices.length < MIN_PRICES) {
    throw new ApiError(
      "parse_failed",
      `Numbeo page yielded only ${prices.length} prices (need ${MIN_PRICES})`,
      502,
    )
  }

  const identity = parseCityIdentity(source)
  return {
    id: String(id ?? ""),
    name: identity.name,
    country: identity.country,
    monthly_net_salary: monthlySalary,
    prices,
    scraped_at: scraped_at ?? new Date().toISOString(),
    source_url: source_url ?? "",
  }
}

export function validateCityRecord(record) {
  if (!record || typeof record !== "object") return false
  if (typeof record.id !== "string" || !CITY_ID_PATTERN.test(record.id)) return false
  if (typeof record.name !== "string" || record.name.trim() === "") return false
  if (typeof record.country !== "string" || record.country.trim() === "") return false
  const salary = record.monthly_net_salary
  if (salary !== null && !(typeof salary === "number" && Number.isFinite(salary) && salary > 0)) {
    return false
  }
  // The scraper always fills these in; tolerate their absence in legacy KV data.
  if (record.scraped_at !== undefined && typeof record.scraped_at !== "string") return false
  if (record.source_url !== undefined && typeof record.source_url !== "string") return false
  if (!Array.isArray(record.prices)) return false
  return record.prices.every(
    (price) =>
      price !== null &&
      typeof price === "object" &&
      typeof price.category === "string" &&
      typeof price.item === "string" &&
      typeof price.price_usd === "number" &&
      Number.isFinite(price.price_usd) &&
      price.price_usd > 0,
  )
}

async function requestUpstream(fetchImpl, url) {
  let response
  try {
    response = await fetchImpl(url, {
      headers: { ...COLLECTOR_HEADERS },
      redirect: "follow",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
  } catch {
    throw new ApiError("upstream_unavailable", "Numbeo request failed", 502)
  }
  if (!response || response.ok !== true) {
    const status = response && typeof response.status === "number" ? response.status : "unknown"
    throw new ApiError("upstream_error", `Numbeo responded with HTTP ${status}`, 502)
  }
  return response
}

// Two upstream requests: the dispatcher redirect resolves city_id to the
// canonical city page, then the page is fetched in USD.
export async function scrapeCity(id, { fetch: fetchImpl = globalThis.fetch, now = () => new Date() } = {}) {
  const cityId = String(id)
  const dispatcherUrl =
    `${DISPATCHER_URL}?where=${encodeURIComponent(CITY_PAGE_BASE)}` +
    `&city_id=${encodeURIComponent(cityId)}`

  const dispatcherResponse = await requestUpstream(fetchImpl, dispatcherUrl)
  const canonicalUrl =
    typeof dispatcherResponse.url === "string" && dispatcherResponse.url
      ? dispatcherResponse.url
      : dispatcherUrl

  let pageUrl
  try {
    pageUrl = new URL(canonicalUrl)
  } catch {
    throw new ApiError("upstream_unavailable", "Numbeo returned an invalid city URL", 502)
  }
  pageUrl.searchParams.set("displayCurrency", "USD")

  const pageResponse = await requestUpstream(fetchImpl, pageUrl.toString())
  let pageHtml
  try {
    pageHtml = await pageResponse.text()
  } catch {
    throw new ApiError("upstream_unavailable", "Could not read the Numbeo city page", 502)
  }

  return parseCityHtml(pageHtml, {
    id: cityId,
    source_url: pageUrl.toString(),
    scraped_at: now().toISOString(),
  })
}

function toSearchResult(item) {
  if (!item || typeof item !== "object") return null
  if (item.value === undefined || item.value === null) return null
  const label = normalizeText(typeof item.label === "string" ? item.label : "")
  if (!label) return null
  const segments = label
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean)
  return {
    id: String(item.value),
    label,
    name: segments[0] ?? label,
    country: segments[segments.length - 1] ?? label,
  }
}

export async function searchCities(term, { fetch: fetchImpl = globalThis.fetch } = {}) {
  const url = `${SEARCH_URL}?term=${encodeURIComponent(String(term))}`
  const response = await requestUpstream(fetchImpl, url)

  let payload
  try {
    payload = await response.json()
  } catch {
    throw new ApiError("upstream_error", "Numbeo search returned invalid JSON", 502)
  }

  const items = Array.isArray(payload)
    ? payload
    : payload && Array.isArray(payload.data)
      ? payload.data
      : null
  if (items === null) {
    throw new ApiError("upstream_error", "Numbeo search returned an unexpected payload", 502)
  }

  return items
    .map(toSearchResult)
    .filter((result) => result !== null)
    .slice(0, SEARCH_RESULTS_LIMIT)
}
