import assert from "node:assert/strict"
import test from "node:test"

import { ApiError } from "../errors.js"
import {
  COLLECTOR_UA,
  canonicalizePrices,
  decodeEntities,
  isValidCityId,
  normalizeText,
  parseCityHtml,
  parseCityIdentity,
  parsePrice,
  scrapeCity,
  searchCities,
  validateCityRecord,
} from "../numbeo.js"
import { htmlResponse, jsonResponse, makeCityRecord, readFixture } from "./helpers.js"

const REAL_PAGE = readFixture("numbeo-city-shanghai.html")
const NO_SALARY_PAGE = readFixture("synthetic-no-salary.html")
const NO_PRICES_PAGE = readFixture("synthetic-no-prices.html")
const ENTITIES_PAGE = readFixture("synthetic-entities-sup.html")

const REAL_SOURCE_URL =
  "https://www.numbeo.com/cost-of-living/in/Shanghai?displayCurrency=USD"

function parseReal(overrides = {}) {
  return parseCityHtml(REAL_PAGE, {
    id: "3781",
    source_url: REAL_SOURCE_URL,
    scraped_at: "2026-11-15T00:00:00.000Z",
    ...overrides,
  })
}

test("decodeEntities handles named and numeric entities", () => {
  assert.equal(decodeEntities("&amp; &quot; &#39; &lt; &gt; &nbsp;"), "& \" ' < >  ")
  assert.equal(decodeEntities("&#36;1,234.56"), "$1,234.56")
  assert.equal(decodeEntities("&#x24;4.25"), "$4.25")
  assert.equal(decodeEntities("&#X24;"), "$")
  assert.equal(decodeEntities("&#x1f600;"), "😀")
  assert.equal(decodeEntities("&bogus; &amp"), "&bogus; &amp")
})

test("normalizeText turns <sup>2</sup> into 2 before stripping tags", () => {
  assert.equal(
    normalizeText("Basic Utilities for 85 m<sup>2</sup> Apartment"),
    "Basic Utilities for 85 m2 Apartment",
  )
  assert.equal(
    normalizeText("Basic Utilities for 85 m<sup> 2 </sup> Apartment"),
    "Basic Utilities for 85 m2 Apartment",
  )
  assert.equal(normalizeText("<b>Broadband</b> Internet"), "Broadband Internet")
  assert.equal(normalizeText("  Fresh \n bread\t(500 g)  "), "Fresh bread (500 g)")
})

test("parsePrice parses US-locale money and rejects non-numbers", () => {
  assert.equal(parsePrice("&#36;1,234.56"), 1234.56)
  assert.equal(parsePrice("$0.45"), 0.45)
  assert.equal(parsePrice("-$5.00"), -5)
  assert.equal(parsePrice("3.30"), 3.3)
  assert.equal(parsePrice("ask"), null)
  assert.equal(parsePrice(""), null)
})

test("parseCityIdentity reads the form.jsp link in either parameter order", () => {
  assert.deepEqual(parseCityIdentity(REAL_PAGE), { name: "Shanghai", country: "China" })

  const cityFirst = `<a href="form.jsp?city=New+York%2C+NY&amp;country=United+States">edit</a>`
  assert.deepEqual(parseCityIdentity(cityFirst), {
    name: "New York",
    country: "United States",
  })

  const countryFirst = `<a href="form.jsp?country=Portugal&amp;city=Lisbon">edit</a>`
  assert.deepEqual(parseCityIdentity(countryFirst), { name: "Lisbon", country: "Portugal" })
})

test("parseCityIdentity falls back to the page title", () => {
  assert.deepEqual(
    parseCityIdentity("<title>Cost of Living in Berlin. Nov 2026. Prices in Berlin</title>"),
    { name: "Berlin", country: "" },
  )
  assert.deepEqual(parseCityIdentity("<html><title>unrelated</title></html>"), {
    name: "",
    country: "",
  })
})

