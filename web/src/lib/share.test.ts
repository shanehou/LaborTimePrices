import { describe, expect, it } from "vitest"
import { ITEMS, NUMBEO_ITEMS } from "../data/items"
import { emptyUsage } from "./period"
import { decodeShare, encodeShare, type ShareSnapshot } from "./share"

const car = "Volkswagen Golf 1.5 (or Equivalent New Compact Car)"
const area = "Price per Square Meter to Buy Apartment in City Centre"

function snapshot(partial: Partial<ShareSnapshot> = {}): ShareSnapshot {
  return {
    cities: [
      { id: "3781", name: "Shanghai" },
      { id: "2922", name: "New York" },
    ],
    hours: { 3781: 160 },
    lang: "zh",
    tab: "combos",
    unit: "usd",
    horizon: "month",
    itemTarget: `item:${ITEMS.coffee}`,
    comboTarget: "basket:custom",
    custom: {
      [ITEMS.coffee]: { checked: true, quantity: "30" },
    },
    customName: "两人的月",
    currency: "USD",
    usage: {
      ...emptyUsage(),
      times: { [ITEMS.coffee]: 30 },
      years: { [car]: 10 },
      area: { [area]: 70 },
    },
    ...partial,
  }
}

describe("share hash", () => {
  it("round-trips the selection without prices", () => {
    const encoded = encodeShare(snapshot())
    expect(encoded).not.toContain("12000")
    expect(encoded).not.toContain("price")
    const decoded = decodeShare(`#${encoded}`)
    expect(decoded).toEqual(snapshot())
  })

  it("keeps a city name that contains a comma or CJK text", () => {
    const encoded = encodeShare(
      snapshot({
        cities: [{ id: "9", name: "Washington, D.C." }, { id: "1", name: "上海" }],
        hours: {},
      }),
    )
    expect(decodeShare(encoded)?.cities).toEqual([
      { id: "9", name: "Washington, D.C." },
      { id: "1", name: "上海" },
    ])
  })

  it("uses the city id when a name is missing and ignores a broken hash", () => {
    const decoded = decodeShare("#s=1&c=7|8&n=Only")
    expect(decoded?.cities).toEqual([
      { id: "7", name: "Only" },
      { id: "8", name: "8" },
    ])
    expect(decodeShare("")).toBeNull()
    expect(decodeShare("#nope")).toBeNull()
    expect(decodeShare("#s=2&t=items")).toBeNull()
  })

  it("drops an item index that is outside the catalog", () => {
    const encoded = `s=1&r=${NUMBEO_ITEMS.length}:4&b=${NUMBEO_ITEMS.length}:2&it=${NUMBEO_ITEMS.length}`
    const decoded = decodeShare(encoded)
    expect(decoded?.usage.times).toEqual({})
    expect(decoded?.custom).toEqual({})
    expect(decoded?.itemTarget).toBe(`item:${ITEMS.coffee}`)
  })

  it("keeps a display currency and defaults an old link to USD", () => {
    const encoded = encodeShare(snapshot({ currency: "CNY" }))
    expect(encoded).toContain("cur=CNY")
    expect(decodeShare(encoded)?.currency).toBe("CNY")
    expect(decodeShare("s=1")?.currency).toBe("USD")
    expect(encoded.match(/b=/g)).toHaveLength(1)
  })
})
