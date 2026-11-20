import { describe, expect, it } from "vitest"
import { ITEMS } from "../data/items"
import {
  DEFAULT_MONTHLY_HOURS,
  evaluateBasket,
  findPrice,
  groupCatalog,
  laborHoursForPrice,
  listCatalog,
  rankCities,
  resolveMonthlyHours,
  resolveMonthlyNetSalary,
} from "./labor"
import type { CityRecord } from "./types"

function city(partial: Partial<CityRecord> & Pick<CityRecord, "id">): CityRecord {
  return {
    name: partial.id,
    country: "Test",
    monthly_net_salary: 3000,
    prices: [{ category: "Restaurants", item: ITEMS.coffee, price_usd: 5 }],
    ...partial,
  }
}

describe("labor hours", () => {
  it("divides the listed price by the hourly wage", () => {
    expect(laborHoursForPrice(5, 3000, 150)).toBeCloseTo(0.25)
    const result = evaluateBasket(city({ id: "demo", monthly_work_hours: 150 }), [
      { item: ITEMS.coffee, quantity: 1 },
    ])
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.hours).toBeCloseTo(0.25)
  })

  it("uses 173.3 hours when a city does not set them", () => {
    const resolved = resolveMonthlyHours({}, undefined)
    expect(resolved).toEqual({ ok: true, hours: DEFAULT_MONTHLY_HOURS, source: "default" })
    expect(DEFAULT_MONTHLY_HOURS).toBe(173.3)
  })

  it("uses the city hours unless this visitor stored an override", () => {
    expect(resolveMonthlyHours({ monthly_work_hours: 162 }, undefined)).toEqual({
      ok: true,
      hours: 162,
      source: "city",
    })
    expect(resolveMonthlyHours({ monthly_work_hours: 162 }, 80)).toEqual({
      ok: true,
      hours: 80,
      source: "visitor",
    })
  })

  it("does not apply one city's visitor hours to another city", () => {
    const overrides: Record<string, number | undefined> = { zurich: 80 }
    const shanghai = resolveMonthlyHours({}, overrides.shanghai)
    const zurich = resolveMonthlyHours({ monthly_work_hours: 162 }, overrides.zurich)
    expect(shanghai).toMatchObject({ hours: 173.3, source: "default" })
    expect(zurich).toMatchObject({ hours: 80, source: "visitor" })
  })

  it("excludes non-positive salary, missing salary, and non-positive hours", () => {
    expect(evaluateBasket(city({ id: "zero", monthly_net_salary: 0 }), [{ item: ITEMS.coffee, quantity: 1 }])).toEqual({
      ok: false,
      reason: { code: "non_positive_salary" },
    })
    expect(
      evaluateBasket(city({ id: "neg", monthly_net_salary: -10 }), [{ item: ITEMS.coffee, quantity: 1 }]),
    ).toEqual({ ok: false, reason: { code: "non_positive_salary" } })
    expect(
      evaluateBasket(city({ id: "missing", monthly_net_salary: null }), [{ item: ITEMS.coffee, quantity: 1 }]),
    ).toEqual({ ok: false, reason: { code: "missing_salary" } })
    expect(
      evaluateBasket(city({ id: "hours", monthly_work_hours: 0 }), [{ item: ITEMS.coffee, quantity: 1 }]),
    ).toEqual({ ok: false, reason: { code: "non_positive_hours" } })
    expect(resolveMonthlyHours({ monthly_work_hours: -5 }, undefined)).toEqual({
      ok: false,
      reason: { code: "non_positive_hours" },
    })
  })

  it("keeps a yearly price whole instead of dividing it by 12", () => {
    const yearly = 12000
    const salary = 2400
    const hours = 160
    const sample = city({
      id: "school",
      monthly_net_salary: salary,
      monthly_work_hours: hours,
      prices: [{ category: "Education", item: ITEMS.school, price_usd: yearly }],
    })
    const result = evaluateBasket(sample, [{ item: ITEMS.school, quantity: 1 }])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const hourly = salary / hours
    expect(result.hours).toBeCloseTo(yearly / hourly)
    expect(result.hours).not.toBeCloseTo(yearly / 12 / hourly)
    expect(result.hours).toBeGreaterThan((yearly / 12 / hourly) * 10)
  })

  it("sums a basket as price times quantity, then divides by the hourly wage", () => {
    const sample = city({
      id: "basket",
      monthly_net_salary: 2000,
      monthly_work_hours: 100,
      prices: [
        { category: "Housing", item: ITEMS.rentOutside, price_usd: 1000 },
        { category: "Utilities", item: ITEMS.utilities, price_usd: 100 },
        { category: "Utilities", item: ITEMS.internet, price_usd: 40 },
        { category: "Transport", item: ITEMS.transit, price_usd: 60 },
      ],
    })
    const lines = [
      { item: ITEMS.rentOutside, quantity: 1 },
      { item: ITEMS.utilities, quantity: 1 },
      { item: ITEMS.internet, quantity: 1 },
      { item: ITEMS.transit, quantity: 1 },
    ]
    const result = evaluateBasket(sample, lines)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const wage = 2000 / 100
    expect(result.totalUsd).toBe(1200)
    expect(result.hours).toBeCloseTo(1200 / wage)
    const parts = [1000, 100, 40, 60].map((price) => price / wage)
    expect(result.hours).toBeCloseTo(parts.reduce((sum, hours) => sum + hours, 0))

    const doubled = evaluateBasket(sample, [
      { item: ITEMS.rentOutside, quantity: 2 },
      { item: ITEMS.utilities, quantity: 1 },
    ])
    expect(doubled.ok).toBe(true)
    if (!doubled.ok) return
    expect(doubled.totalUsd).toBe(2100)
    expect(doubled.hours).toBeCloseTo(2100 / wage)
  })

  it("uses the Numbeo salary unless this visitor stored one", () => {
    expect(resolveMonthlyNetSalary({ monthly_net_salary: 2400 }, undefined)).toEqual({
      ok: true,
      salary: 2400,
      source: "numbeo",
    })
    expect(resolveMonthlyNetSalary({ monthly_net_salary: 2400 }, 3000)).toEqual({
      ok: true,
      salary: 3000,
      source: "visitor",
    })
    expect(resolveMonthlyNetSalary({ monthly_net_salary: null }, 3000)).toEqual({
      ok: true,
      salary: 3000,
      source: "visitor",
    })
    expect(resolveMonthlyNetSalary({ monthly_net_salary: null }, undefined)).toEqual({
      ok: false,
      reason: { code: "missing_salary" },
    })
    expect(resolveMonthlyNetSalary({ monthly_net_salary: 2400 }, 0)).toEqual({
      ok: false,
      reason: { code: "non_positive_salary" },
    })
  })

  it("keeps each city's hours and salary sources through the ranking", () => {
    const baseline = city({ id: "baseline", monthly_work_hours: 100, monthly_net_salary: 2000 })
    const adjusted = city({ id: "adjusted", monthly_work_hours: 100, monthly_net_salary: 2000 })
    const { ranked } = rankCities(
      [baseline, adjusted],
      [{ item: ITEMS.coffee, quantity: 1 }],
      {},
      undefined,
      undefined,
      { adjusted: 4000 },
    )
    expect(ranked.find((row) => row.city.id === "baseline")).toMatchObject({
      source: "city",
      salarySource: "numbeo",
    })
    expect(ranked.find((row) => row.city.id === "adjusted")).toMatchObject({
      source: "city",
      salarySource: "visitor",
    })
  })

  it("prices with the visitor salary for that city only", () => {
    const sample = city({ id: "demo", monthly_work_hours: 100, monthly_net_salary: 2000 })
    const baseline = evaluateBasket(sample, [{ item: ITEMS.coffee, quantity: 1 }])
    expect(baseline.ok).toBe(true)
    if (baseline.ok) expect(baseline.hours).toBeCloseTo(5 / 20)

    const raised = evaluateBasket(sample, [{ item: ITEMS.coffee, quantity: 1 }], undefined, undefined, undefined, 4000)
    expect(raised.ok).toBe(true)
    if (raised.ok) {
      expect(raised.hourlyWage).toBe(40)
      expect(raised.hours).toBeCloseTo(5 / 40)
    }

    const { ranked } = rankCities(
      [sample, city({ id: "other", monthly_work_hours: 100, monthly_net_salary: 2000 })],
      [{ item: ITEMS.coffee, quantity: 1 }],
      {},
      undefined,
      undefined,
      { demo: 8000 },
    )
    const demo = ranked.find((row) => row.city.id === "demo")
    const other = ranked.find((row) => row.city.id === "other")
    expect(demo?.hourlyWage).toBe(80)
    expect(other?.hourlyWage).toBe(20)
    expect(demo?.salarySource).toBe("visitor")
    expect(other?.salarySource).toBe("numbeo")
  })

  it("drops a city with a missing salary or a non-positive price from the ranking", () => {
    const good = city({ id: "good", name: "Good", monthly_work_hours: 100, monthly_net_salary: 2000 })
    const unpaid = city({
      id: "unpaid",
      name: "Unpaid",
      monthly_net_salary: null,
      prices: [{ category: "Restaurants", item: ITEMS.coffee, price_usd: 1 }],
    })
    const freeCoffee = city({
      id: "free",
      name: "Free",
      monthly_work_hours: 100,
      monthly_net_salary: 2000,
      prices: [{ category: "Restaurants", item: ITEMS.coffee, price_usd: 0 }],
    })
    const { ranked, excluded } = rankCities(
      [freeCoffee, unpaid, good],
      [{ item: ITEMS.coffee, quantity: 1 }],
      {},
    )
    expect(ranked.map((row) => row.city.id)).toEqual(["good"])
    expect(excluded.map((row) => [row.city.id, row.reason.code])).toEqual([
      ["free", "non_positive_price"],
      ["unpaid", "missing_salary"],
    ])
    expect(ranked[0]?.hours).toBeCloseTo(5 / (2000 / 100))
  })

  it("ranks the remaining cities by labor hours ascending", () => {
    const expensive = city({
      id: "expensive",
      name: "Expensive",
      monthly_net_salary: 1000,
      monthly_work_hours: 100,
      prices: [{ category: "Restaurants", item: ITEMS.coffee, price_usd: 10 }],
    })
    const cheap = city({
      id: "cheap",
      name: "Cheap",
      monthly_net_salary: 4000,
      monthly_work_hours: 100,
      prices: [{ category: "Restaurants", item: ITEMS.coffee, price_usd: 4 }],
    })
    const { ranked } = rankCities([expensive, cheap], [{ item: ITEMS.coffee, quantity: 1 }], {})
    expect(ranked.map((row) => row.city.id)).toEqual(["cheap", "expensive"])
    expect(ranked[0]!.hours).toBeLessThan(ranked[1]!.hours)
  })
})

