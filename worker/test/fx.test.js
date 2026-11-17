import assert from "node:assert/strict"
import test from "node:test"

import { FX_QUOTES, parseFrankfurterRates } from "../fx.js"
import worker from "../index.js"
import { createFakeContext, createFakeKV, jsonResponse, requestFor } from "./helpers.js"

function rows(overrides = {}) {
  return FX_QUOTES.map((quote) => ({
    date: overrides.date ?? "2026-11-16",
    base: overrides.base ?? "USD",
    quote,
    rate: overrides.rate ?? 1.25,
  }))
}

function table() {
  return {
    base: "USD",
    date: "2026-11-16",
    rates: Object.fromEntries(FX_QUOTES.map((quote) => [quote, 1.25])),
  }
}

async function callFx(env, fetchImpl) {
  const previous = globalThis.fetch
  globalThis.fetch = fetchImpl
  try {
    return await worker.fetch(requestFor("/api/fx"), env, createFakeContext())
  } finally {
    globalThis.fetch = previous
  }
}

test("parseFrankfurterRates keeps the earliest date and every quote", () => {
  const payload = rows()
  payload[0] = { ...payload[0], date: "2026-11-15" }
  const parsed = parseFrankfurterRates(payload)
  assert.equal(parsed.date, "2026-11-15")
  assert.equal(parsed.rates.CNY, 1.25)
  assert.equal(parsed.rates.KRW, 1.25)
  assert.equal(parseFrankfurterRates(rows().slice(1)), null)
  assert.equal(parseFrankfurterRates(rows({ rate: 0 })), null)
  assert.equal(parseFrankfurterRates(rows({ base: "EUR" })), null)
})

test("GET /api/fx serves a cached table without calling upstream", async () => {
  const kv = createFakeKV({ "fx:v2": JSON.stringify(table()) })
  let calls = 0
  const response = await callFx({ CITY_CACHE: kv }, async () => {
    calls += 1
    throw new Error("upstream should not be called")
  })
  assert.equal(calls, 0)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("cache-control"), "public, max-age=3600")
  assert.deepEqual(await response.json(), table())
})

test("GET /api/fx stores a fresh v2 table", async () => {
  const kv = createFakeKV()
  const response = await callFx({ CITY_CACHE: kv }, async () => jsonResponse(rows()))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), table())
  assert.equal(JSON.parse(kv.store.get("fx:v2")).date, "2026-11-16")
  assert.equal(kv.puts[0].options.expirationTtl, 24 * 60 * 60)
})

test("GET /api/fx reports an incomplete upstream payload", async () => {
  const kv = createFakeKV()
  const response = await callFx({ CITY_CACHE: kv }, async () => jsonResponse(rows().slice(0, 2)))
  assert.equal(response.status, 502)
  const body = await response.json()
  assert.equal(body.error.code, "upstream_unavailable")
  assert.equal(kv.store.has("fx:v2"), false)
})
