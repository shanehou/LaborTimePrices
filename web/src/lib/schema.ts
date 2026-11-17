import { canonicalizePrices } from "../data/measure"
import type { CatalogCity, CityRecord } from "./types"

export type SchemaFailure = "invalid_schema"

export type CityValidationResult =
  | { ok: true; city: CityRecord }
  | { ok: false; reason: SchemaFailure }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== ""
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

type OptionalString =
  | { ok: true; value: string | undefined }
  | { ok: false }

function optionalString(value: unknown): OptionalString {
  if (value === undefined || value === null) return { ok: true, value: undefined }
  if (typeof value !== "string") return { ok: false }
  return { ok: true, value }
}

/**
 * Validates one on-demand city payload. A missing or non-positive salary and a
 * non-positive price are kept on purpose: the ranking explains them instead of
 * silently dropping the city.
 */
export function validateCityRecord(input: unknown): CityValidationResult {
  if (!isRecord(input)) return { ok: false, reason: "invalid_schema" }

  const { id, name, country } = input
  if (!nonEmptyString(id) || !nonEmptyString(name) || !nonEmptyString(country)) {
    return { ok: false, reason: "invalid_schema" }
  }
  if (!Array.isArray(input.prices)) return { ok: false, reason: "invalid_schema" }

  let monthlyNetSalary: number | null
  if (input.monthly_net_salary === undefined || input.monthly_net_salary === null) {
    monthlyNetSalary = null
  } else if (finiteNumber(input.monthly_net_salary)) {
    monthlyNetSalary = input.monthly_net_salary
  } else {
    return { ok: false, reason: "invalid_schema" }
  }

  let monthlyWorkHours: number | undefined
  if (input.monthly_work_hours === undefined || input.monthly_work_hours === null) {
    monthlyWorkHours = undefined
  } else if (finiteNumber(input.monthly_work_hours)) {
    monthlyWorkHours = input.monthly_work_hours
  } else {
    return { ok: false, reason: "invalid_schema" }
  }

  const scrapedAt = optionalString(input.scraped_at)
  if (!scrapedAt.ok) return { ok: false, reason: "invalid_schema" }
  const sourceUrl = optionalString(input.source_url)
  if (!sourceUrl.ok) return { ok: false, reason: "invalid_schema" }

  const prices: CityRecord["prices"] = []
  for (const price of input.prices) {
    if (!isRecord(price)) return { ok: false, reason: "invalid_schema" }
    if (!nonEmptyString(price.category) || !nonEmptyString(price.item)) {
      return { ok: false, reason: "invalid_schema" }
    }
    if (!finiteNumber(price.price_usd)) return { ok: false, reason: "invalid_schema" }
    prices.push({
      category: price.category,
      item: price.item,
      price_usd: price.price_usd,
    })
  }

  const city: CityRecord = {
    id,
    name,
    country,
    monthly_net_salary: monthlyNetSalary,
    prices: canonicalizePrices(prices),
  }
  if (monthlyWorkHours !== undefined) city.monthly_work_hours = monthlyWorkHours
  if (scrapedAt.value !== undefined) city.scraped_at = scrapedAt.value
  if (sourceUrl.value !== undefined) city.source_url = sourceUrl.value

  return { ok: true, city }
}

export function validateCatalogCity(input: unknown): CatalogCity | null {
  if (!isRecord(input)) return null
  const { id, name, country } = input
  if (!nonEmptyString(id) || !nonEmptyString(name) || !nonEmptyString(country)) return null
  return { id, name, country }
}
