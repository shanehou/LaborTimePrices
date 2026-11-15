import assert from "node:assert/strict"
import test from "node:test"

import { CATALOG } from "../catalog.js"
import worker from "../index.js"
import {
  createCityFetchStub,
  createFakeContext,
  createFakeKV,
  htmlResponse,
  isoDaysAgo,
  jsonResponse,
  makeCityRecord,
  readFixture,
  requestFor,
  seedCity,
} from "./helpers.js"

const REAL_PAGE = readFixture("numbeo-city-shanghai.html")
const NO_PRICES_PAGE = readFixture("synthetic-no-prices.html")

async function callWorker({ path = "/api/health", init = {}, env, ctx } = {}) {
  const environment = env ?? { CITY_CACHE: createFakeKV() }
  const context = ctx ?? createFakeContext()
  const response = await worker.fetch(requestFor(path, init), environment, context)
  return { response, env: environment, ctx: context }
}

async function expectError(response, status, code) {
  assert.equal(response.status, status)
  const body = await response.json()
  assert.equal(typeof body.error, "object")
  assert.equal(body.error.code, code)
  assert.equal(typeof body.error.message, "string")
  assert.ok(body.error.message.length > 0, "error message must not be empty")
  return body
}

function failFetch(message = "fetch should not be called") {
  return async () => {
    throw new Error(message)
  }
}

function parseStoredCity(kv, id = "3781") {
  return JSON.parse(kv.store.get(`city:v1:${id}`))
}

test("GET /api/health returns ok", async () => {
  const { response } = await callWorker({ path: "/api/health" })
  assert.equal(response.status, 200)
  assert.match(response.headers.get("content-type"), /application\/json/)
  assert.deepEqual(await response.json(), { ok: true })
})

test("GET /api/catalog returns the static catalog with a day-long cache", async () => {
  const { response } = await callWorker({ path: "/api/catalog" })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("cache-control"), "public, max-age=86400")

  const body = await response.json()
  assert.equal(body.count, CATALOG.length)
  assert.ok(body.count > 0)
  assert.deepEqual(
    body.cities,
    CATALOG.map((entry) => ({
      id: entry.id,
      name: entry.name,
      country: entry.country,
    })),
  )
})

test("unknown paths and non-GET methods are 404 not_found", async () => {
  const unknown = await callWorker({ path: "/api/nope" })
  await expectError(unknown.response, 404, "not_found")

  const legacy = await callWorker({ path: "/prices.json" })
  await expectError(legacy.response, 404, "not_found")

  const post = await callWorker({ path: "/api/health", init: { method: "POST" } })
  await expectError(post.response, 404, "not_found")
})

test("GET /api/search validates q", async (t) => {
  t.mock.method(globalThis, "fetch", failFetch())

  for (const path of ["/api/search", "/api/search?q=", "/api/search?q=%20%20", `/api/search?q=${"a".repeat(65)}`]) {
    const { response } = await callWorker({ path })
    await expectError(response, 400, "bad_request")
  }
})

test("GET /api/search scrapes once, caches the results and trims q", async (t) => {
  const kv = createFakeKV()
  const calls = []
  t.mock.method(globalThis, "fetch", async (input, init = {}) => {
    calls.push({ url: String(input), init })
    return jsonResponse([
      { label: "Shanghai, China", value: "3781" },
      { label: "Shenzhen, China", value: "3785" },
    ])
  })

  const { response } = await callWorker({
    path: "/api/search?q=%20Shanghai%20",
    env: { CITY_CACHE: kv },
  })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.query, "Shanghai")
  assert.deepEqual(body.results, [
    { id: "3781", label: "Shanghai, China", name: "Shanghai", country: "China" },
    { id: "3785", label: "Shenzhen, China", name: "Shenzhen", country: "China" },
  ])
  assert.equal(calls.length, 1)
  assert.equal(
    calls[0].url,
    "https://www.numbeo.com/common/CitySearchJson?term=Shanghai",
  )
  assert.equal(calls[0].init.headers["user-agent"].startsWith("ltp.melkor.me-collector/"), true)

  const stored = kv.puts.find((put) => put.key === "search:v1:shanghai")
  assert.ok(stored, "search results must be cached under the lowercased query")
  assert.equal(stored.options.expirationTtl, 86400)
  assert.deepEqual(JSON.parse(stored.value), body.results)
})