test("parseCityHtml parses the trimmed real Numbeo page", () => {
  const record = parseReal()

  assert.equal(record.id, "3781")
  assert.equal(record.name, "Shanghai")
  assert.equal(record.country, "China")
  assert.equal(record.monthly_net_salary, 1710.3)
  assert.equal(record.scraped_at, "2026-11-15T00:00:00.000Z")
  assert.equal(record.source_url, REAL_SOURCE_URL)
  assert.ok(record.prices.length >= 10)
  assert.equal(validateCityRecord(record), true)

  const utilities = record.prices.find((price) => price.item.startsWith("Basic Utilities"))
  assert.deepEqual(utilities, {
    category: "Utilities (Monthly)",
    item: "Basic Utilities for 85 m2 Apartment (Electricity, Heating, Cooling, Water, Garbage)",
    price_usd: 59.41,
  })

  assert.equal(
    record.prices.filter((price) => price.item.includes("in %")).length,
    0,
    "mortgage-rate rows must not be treated as USD prices",
  )
  assert.equal(
    record.prices.filter((price) => price.item === "Average Monthly Net Salary (After Tax)").length,
    0,
    "the salary row must not appear in prices",
  )
  assert.ok(record.prices.every((price) => price.price_usd > 0))
  assert.ok(record.prices.every((price) => typeof price.category === "string"))
  assert.deepEqual(record.prices[0], {
    category: "Restaurants",
    item: "Meal at an Inexpensive Restaurant",
    price_usd: 4.5,
  })
})

test("parseCityHtml decodes entities, sup and comma prices in synthetic HTML", () => {
  const record = parseCityHtml(ENTITIES_PAGE, {
    id: "1",
    source_url: "https://www.numbeo.com/cost-of-living/in/New-York?displayCurrency=USD",
    scraped_at: "2026-11-15T00:00:00.000Z",
  })

  assert.equal(record.name, "New York")
  assert.equal(record.country, "United States")
  assert.equal(record.monthly_net_salary, 1710.3)
  assert.ok(record.prices.length >= 10)

  const byItem = new Map(record.prices.map((price) => [price.item, price.price_usd]))
  assert.equal(byItem.get("Fish & Chips (Chef's \"Special\")"), 12.5)
  assert.equal(byItem.get("Coffee <Large>"), 4.25)
  assert.equal(byItem.get("Bread & Butter"), 3000)
  assert.equal(
    byItem.get(
      "Basic Utilities for 85 m2 Apartment (Electricity, Heating, Cooling, Water, Garbage)",
    ),
    59.41,
  )
  assert.equal(byItem.has("Zero Price Item"), false)
  assert.equal(byItem.has("Negative Price Item"), false)
  assert.equal(byItem.has("Unpriced Item"), false)
  assert.equal(byItem.has("Annual Mortgage Interest Rate (20-Year Fixed, in %)"), false)
})

test("parseCityHtml leaves monthly_net_salary null when the salary row is absent", () => {
  const record = parseCityHtml(NO_SALARY_PAGE, {
    id: "1",
    source_url: "https://example.test/city",
  })
  assert.equal(record.monthly_net_salary, null)
  assert.ok(record.prices.length >= 10)
  assert.equal(record.name, "Lisbon")
  assert.equal(record.country, "Portugal")
})

test("parseCityHtml throws parse_failed below the 10-price minimum", () => {
  assert.throws(
    () => parseCityHtml(NO_PRICES_PAGE, { id: "1", source_url: "https://example.test/city" }),
    (error) => error instanceof ApiError && error.code === "parse_failed" && error.status === 502,
  )
  assert.throws(() => parseCityHtml("", { id: "1" }), { name: "ApiError" })
})

