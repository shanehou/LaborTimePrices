import { describe, expect, it } from "vitest"
import { ITEMS, NUMBEO_ITEMS } from "../data/items"
import { emptyUsage, emptyUsageOverrides } from "./period"
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
    salaries: { 3781: 2500 },
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
      rates: { [car]: 3.5 },
      repayments: { [car]: "principal" },
    },
    usageOverrides: {
      ...emptyUsageOverrides(),
      years: { [area]: { 3781: 20 } },
      rates: { [area]: { 3781: 3.3, 2922: 6.5 } },
      repayments: { [car]: { 3781: "principal" } },
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

  it("round-trips per-city salaries and usage overrides", () => {
    const encoded = encodeShare(snapshot())
    expect(encoded).toContain("sa=3781%3A2500")
    expect(encoded).toContain("yc=")
    expect(encoded).toContain("irc=")
    expect(encoded).toContain("imc=")
    const decoded = decodeShare(encoded)
    expect(decoded?.salaries).toEqual({ 3781: 2500 })
    expect(decoded?.usageOverrides.years[area]).toEqual({ 3781: 20 })
    expect(decoded?.usageOverrides.rates[area]).toEqual({ 3781: 3.3, 2922: 6.5 })
    expect(decoded?.usageOverrides.repayments[car]).toEqual({ 3781: "principal" })
  })

  it("drops usage overrides for cities that are not in the link", () => {
    const encoded = encodeShare(
      snapshot({
        cities: [{ id: "2922", name: "New York" }],
        usageOverrides: {
          ...emptyUsageOverrides(),
          rates: { [area]: { 3781: 3.3, 2922: 6.5 } },
        },
      }),
    )
    const decoded = decodeShare(encoded)
    expect(decoded?.usageOverrides.rates[area]).toEqual({ 2922: 6.5 })
  })

  it("ignores malformed per-city triples and salaries", () => {
    const carIndex = NUMBEO_ITEMS.indexOf(car)
    const areaIndex = NUMBEO_ITEMS.indexOf(area)
    const decoded = decodeShare(
      `#s=1&c=3781&n=Shanghai&sa=3781:0|bad|2922:99` +
        `&yc=${carIndex}:3781:20|x:1:5|${carIndex}:nope` +
        `&irc=${areaIndex}:3781:-1&imc=${carIndex}:3781:zz`,
    )
    expect(decoded?.salaries).toEqual({ 2922: 99 })
    expect(decoded?.usageOverrides.years[car]).toEqual({ 3781: 20 })
    expect(decoded?.usageOverrides.rates).toEqual({})
    expect(decoded?.usageOverrides.repayments).toEqual({})
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
    expect(decodeShare("s=1")?.usage.rates).toEqual({})
    expect(decodeShare("s=1")?.usage.repayments).toEqual({})
    expect(encoded.match(/b=/g)).toHaveLength(1)
  })
})
