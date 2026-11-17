import { canonicalItemName, priceUsdFor, type PriceSample } from "../data/measure"
import type { Lang } from "../i18n"
import { firstUsageBlock, lineSpendUsd, type PeriodContext } from "./period"
import type {
  BasketLine,
  CityRecord,
  Exclusion,
  HoursSource,
} from "./types"

export type PriceView = {
  lang: Lang
  prices: readonly PriceSample[]
}

/** Weekly full-time hours × 52 / 12. */
export const DEFAULT_MONTHLY_HOURS = 173.3

export type HoursResolution =
  | { ok: true; hours: number; source: HoursSource }
  | { ok: false; reason: Exclusion }

export type LaborSuccess = {
  ok: true
  hours: number
  totalUsd: number
  hourlyWage: number
  monthlyHours: number
  source: HoursSource
}

export type LaborFailure = {
  ok: false
  reason: Exclusion
}

export type RankedCity = {
  city: CityRecord
  hours: number
  totalUsd: number
  hourlyWage: number
  monthlyHours: number
  source: HoursSource
}

export type ExcludedCity = {
  city: CityRecord
  reason: Exclusion
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

export function resolveMonthlyHours(
  city: { monthly_work_hours?: number },
  visitorHours: number | undefined,
): HoursResolution {
  if (visitorHours !== undefined) {
    if (!isPositiveFinite(visitorHours)) {
      return { ok: false, reason: { code: "non_positive_hours" } }
    }
    return { ok: true, hours: visitorHours, source: "visitor" }
  }

  if (city.monthly_work_hours !== undefined) {
    if (!isPositiveFinite(city.monthly_work_hours)) {
      return { ok: false, reason: { code: "non_positive_hours" } }
    }
    return { ok: true, hours: city.monthly_work_hours, source: "city" }
  }

  return { ok: true, hours: DEFAULT_MONTHLY_HOURS, source: "default" }
}

function salaryExclusion(salary: number | null): Exclusion | null {
  if (salary === null || !Number.isFinite(salary)) {
    return { code: "missing_salary" }
  }
  if (salary <= 0) {
    return { code: "non_positive_salary" }
  }
  return null
}

export function findPrice(city: CityRecord, item: string) {
  const key = canonicalItemName(item)
  const matches = city.prices.filter((price) => canonicalItemName(price.item) === key)
  return matches.find((price) => price.item === key) ?? matches[0]
}

function rowUsd(row: { item: string; price_usd: number }, view?: PriceView): number {
  if (!view) return row.price_usd
  return priceUsdFor(view.lang, row, view.prices)
}

/**
 * Dollars divided by the hourly wage.
 * A listed price is used as-is. Month/year conversion happens in lineSpendUsd
 * before the dollars reach this function.
 */
export function laborHoursForPrice(
  priceUsd: number,
  monthlyNetSalary: number,
  monthlyHours: number,
): number {
  const hourlyWage = monthlyNetSalary / monthlyHours
  return priceUsd / hourlyWage
}

export function evaluateBasket(
  city: CityRecord,
  lines: BasketLine[],
  visitorHours?: number,
  period?: PeriodContext,
  view?: PriceView,
): LaborSuccess | LaborFailure {
  const blocked = firstUsageBlock(lines, period)
  if (blocked) return { ok: false, reason: blocked }

  const salaryProblem = salaryExclusion(city.monthly_net_salary)
  if (salaryProblem) {
    return { ok: false, reason: salaryProblem }
  }

  const resolved = resolveMonthlyHours(city, visitorHours)
  if (!resolved.ok) {
    return resolved
  }

  let totalUsd = 0
  for (const line of lines) {
    if (!isPositiveFinite(line.quantity)) {
      return {
        ok: false,
        reason: { code: "non_positive_quantity", item: line.item },
      }
    }
    const price = findPrice(city, line.item)
    if (!price) {
      return { ok: false, reason: { code: "missing_item", item: line.item } }
    }
    const usd = rowUsd(price, view)
    if (!isPositiveFinite(usd)) {
      return {
        ok: false,
        reason: { code: "non_positive_price", item: line.item },
      }
    }
    const spent = lineSpendUsd(usd, line.item, line.quantity, period)
    if (!spent.ok) return { ok: false, reason: spent.reason }
    totalUsd += spent.usd
  }

  const hourlyWage = city.monthly_net_salary! / resolved.hours
  return {
    ok: true,
    hours: totalUsd / hourlyWage,
    totalUsd,
    hourlyWage,
    monthlyHours: resolved.hours,
    source: resolved.source,
  }
}

export function rankCities(
  cities: CityRecord[],
  lines: BasketLine[],
  visitorHoursByCity: Record<string, number | undefined>,
  period?: PeriodContext,
  view?: PriceView,
): { ranked: RankedCity[]; excluded: ExcludedCity[] } {
  const ranked: RankedCity[] = []
  const excluded: ExcludedCity[] = []

  for (const city of cities) {
    const result = evaluateBasket(city, lines, visitorHoursByCity[city.id], period, view)
    if (result.ok) {
      ranked.push({
        city,
        hours: result.hours,
        totalUsd: result.totalUsd,
        hourlyWage: result.hourlyWage,
        monthlyHours: result.monthlyHours,
        source: result.source,
      })
    } else {
      excluded.push({ city, reason: result.reason })
    }
  }

  ranked.sort(
    (a, b) => a.hours - b.hours || a.city.name.localeCompare(b.city.name),
  )
  return { ranked, excluded }
}

export function listCatalog(cities: CityRecord[]): { category: string; item: string }[] {
  const seen = new Set<string>()
  const catalog: { category: string; item: string }[] = []
  for (const city of cities) {
    for (const price of city.prices) {
      const item = canonicalItemName(price.item)
      if (seen.has(item)) continue
      seen.add(item)
      catalog.push({ category: price.category, item })
    }
  }
  return catalog
}

export function groupCatalog(catalog: { category: string; item: string }[]) {
  const groups: { category: string; items: string[] }[] = []
  const indexByCategory = new Map<string, number>()
  for (const entry of catalog) {
    const existing = indexByCategory.get(entry.category)
    if (existing === undefined) {
      indexByCategory.set(entry.category, groups.length)
      groups.push({ category: entry.category, items: [entry.item] })
    } else {
      groups[existing]?.items.push(entry.item)
    }
  }
  return groups
}
