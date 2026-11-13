import type { CityRecord, PriceDataset } from "./types"

export type SchemaFailure = "invalid_schema"

export type ValidationResult =
  | { ok: true; dataset: PriceDataset }
  | { ok: false; reason: SchemaFailure }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== ""
}

export function validatePricesDataset(input: unknown): ValidationResult {
  if (!isRecord(input) || !Array.isArray(input.cities)) {
    return { ok: false, reason: "invalid_schema" }
  }

  const cities: CityRecord[] = []
  for (const entry of input.cities) {
    if (!isRecord(entry)) return { ok: false, reason: "invalid_schema" }
    if (!nonEmptyString(entry.id) || !nonEmptyString(entry.name) || !nonEmptyString(entry.country)) {
      return { ok: false, reason: "invalid_schema" }
    }
    if (!Array.isArray(entry.prices)) return { ok: false, reason: "invalid_schema" }

    let monthlyNetSalary: number | null
    if (entry.monthly_net_salary === undefined || entry.monthly_net_salary === null) {
      monthlyNetSalary = null
    } else if (typeof entry.monthly_net_salary === "number" && Number.isFinite(entry.monthly_net_salary)) {
      monthlyNetSalary = entry.monthly_net_salary
    } else {
      return { ok: false, reason: "invalid_schema" }
    }

    let monthlyWorkHours: number | undefined
    if (entry.monthly_work_hours === undefined || entry.monthly_work_hours === null) {
      monthlyWorkHours = undefined
    } else if (typeof entry.monthly_work_hours === "number" && Number.isFinite(entry.monthly_work_hours)) {
      monthlyWorkHours = entry.monthly_work_hours
    } else {
      return { ok: false, reason: "invalid_schema" }
    }

    const prices: CityRecord["prices"] = []
    for (const price of entry.prices) {
      if (!isRecord(price)) return { ok: false, reason: "invalid_schema" }
      if (!nonEmptyString(price.category) || !nonEmptyString(price.item)) {
        return { ok: false, reason: "invalid_schema" }
      }
      if (typeof price.price_usd !== "number" || !Number.isFinite(price.price_usd)) {
        return { ok: false, reason: "invalid_schema" }
      }
      prices.push({
        category: price.category,
        item: price.item,
        price_usd: price.price_usd,
      })
    }

    const city: CityRecord = {
      id: entry.id,
      name: entry.name,
      country: entry.country,
      monthly_net_salary: monthlyNetSalary,
      prices,
    }
    if (monthlyWorkHours !== undefined) {
      city.monthly_work_hours = monthlyWorkHours
    }
    cities.push(city)
  }

  return { ok: true, dataset: { cities } }
}