describe("catalog helpers", () => {
  it("finds the canonical price and falls back to its imperial alias", () => {
    const metricAndImperial = city({
      id: "both",
      prices: [
        { category: "Markets", item: "Apples (1 lb)", price_usd: 1.03 },
        { category: "Markets", item: "Apples (1 kg)", price_usd: 2.27 },
      ],
    })
    const imperialOnly = city({
      id: "imperial",
      prices: [{ category: "Markets", item: "Apples (1 lb)", price_usd: 1.03 }],
    })

    expect(findPrice(metricAndImperial, "Apples (1 kg)")?.price_usd).toBe(2.27)
    expect(findPrice(metricAndImperial, "Apples (1 lb)")?.price_usd).toBe(2.27)
    expect(findPrice(imperialOnly, "Apples (1 kg)")?.price_usd).toBe(1.03)
    expect(findPrice(imperialOnly, "Milk (Regular, 1 Liter)")).toBeUndefined()
  })

  it("builds a deduplicated catalog in first-seen order", () => {
    const first = city({
      id: "first",
      prices: [
        { category: "Restaurants", item: ITEMS.coffee, price_usd: 5 },
        { category: "Markets", item: "Apples (1 lb)", price_usd: 1.03 },
        { category: "Rent Per Month", item: ITEMS.rentOutside, price_usd: 900 },
      ],
    })
    const second = city({
      id: "second",
      prices: [
        { category: "Restaurants", item: ITEMS.coffee, price_usd: 4 },
        { category: "Markets", item: "Apples (1 kg)", price_usd: 2.27 },
        { category: "Transportation", item: ITEMS.transit, price_usd: 40 },
      ],
    })

    expect(listCatalog([first, second])).toEqual([
      { category: "Restaurants", item: ITEMS.coffee },
      { category: "Markets", item: "Apples (1 kg)" },
      { category: "Rent Per Month", item: ITEMS.rentOutside },
      { category: "Transportation", item: ITEMS.transit },
    ])
  })

  it("groups catalog entries by category and preserves their order", () => {
    expect(
      groupCatalog([
        { category: "Restaurants", item: "coffee" },
        { category: "Markets", item: "apples" },
        { category: "Restaurants", item: "meal" },
        { category: "Housing", item: "rent" },
        { category: "Markets", item: "milk" },
      ]),
    ).toEqual([
      { category: "Restaurants", items: ["coffee", "meal"] },
      { category: "Markets", items: ["apples", "milk"] },
      { category: "Housing", items: ["rent"] },
    ])
    expect(groupCatalog([])).toEqual([])
  })
})
