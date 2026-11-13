import { describe, expect, it } from "vitest"
import { mockPrices } from "../data/mockPrices"
import { loadPrices } from "./loadPrices"

function jsonResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { "content-type": "application/json" },
  })
}

describe("loadPrices", () => {
  it("uses prices.json when the payload matches the schema", async () => {
    const payload = {
      cities: [
        {
          id: "oslo",
          name: "Oslo",
          country: "Norway",
          monthly_net_salary: 4200,
          prices: [{ category: "Restaurants", item: "Cappuccino", price_usd: 5 }],
        },
      ],
    }
    const fetchImpl: typeof fetch = async () => jsonResponse(JSON.stringify(payload))
    const loaded = await loadPrices(fetchImpl)
    expect(loaded.origin).toBe("prices.json")
    expect(loaded.dataset.cities[0]?.id).toBe("oslo")
  })

  it("falls back to the mock when the file is missing, invalid, or the request fails", async () => {
    const missing = await loadPrices(async () => jsonResponse("nope", 404))
    expect(missing.origin).toBe("mock")
    expect(missing.reason).toBe("missing")
    expect(missing.dataset.cities.map((city) => city.id)).toEqual(
      mockPrices.cities.map((city) => city.id),
    )

    const broken = await loadPrices(async () => jsonResponse("{"))
    expect(broken.reason).toBe("invalid_json")

    const badShape = await loadPrices(async () => jsonResponse(JSON.stringify({ cities: {} })))
    expect(badShape.reason).toBe("invalid_schema")

    const http = await loadPrices(async () => jsonResponse("busy", 503))
    expect(http.reason).toBe("http")
    expect(http.detail).toBe("503")

    const network = await loadPrices(async () => {
      throw new Error("offline")
    })
    expect(network.reason).toBe("network")
    expect(network.origin).toBe("mock")
  })

  it("falls back when the request times out", async () => {
    const fetchImpl: typeof fetch = (_input, init) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve(jsonResponse("[]")), 1000)
        init?.signal?.addEventListener("abort", () => {
          clearTimeout(timer)
          reject(new DOMException("Aborted", "AbortError"))
        })
      })
    const loaded = await loadPrices(fetchImpl, 20)
    expect(loaded.origin).toBe("mock")
    expect(loaded.reason).toBe("timeout")
  })
})
