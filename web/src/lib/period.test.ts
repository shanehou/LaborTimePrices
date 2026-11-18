import { describe, expect, it } from "vitest"
import { ITEM_CADENCE, cadenceOf } from "../data/cadence"
import { ITEMS, NUMBEO_ITEMS } from "../data/items"
import { evaluateBasket } from "./labor"
import {
  DEFAULT_PURCHASE_YEARS,
  emptyUsage,
  emptyUsageOverrides,
  fillEmptyUsage,
  lineSpendUsd,
  MORTGAGE_TERM_YEARS,
  resolveFinancing,
  setUsageNumber,
  setUsageOverrideNumber,
  setUsageOverrideRepayment,
  setUsageRepayment,
  usageOverrideCityIds,
  type PeriodContext,
} from "./period"
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

  it("keeps a straight line when the rate is empty and prices a loan when it is set", () => {
    const straight = setUsageRepayment(
      setUsageNumber(emptyUsage(), "years", car, 10),
      car,
      "principal",
    )
    const straightPeriod: PeriodContext = { horizon: "month", mode: "single", usage: straight }
    expect(lineSpendUsd(30000, car, 1, straightPeriod)).toEqual({ ok: true, usd: 250 })

    const principal = setUsageNumber(straight, "rates", car, 6)
    const principalMonth: PeriodContext = { horizon: "month", mode: "single", usage: principal }
    expect(lineSpendUsd(120000, car, 1, principalMonth)).toEqual({
      ok: true,
      usd: expect.closeTo(1302.5, 5),
    })
    const principalYear: PeriodContext = { horizon: "year", mode: "combo", usage: principal }
    expect(lineSpendUsd(120000, car, 2, principalYear)).toEqual({
      ok: true,
      usd: expect.closeTo(31260, 4),
    })

    const installment = setUsageRepayment(principal, car, "payment")
    const installmentMonth: PeriodContext = { horizon: "month", mode: "single", usage: installment }
    const growth = 1.005 ** 120
    const monthly = (120000 * 0.005 * growth) / (growth - 1)
    expect(lineSpendUsd(120000, car, 1, installmentMonth)).toEqual({
      ok: true,
      usd: expect.closeTo(monthly, 6),
    })

    const fractional = setUsageNumber(installment, "years", car, 10.4)
    const fractionalPeriod: PeriodContext = { horizon: "month", mode: "single", usage: fractional }
    const months = 125
    const rate = 0.06 / 12
    const grown = (1 + rate) ** months
    const expected = (12000 * rate * grown) / (grown - 1)
    expect(lineSpendUsd(12000, car, 1, fractionalPeriod)).toEqual({
      ok: true,
      usd: expect.closeTo(expected, 6),
    })
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

describe("per-city financing", () => {
  const shanghai = { id: "3781", mortgage_rate: 3.3 as number | null }
  const zurich = { id: "1064", mortgage_rate: null }
  const lisbon = { id: "5", mortgage_rate: null }

  it("resolves visitor-city > shared > Numbeo rate > nothing", () => {
    const usage = setUsageNumber(emptyUsage(), "rates", car, 5)
    expect(resolveFinancing(car, usage).rate).toBe(5)
    expect(resolveFinancing(car, usage, shanghai).rate).toBe(5)
    const overrides = setUsageOverrideNumber(emptyUsageOverrides(), "rates", car, "3781", 6.2)
    expect(resolveFinancing(car, usage, shanghai, overrides).rate).toBe(6.2)
    expect(resolveFinancing(car, usage, zurich, overrides).rate).toBe(5)

    const bare = emptyUsage()
    expect(resolveFinancing(car, bare).rate).toBeUndefined()
    expect(resolveFinancing(car, bare, zurich).rate).toBeUndefined()
    expect(resolveFinancing(car, bare, shanghai).rate).toBe(3.3)
  })

  it("pairs Numbeo's rate with its 20-year term only when years are unset", () => {
    const bare = emptyUsage()
    expect(resolveFinancing(car, bare, shanghai)).toMatchObject({
      years: MORTGAGE_TERM_YEARS,
      rate: 3.3,
      rateSource: "city",
      citySpecific: true,
    })
    expect(resolveFinancing(car, bare, zurich).years).toBe(DEFAULT_PURCHASE_YEARS)

    const sharedYears = setUsageNumber(bare, "years", car, 8)
    expect(resolveFinancing(car, sharedYears, shanghai).years).toBe(8)

    const cityYears = setUsageOverrideNumber(emptyUsageOverrides(), "years", car, "3781", 15)
    expect(resolveFinancing(car, sharedYears, shanghai, cityYears).years).toBe(15)
  })

  it("marks city-specific resolution and lists overridden cities", () => {
    const overrides = emptyUsageOverrides()
    expect(resolveFinancing(car, emptyUsage(), shanghai).citySpecific).toBe(true)
    expect(resolveFinancing(car, emptyUsage(), zurich).citySpecific).toBe(false)
    const withRepayment = setUsageOverrideRepayment(overrides, car, "1064", "principal")
    expect(resolveFinancing(car, emptyUsage(), zurich, withRepayment)).toMatchObject({
      repayment: "principal",
      citySpecific: true,
    })
    expect(usageOverrideCityIds(withRepayment, car)).toEqual(["1064"])
  })

  it("uses per-city years, rate, repayment, and area in the spend", () => {
    const usage = setUsageNumber(emptyUsage(), "years", area, 10)
    const base: PeriodContext = { horizon: "month", mode: "combo", usage }
    // 15000/m² × 70 m² over 10 years, straight line: 8750 / month.
    expect(lineSpendUsd(15000, area, 70, base)).toEqual({ ok: true, usd: 8750 })

    const overrides = setUsageOverrideNumber(emptyUsageOverrides(), "area", area, "5", 90)
    const lisbonPeriod: PeriodContext = {
      ...base,
      city: lisbon,
      overrides: setUsageOverrideNumber(overrides, "years", area, "5", 20),
    }
    expect(lineSpendUsd(15000, area, 70, lisbonPeriod)).toEqual({ ok: true, usd: 5625 })

    const zurichPeriod: PeriodContext = { ...base, city: zurich, overrides }
    expect(lineSpendUsd(15000, area, 70, zurichPeriod)).toEqual({ ok: true, usd: 8750 })
  })

  it("finances with the Numbeo rate and term inside evaluateBasket", () => {
    const sample: CityRecord = {
      id: "3781",
      name: "Shanghai",
      country: "China",
      monthly_net_salary: 2400,
      monthly_work_hours: 160,
      mortgage_rate: 3.3,
      prices: [{ category: "Buy Apartment Price", item: area, price_usd: 15000 }],
    }
    const period: PeriodContext = { horizon: "month", mode: "combo", usage: emptyUsage() }
    const result = evaluateBasket(sample, [{ item: area, quantity: 70 }], undefined, period)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // 20-year fixed at 3.3% with the default equal installment: n = 240.
    const principal = 15000 * 70
    const months = 240
    const monthlyRate = 0.033 / 12
    const growth = (1 + monthlyRate) ** months
    const expected = (principal * monthlyRate * growth) / (growth - 1)
    expect(result.totalUsd).toBeCloseTo(expected, 6)
  })

  it("finances with equal principal when the city overrides the repayment", () => {
    const overrides = setUsageOverrideRepayment(emptyUsageOverrides(), area, "3781", "principal")
    const period: PeriodContext = {
      horizon: "month",
      mode: "combo",
      usage: emptyUsage(),
      city: { id: "3781", mortgage_rate: 3.3 },
      overrides,
    }
    const spent = lineSpendUsd(15000, area, 70, period)
    expect(spent.ok).toBe(true)
    if (!spent.ok) return
    const principal = 15000 * 70
    const months = 240
    const monthlyRate = 0.033 / 12
    const expected = principal / months + (principal * monthlyRate * (months + 1)) / (2 * months)
    expect(spent.usd).toBeCloseTo(expected, 6)
  })
})