test("GET /api/search serves a cached query without calling upstream", async (t) => {
  const cached = [{ id: "3781", label: "Shanghai, China", name: "Shanghai", country: "China" }]
  const kv = createFakeKV({
    "search:v1:shanghai": JSON.stringify(cached),
  })
  t.mock.method(globalThis, "fetch", failFetch())

  const { response } = await callWorker({
    path: "/api/search?q=SHANGHAI",
    env: { CITY_CACHE: kv },
  })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { query: "SHANGHAI", results: cached })
})

test("GET /api/search reports upstream errors as 502", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("blocked", { status: 403 }))
  const { response } = await callWorker({ path: "/api/search?q=Shanghai" })
  await expectError(response, 502, "upstream_error")
})

test("GET /api/search is rate limited to 60 requests per hour per IP", async (t) => {
  const kv = createFakeKV()
  t.mock.method(globalThis, "fetch", async () => jsonResponse([]))

  for (let index = 0; index < 60; index += 1) {
    const { response } = await callWorker({
      path: `/api/search?q=city${index}`,
      env: { CITY_CACHE: kv },
    })
    assert.equal(response.status, 200)
  }

  const limited = await callWorker({
    path: "/api/search?q=city60",
    env: { CITY_CACHE: kv },
  })
  assert.equal(limited.response.status, 429)
  assert.equal(limited.response.headers.get("retry-after"), "60")
  await expectError(limited.response, 429, "rate_limited")
})

test("GET /api/city/:id validates the id", async (t) => {
  t.mock.method(globalThis, "fetch", failFetch())

  for (const path of ["/api/city/abc", "/api/city/12345678", "/api/city/-1", "/api/city/12.3"]) {
    const { response } = await callWorker({ path })
    await expectError(response, 400, "bad_request")
  }

  const missing = await callWorker({ path: "/api/city/" })
  await expectError(missing.response, 404, "not_found")
})

test("GET /api/city/:id normalizes leading zeros to one cache key", async (t) => {
  const record = makeCityRecord({ scraped_at: isoDaysAgo(2) })
  const kv = createFakeKV()
  seedCity(kv, record)
  t.mock.method(globalThis, "fetch", failFetch())

  const { response } = await callWorker({ path: "/api/city/03781", env: { CITY_CACHE: kv } })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.cached, true)
  assert.equal(body.city.id, "3781")
})

test("GET /api/city/:id serves a fresh cache hit without upstream", async (t) => {
  const record = makeCityRecord({ scraped_at: isoDaysAgo(2) })
  const kv = createFakeKV()
  seedCity(kv, record)
  t.mock.method(globalThis, "fetch", failFetch())

  const { response } = await callWorker({ path: "/api/city/3781", env: { CITY_CACHE: kv } })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("cache-control"), "public, max-age=300")

  const body = await response.json()
  assert.deepEqual(body, { city: record, cached: true, stale: false })
})

test("GET /api/city/:id serves stale data and refreshes in the background", async (t) => {
  const record = makeCityRecord({ scraped_at: isoDaysAgo(10) })
  const kv = createFakeKV()
  seedCity(kv, record)
  const storedBefore = parseStoredCity(kv)
  const { fetch: stub, calls } = createCityFetchStub(REAL_PAGE)
  t.mock.method(globalThis, "fetch", stub)

  const { response, ctx } = await callWorker({
    path: "/api/city/3781",
    env: { CITY_CACHE: kv },
  })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.cached, true)
  assert.equal(body.stale, true)
  assert.equal(body.city.name, "Shanghai")

  assert.equal(ctx.waits.length, 1, "a stale hit must schedule exactly one refresh")
  await Promise.all(ctx.waits)

  assert.equal(calls.length, 2, "the background refresh makes two upstream requests")
  const storedAfter = parseStoredCity(kv)
  assert.equal(storedAfter.v, 1)
  assert.notEqual(storedAfter.scraped_at, storedBefore.scraped_at)
  assert.equal(storedAfter.city.prices.length >= 10, true)
})

