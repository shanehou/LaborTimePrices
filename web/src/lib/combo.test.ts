import { describe, expect, it } from "vitest"
import { ITEMS } from "../data/items"
import { comboDetail } from "./combo"
import type { CityRecord } from "./types"

function city(id: string, prices: { item: string; price_usd: number }[]): CityRecord {
  return {
    id,
    name: id,
    country: "Nowhere",
    monthly_net_salary: 1000,
    prices: prices.map((price) => ({ category: "Restaurants", ...price })),
  }
}

describe("comboDetail", () => {
  it("multiplies the listed price by the quantity for each city", () => {
    expect(
      comboDetail([{ item: ITEMS.coffee, quantity: 3 }], [
        city("a", [{ item: ITEMS.coffee, price_usd: 4.5 }]),
      ]),
    ).toEqual([{ item: ITEMS.coffee, quantity: 3, byCity: { a: 13.5 } }])
  })

  it("uses null for an item a city did not report", () => {
    const rows = comboDetail(
      [
        { item: ITEMS.coffee, quantity: 1 },
        { item: ITEMS.internet, quantity: 2 },
      ],
      [
        city("a", [{ item: ITEMS.coffee, price_usd: 4.5 }]),
        city("b", [
          { item: ITEMS.coffee, price_usd: 5 },
          { item: ITEMS.internet, price_usd: 10 },
        ]),
      ],
    )
    expect(rows[0].byCity).toEqual({ a: 4.5, b: 5 })
    expect(rows[1].byCity).toEqual({ a: null, b: 20 })
  })

  it("keeps line order and returns an empty list for an empty combo", () => {
    expect(comboDetail([], [city("a", [])])).toEqual([])
  })
})
