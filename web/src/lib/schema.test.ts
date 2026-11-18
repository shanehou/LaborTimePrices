import { describe, expect, it } from "vitest"
import { ITEMS } from "../data/items"
import { validateCatalogCity, validateCityRecord } from "./schema"

const validCity = {
  id: "city_1",
  name: "Lisbon",
  country: "Portugal",
  monthly_net_salary: 1450,
  prices: [
    { category: "Restaurants", item: ITEMS.coffee, price_usd: 1.9 },
    { category: "Rent Per Month", item: ITEMS.rentOutside, price_usd: 1000 },
  ],
  scraped_at: "2026-11-01T00:00:00.000Z",
  source_url: "https://www.numbeo.com/cost-of-living/in/Lisbon",
}

describe("validateCityRecord", () => {
  it("accepts one city record and keeps its optional metadata", () => {
    const validated = validateCityRecord(validCity)
    expect(validated.ok).toBe(true)
    if (!validated.ok) return
    expect(validated.city).toEqual(validCity)
  })

  it("treats a missing salary as absent rather than zero", () => {
    const validated = validateCityRecord({
      id: validCity.id,
      name: validCity.name,
      country: validCity.country,
      prices: validCity.prices,
    })
    expect(validated.ok).toBe(true)
    if (!validated.ok) return
    expect(validated.city.monthly_net_salary).toBeNull()
    expect(validated.city).not.toHaveProperty("scraped_at")
    expect(validated.city).not.toHaveProperty("monthly_work_hours")
  })

  it("keeps zero and negative salaries so ranking can explain them", () => {
    for (const salary of [0, -10]) {
      const validated = validateCityRecord({ ...validCity, monthly_net_salary: salary })
      expect(validated.ok).toBe(true)
      if (!validated.ok) continue
      expect(validated.city.monthly_net_salary).toBe(salary)
    }
  })

  it("keeps a single measurement and prefers the metric row when both are present", () => {
    const validated = validateCityRecord({
      ...validCity,
      prices: [
        { category: "Markets", item: "Apples (1 lb)", price_usd: 1.03 },
        {
          category: "Utilities (Monthly)",
          item: "Basic Utilities for 915 Square Feet Apartment (Electricity, Heating, Cooling, Water, Garbage)",
          price_usd: 10,
        },
        { category: "Utilities (Monthly)", item: ITEMS.utilities, price_usd: 59.47 },
      ],
    })
    expect(validated.ok).toBe(true)
    if (!validated.ok) return
    expect(validated.city.prices).toEqual([
      { category: "Markets", item: "Apples (1 lb)", price_usd: 1.03 },
      { category: "Utilities (Monthly)", item: ITEMS.utilities, price_usd: 59.47 },
    ])
  })

  it("keeps non-positive prices for the ranking to exclude", () => {
    const validated = validateCityRecord({
      ...validCity,
      prices: [{ category: "Restaurants", item: ITEMS.coffee, price_usd: 0 }],
    })
    expect(validated.ok).toBe(true)
    if (!validated.ok) return
    expect(validated.city.prices[0]?.price_usd).toBe(0)
  })

  it("accepts a finite monthly_work_hours and ignores null", () => {
    const withHours = validateCityRecord({ ...validCity, monthly_work_hours: 162 })
    expect(withHours.ok).toBe(true)
    if (withHours.ok) expect(withHours.city.monthly_work_hours).toBe(162)

    const withoutHours = validateCityRecord({ ...validCity, monthly_work_hours: null })
    expect(withoutHours.ok).toBe(true)
    if (withoutHours.ok) expect(withoutHours.city).not.toHaveProperty("monthly_work_hours")
  })

  it("accepts an optional mortgage_rate and ignores null", () => {
    const withRate = validateCityRecord({ ...validCity, mortgage_rate: 4.15 })
    expect(withRate.ok).toBe(true)
    if (withRate.ok) expect(withRate.city.mortgage_rate).toBe(4.15)

    const nullRate = validateCityRecord({ ...validCity, mortgage_rate: null })
    expect(nullRate.ok).toBe(true)
    if (nullRate.ok) expect(nullRate.city.mortgage_rate).toBeNull()

    // Like the salary, a finite number is kept (even non-positive) and the
    // financing resolution ignores values it cannot use.
    expect(validateCityRecord({ ...validCity, mortgage_rate: 0 }).ok).toBe(true)
    for (const bad of ["4.15", Number.NaN, { rate: 4 }]) {
      expect(validateCityRecord({ ...validCity, mortgage_rate: bad }).ok).toBe(false)
    }
  })

  it("rejects payloads that are not a city record", () => {
    for (const input of [null, undefined, [], "city", { cities: [] }]) {
      expect(validateCityRecord(input).ok).toBe(false)
    }
  })

  it("rejects empty id, name, country, category, and item", () => {
    for (const field of ["id", "name", "country"]) {
      expect(validateCityRecord({ ...validCity, [field]: "  " }).ok).toBe(false)
    }
    expect(
      validateCityRecord({
        ...validCity,
        prices: [{ category: "", item: ITEMS.coffee, price_usd: 1 }],
      }).ok,
    ).toBe(false)
    expect(
      validateCityRecord({
        ...validCity,
        prices: [{ category: "Restaurants", item: "", price_usd: 1 }],
      }).ok,
    ).toBe(false)
  })

  it("rejects NaN, Infinity, and non-numeric numbers", () => {
    for (const salary of [Number.NaN, Number.POSITIVE_INFINITY, "1500"]) {
      expect(validateCityRecord({ ...validCity, monthly_net_salary: salary }).ok).toBe(false)
    }
    expect(
      validateCityRecord({
        ...validCity,
        monthly_work_hours: Number.POSITIVE_INFINITY,
      }).ok,
    ).toBe(false)
    expect(
      validateCityRecord({
        ...validCity,
        prices: [{ category: "Restaurants", item: ITEMS.coffee, price_usd: Number.NaN }],
      }).ok,
    ).toBe(false)
  })

  it("rejects a malformed prices array", () => {
    expect(validateCityRecord({ ...validCity, prices: "nope" }).ok).toBe(false)
    expect(validateCityRecord({ ...validCity, prices: [null] }).ok).toBe(false)
  })

  it("rejects non-string scraped_at and source_url", () => {
    expect(validateCityRecord({ ...validCity, scraped_at: 4 }).ok).toBe(false)
    expect(validateCityRecord({ ...validCity, source_url: {} }).ok).toBe(false)
  })
})

describe("validateCatalogCity", () => {
  it("keeps only id, name, and country", () => {
    expect(
      validateCatalogCity({ id: "city_1", name: "Lisbon", country: "Portugal", label: "x" }),
    ).toEqual({ id: "city_1", name: "Lisbon", country: "Portugal" })
  })

  it("rejects malformed catalog entries", () => {
    expect(validateCatalogCity(null)).toBeNull()
    expect(validateCatalogCity({ id: "x", name: "", country: "Y" })).toBeNull()
    expect(validateCatalogCity({ id: "x", name: "X" })).toBeNull()
  })
})
