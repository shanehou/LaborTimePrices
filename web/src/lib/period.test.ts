import { describe, expect, it } from "vitest"
import { ITEM_CADENCE, cadenceOf } from "../data/cadence"
import { ITEMS, NUMBEO_ITEMS } from "../data/items"
import { evaluateBasket } from "./labor"
import { emptyUsage, fillEmptyUsage, lineSpendUsd, setUsageNumber, type PeriodContext } from "./period"
import type { CityRecord } from "./types"

const car = "Volkswagen Golf 1.5 (or Equivalent New Compact Car)"
const area = "Price per Square Meter to Buy Apartment in City Centre"

function city(prices: { item: string; price_usd: number }[]): CityRecord {
  return {
    id: "demo",
    name: "Demo",
    country: "Test",
    monthly_net_salary: 2400,
    monthly_work_hours: 160,
    prices: prices.map((price) => ({ category: "Test", ...price })),
  }
}

describe("cadence", () => {
  it("classifies every Numbeo item and the known billing shapes", () => {
    expect(Object.keys(ITEM_CADENCE)).toHaveLength(NUMBEO_ITEMS.length)
    expect(cadenceOf(ITEMS.coffee)).toBe("unit")
    expect(cadenceOf(ITEMS.rentOutside)).toBe("monthly")
    expect(cadenceOf(ITEMS.transit)).toBe("monthly")
    expect(cadenceOf(ITEMS.school)).toBe("yearly")
    expect(cadenceOf(car)).toBe("asset")
    expect(cadenceOf(area)).toBe("assetArea")
    expect(cadenceOf("Something New")).toBe("unit")
  })
})

describe("lineSpendUsd", () => {
  const listed: PeriodContext = { horizon: "listed", mode: "single", usage: emptyUsage() }

  it("keeps the listed price times quantity", () => {
    const spent = lineSpendUsd(12000, ITEMS.school, 1, listed)
    expect(spent).toEqual({ ok: true, usd: 12000 })
    const result = evaluateBasket(city([{ item: ITEMS.school, price_usd: 12000 }]), [
      { item: ITEMS.school, quantity: 1 },
    ])
    expect(result.ok && result.totalUsd).toBe(12000)
  })

  it("converts a yearly fee to a month and a monthly bill to a year", () => {
    const month: PeriodContext = { horizon: "month", mode: "combo", usage: emptyUsage() }
    const year: PeriodContext = { horizon: "year", mode: "combo", usage: emptyUsage() }
    expect(lineSpendUsd(12000, ITEMS.school, 1, month)).toEqual({ ok: true, usd: 1000 })
    expect(lineSpendUsd(1500, ITEMS.rentOutside, 2, year)).toEqual({ ok: true, usd: 36000 })
    const result = evaluateBasket(
      city([{ item: ITEMS.school, price_usd: 12000 }]),
      [{ item: ITEMS.school, quantity: 1 }],
      undefined,
      month,
    )
    expect(result.ok && result.hours).toBeCloseTo(1000 / (2400 / 160))
  })

  it("uses times for a single unit and quantity for a combo unit", () => {
    const bare: PeriodContext = { horizon: "month", mode: "single", usage: emptyUsage() }
    expect(lineSpendUsd(4, ITEMS.coffee, 1, bare)).toEqual({
      ok: false,
      reason: { code: "needs_times", item: ITEMS.coffee },
    })
    const withTimes = setUsageNumber(emptyUsage(), "times", ITEMS.coffee, 30)
    const single: PeriodContext = { horizon: "month", mode: "single", usage: withTimes }
    expect(lineSpendUsd(4, ITEMS.coffee, 2, single)).toEqual({ ok: true, usd: 120 })
    const combo: PeriodContext = { horizon: "year", mode: "combo", usage: emptyUsage() }
    expect(lineSpendUsd(4, ITEMS.coffee, 30, combo)).toEqual({ ok: true, usd: 120 })
  })

  it("straight-line amortizes a car and a price per square meter", () => {
    const missing: PeriodContext = { horizon: "month", mode: "single", usage: emptyUsage() }
    expect(lineSpendUsd(30000, car, 1, missing)).toEqual({ ok: true, usd: 250 })
    const years = setUsageNumber(emptyUsage(), "years", car, 10)
    const carPeriod: PeriodContext = { horizon: "month", mode: "single", usage: years }
    expect(lineSpendUsd(30000, car, 1, carPeriod)).toEqual({ ok: true, usd: 250 })

    const areaOnly = setUsageNumber(emptyUsage(), "area", area, 70)
    const noYears: PeriodContext = { horizon: "month", mode: "single", usage: areaOnly }
    expect(lineSpendUsd(15000, area, 1, noYears)).toEqual({ ok: true, usd: 8750 })
    const ready = setUsageNumber(areaOnly, "years", area, 20)
    const home: PeriodContext = { horizon: "month", mode: "single", usage: ready }
    expect(lineSpendUsd(15000, area, 1, home)).toEqual({ ok: true, usd: 4375 })

    const combo: PeriodContext = { horizon: "year", mode: "combo", usage: ready }
    expect(lineSpendUsd(15000, area, 70, combo)).toEqual({ ok: true, usd: 52500 })
  })

  it("fills empty counts and years without overwriting", () => {
    const start = setUsageNumber(emptyUsage(), "times", ITEMS.coffee, 5)
    const filled = fillEmptyUsage(start, "times", 9)
    expect(filled.times[ITEMS.coffee]).toBe(5)
    expect(filled.times["Milk (Regular, 1 Liter)"]).toBe(9)
    expect(filled.times[ITEMS.rentOutside]).toBeUndefined()
    const years = fillEmptyUsage(emptyUsage(), "years", 20)
    expect(years.years[car]).toBe(20)
    expect(years.years[area]).toBe(20)
    expect(years.years[ITEMS.coffee]).toBeUndefined()
    expect(fillEmptyUsage(years, "years", 8).years[car]).toBe(20)
  })
})