test("GET /api/city/:id scrapes and writes a cold city", async (t) => {
  const kv = createFakeKV()
  const { fetch: stub, calls } = createCityFetchStub(REAL_PAGE)
  t.mock.method(globalThis, "fetch", stub)

  const { response, ctx } = await callWorker({
    path: "/api/city/3781",
    env: { CITY_CACHE: kv },
  })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("cache-control"), "public, max-age=300")

  const body = await response.json()
  assert.equal(body.cached, false)
  assert.equal(body.stale, false)
  assert.equal(body.city.id, "3781")
  assert.equal(body.city.name, "Shanghai")
  assert.equal(body.city.country, "China")
  assert.equal(body.city.monthly_net_salary, 1710.3)
  assert.ok(body.city.prices.length >= 10)
  assert.equal(body.city.source_url, "https://www.numbeo.com/cost-of-living/in/Shanghai?displayCurrency=USD")
  assert.equal(Number.isNaN(Date.parse(body.city.scraped_at)), false)
  assert.equal(ctx.waits.length, 0)

  assert.equal(calls.length, 2)

  const stored = kv.puts.find((put) => put.key === "city:v1:3781")
  assert.ok(stored)
  assert.equal(stored.options.expirationTtl, 2592000)
  const envelope = JSON.parse(stored.value)
  assert.equal(envelope.v, 1)
  assert.deepEqual(envelope.city, body.city)
  assert.equal(envelope.scraped_at, body.city.scraped_at)
  assert.equal(envelope.source_url, body.city.source_url)
})

test("GET /api/city/:id falls back to stale data when the scrape fails", async (t) => {
  const record = makeCityRecord({ scraped_at: isoDaysAgo(40) })
  const kv = createFakeKV()
  seedCity(kv, record)
  t.mock.method(globalThis, "fetch", failFetch("network down"))

  const { response } = await callWorker({
    path: "/api/city/3781",
    env: { CITY_CACHE: kv },
  })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.cached, true)
  assert.equal(body.stale, true)
  assert.equal(body.city.name, record.name)
})

test("GET /api/city/:id returns 502 on scrape failure without any cache", async (t) => {
  const kv = createFakeKV()
  t.mock.method(globalThis, "fetch", async () => {
    throw new TypeError("network down")
  })
  const { response } = await callWorker({ path: "/api/city/3781", env: { CITY_CACHE: kv } })
  await expectError(response, 502, "upstream_unavailable")
  assert.equal(
    [...kv.store.keys()].some((key) => key.startsWith("city:v1:")),
    false,
    "a failed scrape must not be cached",
  )
})

test("GET /api/city/:id distinguishes upstream and parse failures", async (t) => {
  const kv = createFakeKV()
  t.mock.method(globalThis, "fetch", async () => new Response("blocked", { status: 503 }))
  const upstream = await callWorker({ path: "/api/city/3781", env: { CITY_CACHE: kv } })
  await expectError(upstream.response, 502, "upstream_error")

  const parseKv = createFakeKV()
  t.mock.method(globalThis, "fetch", async (input) => {
    const url = String(input)
    if (url.startsWith("https://www.numbeo.com/common/dispatcher.jsp")) {
      return htmlResponse("", { url: "https://www.numbeo.com/cost-of-living/in/Nowhere" })
    }
    return htmlResponse(NO_PRICES_PAGE, { url })
  })
  const parse = await callWorker({ path: "/api/city/999", env: { CITY_CACHE: parseKv } })
  await expectError(parse.response, 502, "parse_failed")
})

test("GET /api/city/:id is rate limited to 20 cold scrapes per hour per IP", async (t) => {
  const kv = createFakeKV()
  const { fetch: stub } = createCityFetchStub(REAL_PAGE)
  t.mock.method(globalThis, "fetch", stub)

  for (let index = 0; index < 20; index += 1) {
    const { response } = await callWorker({
      path: `/api/city/${1000 + index}`,
      env: { CITY_CACHE: kv },
    })
    assert.equal(response.status, 200)
  }

  const limited = await callWorker({ path: "/api/city/1020", env: { CITY_CACHE: kv } })
  assert.equal(limited.response.status, 429)
  assert.equal(limited.response.headers.get("retry-after"), "60")
  await expectError(limited.response, 429, "rate_limited")
})

test("city rate limiting does not apply to cache hits", async (t) => {
  const record = makeCityRecord()
  const kv = createFakeKV()
  seedCity(kv, record)
  t.mock.method(globalThis, "fetch", failFetch())

  for (let index = 0; index < 30; index += 1) {
    const { response } = await callWorker({ path: "/api/city/3781", env: { CITY_CACHE: kv } })
    assert.equal(response.status, 200)
  }
})