test("validateCityRecord accepts the contract shape and rejects bad records", () => {
  const record = makeCityRecord()
  assert.equal(validateCityRecord(record), true)
  assert.equal(validateCityRecord({ ...record, monthly_net_salary: null }), true)
  assert.equal(validateCityRecord({ ...record, monthly_net_salary: 0 }), false)
  assert.equal(validateCityRecord({ ...record, monthly_net_salary: "1710" }), false)
  assert.equal(validateCityRecord({ ...record, id: "abc" }), false)
  assert.equal(validateCityRecord({ ...record, name: 7 }), false)
  assert.equal(validateCityRecord({ ...record, name: "" }), false)
  assert.equal(validateCityRecord({ ...record, country: "  " }), false)
  assert.equal(validateCityRecord({ ...record, prices: null }), false)
  assert.equal(
    validateCityRecord({ ...record, prices: [{ category: "a", item: "b", price_usd: -1 }] }),
    false,
  )
  assert.equal(
    validateCityRecord({ ...record, prices: [{ category: "a", item: "b", price_usd: 0 }] }),
    false,
  )
  assert.equal(validateCityRecord({ ...record, scraped_at: 123 }), false)
  assert.equal(validateCityRecord({ ...record, source_url: null }), false)
  const { scraped_at, source_url, ...withoutExtras } = record
  assert.equal(validateCityRecord(withoutExtras), true)
  assert.equal(validateCityRecord(null), false)
})

test("isValidCityId accepts 1-7 digits only", () => {
  assert.equal(isValidCityId("1"), true)
  assert.equal(isValidCityId("3781"), true)
  assert.equal(isValidCityId("1234567"), true)
  assert.equal(isValidCityId(""), false)
  assert.equal(isValidCityId("12345678"), false)
  assert.equal(isValidCityId("12a"), false)
  assert.equal(isValidCityId("-1"), false)
})

test("scrapeCity makes exactly two identified upstream requests", async (t) => {
  const calls = []
  const stub = async (input, init = {}) => {
    const url = String(input)
    calls.push({ url, init })
    if (url.startsWith("https://www.numbeo.com/common/dispatcher.jsp")) {
      return htmlResponse("", { url: "https://www.numbeo.com/cost-of-living/in/Shanghai" })
    }
    return htmlResponse(REAL_PAGE, { url })
  }
  t.mock.method(globalThis, "fetch", stub)

  const record = await scrapeCity("3781", { now: () => new Date("2026-11-15T00:00:00.000Z") })

  assert.equal(calls.length, 2)
  assert.match(calls[0].url, /^https:\/\/www\.numbeo\.com\/common\/dispatcher\.jsp\?/)
  assert.match(
    calls[0].url,
    /where=https%3A%2F%2Fwww\.numbeo\.com%2Fcost-of-living%2Fin%2F/,
  )
  assert.match(calls[0].url, /city_id=3781/)
  assert.equal(
    calls[1].url,
    "https://www.numbeo.com/cost-of-living/in/Shanghai?displayCurrency=USD",
  )
  for (const call of calls) {
    assert.equal(call.init.headers["user-agent"], COLLECTOR_UA)
    assert.equal(call.init.headers["accept-language"], "en-US,en;q=0.9")
    assert.ok(call.init.signal instanceof AbortSignal)
  }

  assert.equal(record.id, "3781")
  assert.equal(record.name, "Shanghai")
  assert.equal(record.scraped_at, "2026-11-15T00:00:00.000Z")
  assert.equal(validateCityRecord(record), true)
})

test("scrapeCity reports upstream_error on a non-200 response", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("blocked", { status: 503 }))
  await assert.rejects(scrapeCity("3781"), {
    name: "ApiError",
    code: "upstream_error",
    status: 502,
  })
})

test("scrapeCity reports upstream_unavailable when fetch throws", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new TypeError("network down")
  })
  await assert.rejects(scrapeCity("3781"), {
    name: "ApiError",
    code: "upstream_unavailable",
    status: 502,
  })
})

