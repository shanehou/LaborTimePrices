// Shared fixtures and stubs for the worker tests.

import { readFileSync } from "node:fs"

const FIXTURES = new URL("./fixtures/", import.meta.url)

export function readFixture(name) {
  return readFileSync(new URL(name, FIXTURES), "utf8")
}

// Minimal in-memory stand-in for a Workers KV namespace. Values are stored as
// the strings the worker writes, and put options are recorded for assertions.
export function createFakeKV(initial = {}) {
  const store = new Map(Object.entries(initial))
  const puts = []
  return {
    store,
    puts,
    async get(key) {
      return store.has(key) ? store.get(key) : null
    },
    async put(key, value, options = {}) {
      store.set(key, value)
      puts.push({ key, value, options })
    },
    async delete(key) {
      store.delete(key)
    },
  }
}

export function createFakeContext() {
  const waits = []
  return {
    waits,
    waitUntil(promise) {
      waits.push(promise)
    },
    passThroughOnException() {},
  }
}

export function jsonResponse(data, { status = 200 } = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  })
}

export function htmlResponse(html, { status = 200, url } = {}) {
  const response = new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  })
  if (url) {
    Object.defineProperty(response, "url", { value: url, configurable: true })
  }
  return response
}

export const CANONICAL_CITY_URL = "https://www.numbeo.com/cost-of-living/in/Shanghai"

// Stubbed upstream: dispatcher redirect -> canonical city page -> HTML.
export function createCityFetchStub(
  html,
  { canonicalUrl = CANONICAL_CITY_URL, dispatcherStatus = 200, pageStatus = 200 } = {},
) {
  const calls = []
  async function stub(input, init = {}) {
    const url = typeof input === "string" ? input : String(input.url ?? input)
    calls.push({ url, init })
    if (url.startsWith("https://www.numbeo.com/common/dispatcher.jsp")) {
      if (dispatcherStatus !== 200) {
        return new Response("nope", { status: dispatcherStatus })
      }
      return htmlResponse("", { url: canonicalUrl })
    }
    if (url.startsWith("https://www.numbeo.com/cost-of-living/in/")) {
      if (pageStatus !== 200) {
        return new Response("nope", { status: pageStatus })
      }
      return htmlResponse(html, { url })
    }
    if (url.startsWith("https://www.numbeo.com/common/CitySearchJson")) {
      return jsonResponse([{ label: "Shanghai, China", value: "3781" }])
    }
    throw new Error(`unexpected fetch: ${url}`)
  }
  return { fetch: stub, calls }
}

export function makeCityRecord(overrides = {}) {
  return {
    id: "3781",
    name: "Shanghai",
    country: "China",
    monthly_net_salary: 1710.3,
    prices: [
      { category: "Restaurants", item: "Meal at an Inexpensive Restaurant", price_usd: 4.5 },
      { category: "Utilities (Monthly)", item: "Broadband Internet", price_usd: 10.6 },
    ],
    scraped_at: new Date().toISOString(),
    source_url: CANONICAL_CITY_URL + "?displayCurrency=USD",
    ...overrides,
  }
}

// Seeds a README-conformant KV envelope around a city record.
export function seedCity(kv, record, { id = record.id, scrapedAt = record.scraped_at } = {}) {
  kv.store.set(
    `city:v1:${id}`,
    JSON.stringify({ v: 1, city: record, scraped_at: scrapedAt, source_url: record.source_url }),
  )
}

export function requestFor(path, init = {}) {
  return new Request(`https://ltp.melkor.me${path}`, init)
}

export const DAY_MS = 24 * 60 * 60 * 1000

export function isoDaysAgo(days) {
  return new Date(Date.now() - days * DAY_MS).toISOString()
}
