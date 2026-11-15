// KV cache layout, freshness windows and approximate rate limiting.
// All KV values are JSON strings; counters are plain integer strings.
// Cloudflare KV is eventually consistent and has no atomic increments, so the
// rate limits are intentionally approximate: they bound abusive volume, they do
// not provide an exact quota.

export const CITY_KEY_PREFIX = "city:v1:"
export const SEARCH_KEY_PREFIX = "search:v1:"
export const REFRESH_LOCK_PREFIX = "refresh:v1:"

export const CITY_TTL_SECONDS = 30 * 24 * 60 * 60
export const SEARCH_TTL_SECONDS = 24 * 60 * 60
export const REFRESH_LOCK_TTL_SECONDS = 600

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

export const FRESH_MS = 7 * 24 * HOUR_MS
export const STALE_MS = 30 * 24 * HOUR_MS

// Cache-miss scrapes: 20/hour per client plus a 200/day global ceiling.
export const SCRAPE_LIMIT_PER_HOUR = 20
export const SCRAPE_LIMIT_PER_DAY = 200
// Search requests (cache hits are free) are cheap but still rate limited.
export const SEARCH_LIMIT_PER_HOUR = 60

export function cityKey(id) {
  return `${CITY_KEY_PREFIX}${id}`
}

export function searchKey(query) {
  return `${SEARCH_KEY_PREFIX}${String(query).toLowerCase()}`
}

export function refreshLockKey(id) {
  return `${REFRESH_LOCK_PREFIX}${id}`
}

export function hourBucket(now = Date.now()) {
  return Math.floor(now / HOUR_MS)
}

export function dayBucket(now = Date.now()) {
  return Math.floor(now / DAY_MS)
}

// Reads a JSON value, tolerating a fake/test KV that stores parsed objects.
export async function readJSON(kv, key) {
  const raw = await kv.get(key)
  if (raw === null || raw === undefined) return null
  if (typeof raw !== "string") {
    if (typeof raw === "object") return raw
    return null
  }
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function writeJSON(kv, key, value, options) {
  await kv.put(key, JSON.stringify(value), options)
}

export async function bumpCounter(kv, key, ttlSeconds) {
  const raw = await kv.get(key)
  const current = typeof raw === "string" || typeof raw === "number" ? Number.parseInt(raw, 10) : 0
  const next = Number.isFinite(current) && current > 0 ? current + 1 : 1
  await kv.put(key, String(next), { expirationTtl: ttlSeconds })
  return next
}

export async function checkSearchRateLimit(kv, ip, now = Date.now()) {
  const key = `ratelimit:search:hour:${ip}:${hourBucket(now)}`
  const count = await bumpCounter(kv, key, 3600)
  return count > SEARCH_LIMIT_PER_HOUR
}

export async function checkScrapeRateLimit(kv, ip, now = Date.now()) {
  const ipKey = `ratelimit:city:hour:${ip}:${hourBucket(now)}`
  const ipCount = await bumpCounter(kv, ipKey, 3600)
  if (ipCount > SCRAPE_LIMIT_PER_HOUR) return true
  const globalKey = `ratelimit:city:day:global:${dayBucket(now)}`
  const globalCount = await bumpCounter(kv, globalKey, 86400)
  return globalCount > SCRAPE_LIMIT_PER_DAY
}

// Cheap best-effort dedupe so a burst of stale reads does not start a burst of
// background refreshes. KV is not atomic; a duplicate scrape is harmless.
export async function acquireRefreshLock(kv, id) {
  const key = refreshLockKey(id)
  const existing = await kv.get(key)
  if (existing !== null && existing !== undefined) return false
  await kv.put(key, "1", { expirationTtl: REFRESH_LOCK_TTL_SECONDS })
  return true
}