test("scrapeCity reports parse_failed on an unusable page", async (t) => {
  t.mock.method(globalThis, "fetch", async (input) => {
    const url = String(input)
    if (url.startsWith("https://www.numbeo.com/common/dispatcher.jsp")) {
      return htmlResponse("", { url: "https://www.numbeo.com/cost-of-living/in/Nowhere" })
    }
    return htmlResponse(NO_PRICES_PAGE, { url })
  })
  await assert.rejects(scrapeCity("1"), {
    name: "ApiError",
    code: "parse_failed",
    status: 502,
  })
})

test("searchCities encodes the term, maps labels and caps results at 10", async (t) => {
  const calls = []
  const items = [
    { label: "New York, NY, United States", value: "1" },
    ...Array.from({ length: 11 }, (_, index) => ({
      label: `City ${index}, Country`,
      value: String(index + 2),
    })),
    { label: "", value: "99" },
    { label: "No Value" },
  ]
  t.mock.method(globalThis, "fetch", async (input, init = {}) => {
    calls.push({ url: String(input), init })
    return jsonResponse(items)
  })

  const results = await searchCities("New York")

  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, "https://www.numbeo.com/common/CitySearchJson?term=New%20York")
  assert.equal(calls[0].init.headers["user-agent"], COLLECTOR_UA)
  assert.equal(results.length, 10)
  assert.deepEqual(results[0], {
    id: "1",
    label: "New York, NY, United States",
    name: "New York",
    country: "United States",
  })
  assert.equal(results.filter((result) => result.id === "99").length, 0)
})

test("searchCities maps a single-segment label to both name and country", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    jsonResponse([{ label: "Nowhere", value: "7" }]),
  )
  assert.deepEqual(await searchCities("nowhere"), [
    { id: "7", label: "Nowhere", name: "Nowhere", country: "Nowhere" },
  ])
})

test("canonicalizePrices keeps a single unit and prefers metric when both are present", () => {
  const utilities =
    "Basic Utilities for 915 Square Feet Apartment (Electricity, Heating, Cooling, Water, Garbage)"
  const metricUtilities =
    "Basic Utilities for 85 m2 Apartment (Electricity, Heating, Cooling, Water, Garbage)"
  const imperialOnly = canonicalizePrices([
    { category: "Markets", item: "Apples (1 lb)", price_usd: 1.03 },
    { category: "Utilities (Monthly)", item: utilities, price_usd: 59.47 },
    { category: "Markets", item: "Milk (Regular, 1 Liter)", price_usd: 1.81 },
  ])
  assert.deepEqual(imperialOnly, [
    { category: "Markets", item: "Apples (1 lb)", price_usd: 1.03 },
    { category: "Utilities (Monthly)", item: utilities, price_usd: 59.47 },
    { category: "Markets", item: "Milk (Regular, 1 Liter)", price_usd: 1.81 },
  ])

  const both = canonicalizePrices([
    { category: "Utilities (Monthly)", item: utilities, price_usd: 1 },
    { category: "Utilities (Monthly)", item: metricUtilities, price_usd: 59.47 },
  ])
  assert.deepEqual(both, [
    { category: "Utilities (Monthly)", item: metricUtilities, price_usd: 59.47 },
  ])
})

test("searchCities reports upstream failures", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("nope", { status: 500 }))
  await assert.rejects(searchCities("x"), { name: "ApiError", code: "upstream_error" })

  t.mock.method(globalThis, "fetch", async () => {
    throw new TypeError("network down")
  })
  await assert.rejects(searchCities("x"), { name: "ApiError", code: "upstream_unavailable" })

  t.mock.method(globalThis, "fetch", async () => new Response("not json", { status: 200 }))
  await assert.rejects(searchCities("x"), { name: "ApiError", code: "upstream_error" })

  t.mock.method(globalThis, "fetch", async () => jsonResponse({ unexpected: true }))
  await assert.rejects(searchCities("x"), { name: "ApiError", code: "upstream_error" })
})
