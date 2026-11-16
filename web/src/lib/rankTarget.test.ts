import { describe, expect, it } from "vitest"
import { ITEMS } from "../data/items"
import { linesForTarget } from "./rankTarget"

describe("linesForTarget", () => {
  it("matches basket items by the English name and keeps quantity at 1", () => {
    expect(linesForTarget("basket:monthly-living", {}).map((line) => line.item)).toEqual([
      ITEMS.rentOutside,
      ITEMS.utilities,
      ITEMS.internet,
      ITEMS.transit,
    ])
    expect(
      linesForTarget("basket:monthly-living", {}).every((line) => line.quantity === 1),
    ).toBe(true)
    expect(linesForTarget(`item:${ITEMS.coffee}`, {})).toEqual([
      { item: ITEMS.coffee, quantity: 1 },
    ])
  })

  it("sums only checked custom lines", () => {
    const lines = linesForTarget("basket:custom", {
      [ITEMS.coffee]: { checked: true, quantity: "2" },
      [ITEMS.internet]: { checked: false, quantity: "4" },
    })
    expect(lines).toEqual([{ item: ITEMS.coffee, quantity: 2 }])
  })
})
