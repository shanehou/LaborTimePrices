// Frankfurter v2 rates, normalized to USD. One upstream request per day;
// the router caches the normalized table in KV. See
// https://api.frankfurter.dev/v2/openapi.json — GET /v2/rates returns an
// array of { date, base, quote, rate }.

import { ApiError } from "./errors.js"
import { COLLECTOR_UA, UPSTREAM_TIMEOUT_MS } from "./numbeo.js"

export const FX_KEY = "fx:v2"
export const FX_TTL_SECONDS = 24 * 60 * 60
export const FX_QUOTES = ["CNY", "EUR", "GBP", "JPY", "HKD", "SGD", "AUD", "CAD", "CHF", "KRW"]

const FX_URL =
  "https://api.frankfurter.dev/v2/rates?base=usd&quotes=" +
  FX_QUOTES.map((code) => code.toLowerCase()).join(",")

const DATE = /^\d{4}-\d{2}-\d{2}$/

export function parseFrankfurterRates(payload) {
  if (!Array.isArray(payload)) return null
  const rates = {}
  const seen = new Set()
  let date = null
  for (const row of payload) {
    if (!row || typeof row !== "object") return null
    const base = typeof row.base === "string" ? row.base.toUpperCase() : ""
    const quote = typeof row.quote === "string" ? row.quote.toUpperCase() : ""
    if (base !== "USD") return null
    if (!FX_QUOTES.includes(quote)) continue
    if (typeof row.rate !== "number" || !Number.isFinite(row.rate) || row.rate <= 0) return null
    if (typeof row.date !== "string" || !DATE.test(row.date)) return null
    if (seen.has(quote)) return null
    seen.add(quote)
    rates[quote] = row.rate
    if (date === null || row.date < date) date = row.date
  }
  if (seen.size !== FX_QUOTES.length || date === null) return null
  return { base: "USD", date, rates }
}

export function readFxTable(stored) {
  return parseFrankfurterRates(rowsFromTable(stored))
}

function rowsFromTable(stored) {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return null
  if (stored.base !== "USD" || typeof stored.date !== "string" || !stored.rates) return null
  return FX_QUOTES.map((quote) => ({
    date: stored.date,
    base: "USD",
    quote,
    rate: stored.rates[quote],
  }))
}

export async function fetchFrankfurterRates(fetchImpl = globalThis.fetch) {
  let response
  try {
    response = await fetchImpl(FX_URL, {
      headers: {
        "user-agent": COLLECTOR_UA,
        accept: "application/json",
      },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
  } catch {
    throw new ApiError("upstream_unavailable", "Exchange rate request failed", 502)
  }
  if (!response || response.ok !== true) {
    throw new ApiError("upstream_unavailable", "Exchange rate source is unavailable", 502)
  }
  let payload
  try {
    payload = await response.json()
  } catch {
    throw new ApiError("upstream_unavailable", "Exchange rate response was not JSON", 502)
  }
  const table = parseFrankfurterRates(payload)
  if (!table) {
    throw new ApiError("upstream_unavailable", "Exchange rate response was incomplete", 502)
  }
  return table
}
