import { afterEach, describe, expect, it, vi } from "vitest"
import { ITEMS } from "../data/items"
import {
  ApiError,
  REQUEST_TIMEOUT_MS,
  fetchCatalog,
  fetchCity,
  searchCities,
} from "./api"

const cityRecord = {
  id: "city_1",
  name: "Lisbon",
  country: "Portugal",
  monthly_net_salary: 1450,
  prices: [{ category: "Restaurants", item: ITEMS.coffee, price_usd: 1.9 }],
  scraped_at: "2026-11-01T00:00:00.000Z",
  source_url: "https://www.numbeo.com/cost-of-living/in/Lisbon",
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function stubFetch(
  impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
) {
  const mock = vi.fn(impl)
  vi.stubGlobal("fetch", mock)
  return mock
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe("fetchCatalog", () => {
  it("requests /api/catalog and returns the cities", async () => {
    const cities = [{ id: "city_1", name: "Lisbon", country: "Portugal" }]
    const fetchMock = stubFetch(async () => jsonResponse({ cities, count: 1 }))
    await expect(fetchCatalog()).resolves.toEqual(cities)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/catalog")
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal)
  })

  it("rejects an invalid payload as invalid", async () => {
    stubFetch(async () => jsonResponse({ cities: "nope" }))
    await expect(fetchCatalog()).rejects.toMatchObject({ code: "invalid" })

    stubFetch(async () => jsonResponse({ cities: [{ id: "x", name: "", country: "Y" }] }))
    await expect(fetchCatalog()).rejects.toBeInstanceOf(ApiError)
  })

  it("maps a network failure to network", async () => {
    stubFetch(async () => {
      throw new TypeError("offline")
    })
    await expect(fetchCatalog()).rejects.toMatchObject({ code: "network" })
  })
})

describe("fetchCity", () => {
  it("returns the city record from the envelope", async () => {
    const fetchMock = stubFetch(async () =>
      jsonResponse({ city: cityRecord, cached: true, stale: false }),
    )
    await expect(fetchCity("city_1")).resolves.toEqual(cityRecord)
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/city/city_1")
  })

  it("encodes the city id in the path", async () => {
    const fetchMock = stubFetch(async () =>
      jsonResponse({ city: { ...cityRecord, id: "a/b" }, cached: false, stale: false }),
    )
    await fetchCity("a/b")
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/city/a%2Fb")
  })

  it("maps HTTP failures to ApiError codes", async () => {
    stubFetch(async () =>
      jsonResponse({ error: { code: "not_found", message: "no city" } }, 404),
    )
    await expect(fetchCity("x")).rejects.toMatchObject({ code: "http", status: 404 })

    stubFetch(async () =>
      jsonResponse({ error: { code: "rate_limited", message: "slow down" } }, 429),
    )
    await expect(fetchCity("x")).rejects.toMatchObject({
      code: "rate_limited",
      status: 429,
    })

    stubFetch(async () =>
      jsonResponse({ error: { code: "upstream_unavailable", message: "down" } }, 502),
    )
    await expect(fetchCity("x")).rejects.toMatchObject({ code: "upstream", status: 502 })

    stubFetch(async () =>
      jsonResponse({ error: { code: "parse_failed", message: "bad html" } }, 502),
    )
    await expect(fetchCity("x")).rejects.toMatchObject({ code: "upstream" })
  })

  it("maps a schema-invalid city payload to invalid", async () => {
    stubFetch(async () =>
      jsonResponse({
        city: { ...cityRecord, monthly_net_salary: "much" },
        cached: false,
        stale: false,
      }),
    )
    await expect(fetchCity("x")).rejects.toMatchObject({ code: "invalid" })
  })

  it("maps a non-JSON 200 body to invalid", async () => {
    stubFetch(async () => new Response("<html>oops</html>", { status: 200 }))
    await expect(fetchCity("x")).rejects.toMatchObject({ code: "invalid" })
  })

  it("maps a thrown non-Error to network", async () => {
    stubFetch(async () => {
      throw "offline"
    })
    await expect(fetchCity("x")).rejects.toBeInstanceOf(ApiError)
    await expect(fetchCity("x")).rejects.toMatchObject({ code: "network" })
  })

  it("maps an internal timeout to timeout", async () => {
    vi.useFakeTimers()
    stubFetch(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"))
          })
        }),
    )
    const request = fetchCity("x")
    const assertion = expect(request).rejects.toMatchObject({ code: "timeout" })
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)
    await assertion
  })

  it("normalizes an unencodable id to invalid", async () => {
    await expect(fetchCity("\uD800")).rejects.toMatchObject({ code: "invalid" })
  })

  it("normalizes an external abort to an ApiError", async () => {
    stubFetch((_input, init) => {
      return new Promise((_resolve, reject) => {
        const fail = () => reject(new DOMException("Aborted", "AbortError"))
        if (init?.signal?.aborted) fail()
        else init?.signal?.addEventListener("abort", fail)
      })
    })
    const controller = new AbortController()
    const request = fetchCity("x", controller.signal)
    controller.abort()
    await expect(request).rejects.toBeInstanceOf(ApiError)
  })
})

describe("searchCities", () => {
  it("requests /api/search and maps results to catalog cities", async () => {
    const results = [
      { id: "city_2", label: "Porto, Portugal", name: "Porto", country: "Portugal" },
      { id: "city_3", label: "Porto Alegre, Brazil", name: "Porto Alegre", country: "Brazil" },
    ]
    const fetchMock = stubFetch(async () => jsonResponse({ query: "porto", results }))
    await expect(searchCities("porto")).resolves.toEqual([
      { id: "city_2", name: "Porto", country: "Portugal" },
      { id: "city_3", name: "Porto Alegre", country: "Brazil" },
    ])
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/search?q=porto")
  })

  it("encodes the search term", async () => {
    const term = "são paulo"
    const fetchMock = stubFetch(async () => jsonResponse({ query: term, results: [] }))
    await searchCities(term)
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`/api/search?q=${encodeURIComponent(term)}`)
  })

  it("maps rate limiting to rate_limited", async () => {
    stubFetch(async () =>
      jsonResponse({ error: { code: "rate_limited", message: "slow down" } }, 429),
    )
    await expect(searchCities("x")).rejects.toMatchObject({ code: "rate_limited" })
  })

  it("rejects results that do not look like catalog cities", async () => {
    stubFetch(async () =>
      jsonResponse({ query: "x", results: [{ id: "city_1", country: "Portugal" }] }),
    )
    await expect(searchCities("x")).rejects.toMatchObject({ code: "invalid" })
  })
})
