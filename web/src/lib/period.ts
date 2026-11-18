import { ITEM_CADENCE, cadenceOf, type Cadence } from "../data/cadence"
import { NUMBEO_ITEMS } from "../data/items"
import { canonicalItemName } from "../data/measure"
import type { BasketLine, Exclusion } from "./types"

export type Horizon = "listed" | "month" | "year"

/** Starting amortization when a purchase has no years of its own. */
export const DEFAULT_PURCHASE_YEARS = 10

export function purchaseYears(years: number | undefined): number {
  return isPositiveFinite(years) ? years : DEFAULT_PURCHASE_YEARS
}

export function quantityFromField(quantity: string): number {
  if (quantity.trim() === "") return 1
  const parsed = Number(quantity)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

export type PeriodMode = "single" | "combo"

/** Equal principal (`principal`) or equal installment (`payment`). */
export type Repayment = "principal" | "payment"

export type Usage = {
  times: Record<string, number>
  years: Record<string, number>
  area: Record<string, number>
  /** Annual interest, in percent. `3.5` means 3.5%. Absent means no interest. */
  rates: Record<string, number>
  repayments: Record<string, Repayment>
}

type UsageAmount = "times" | "years" | "area" | "rates"

/**
 * Per-city values for purchase financing and floor area, keyed
 * `item -> cityId -> value`. Financing follows local policy, so an override
 * is a fact about the city and applies to every combo, unlike `Usage` itself.
 */
export type UsageOverrides = {
  area: Record<string, Record<string, number>>
  years: Record<string, Record<string, number>>
  rates: Record<string, Record<string, number>>
  repayments: Record<string, Record<string, Repayment>>
}

type UsageOverrideAmount = "area" | "years" | "rates"

/** Term that pairs with Numbeo's "(20-Year Fixed, in %)" mortgage rate. */
export const MORTGAGE_TERM_YEARS = 20

export type PeriodContext = {
  horizon: Horizon
  mode: PeriodMode
  usage: Usage
  /** The city a spend is priced for; enables per-city financing defaults. */
  city?: { id: string; mortgage_rate?: number | null }
  overrides?: UsageOverrides
}

export function emptyUsage(): Usage {
  return { times: {}, years: {}, area: {}, rates: {}, repayments: {} }
}

export function emptyUsageOverrides(): UsageOverrides {
  return { area: {}, years: {}, rates: {}, repayments: {} }
}

export function isRepayment(value: unknown): value is Repayment {
  return value === "principal" || value === "payment"
}

export function repaymentMap(value: unknown): Record<string, Repayment> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {}
  const next: Record<string, Repayment> = {}
  for (const [item, mode] of Object.entries(value)) {
    if (!isRepayment(mode)) continue
    const name = canonicalItemName(item)
    if (name !== item && next[name] !== undefined) continue
    next[name] = mode
  }
  return next
}

function overrideNumberMap(value: unknown): Record<string, Record<string, number>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {}
  const next: Record<string, Record<string, number>> = {}
  for (const [rawItem, perCity] of Object.entries(value)) {
    if (typeof perCity !== "object" || perCity === null || Array.isArray(perCity)) continue
    const item = canonicalItemName(rawItem)
    if (item !== rawItem && next[item] !== undefined) continue
    const cityMap: Record<string, number> = {}
    for (const [cityId, amount] of Object.entries(perCity)) {
      if (cityId === "") continue
      if (typeof amount === "number" && Number.isFinite(amount) && amount > 0) {
        cityMap[cityId] = amount
      }
    }
    if (Object.keys(cityMap).length === 0) continue
    next[item] = cityMap
  }
  return next
}

function overrideRepaymentMap(value: unknown): Record<string, Record<string, Repayment>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {}
  const next: Record<string, Record<string, Repayment>> = {}
  for (const [rawItem, perCity] of Object.entries(value)) {
    if (typeof perCity !== "object" || perCity === null || Array.isArray(perCity)) continue
    const item = canonicalItemName(rawItem)
    if (item !== rawItem && next[item] !== undefined) continue
    const cityMap: Record<string, Repayment> = {}
    for (const [cityId, mode] of Object.entries(perCity)) {
      if (cityId === "") continue
      if (isRepayment(mode)) cityMap[cityId] = mode
    }
    if (Object.keys(cityMap).length === 0) continue
    next[item] = cityMap
  }
  return next
}

/** Keeps only well-formed per-city values and folds alias item names. */
export function normalizeUsageOverrides(input: unknown): UsageOverrides {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return emptyUsageOverrides()
  }
  const record = input as {
    area?: unknown
    years?: unknown
    rates?: unknown
    repayments?: unknown
  }
  return {
    area: overrideNumberMap(record.area),
    years: overrideNumberMap(record.years),
    rates: overrideNumberMap(record.rates),
    repayments: overrideRepaymentMap(record.repayments),
  }
}

export function setUsageOverrideNumber(
  overrides: UsageOverrides,
  kind: UsageOverrideAmount,
  item: string,
  cityId: string,
  value: number | undefined,
): UsageOverrides {
  const perKind = { ...overrides[kind] }
  const perCity = { ...(perKind[item] ?? {}) }
  if (!isPositiveFinite(value)) delete perCity[cityId]
  else perCity[cityId] = value
  if (Object.keys(perCity).length === 0) delete perKind[item]
  else perKind[item] = perCity
  return { ...overrides, [kind]: perKind }
}

export function setUsageOverrideRepayment(
  overrides: UsageOverrides,
  item: string,
  cityId: string,
  value: Repayment | undefined,
): UsageOverrides {
  const repayments = { ...overrides.repayments }
  const perCity = { ...(repayments[item] ?? {}) }
  if (!isRepayment(value)) delete perCity[cityId]
  else perCity[cityId] = value
  if (Object.keys(perCity).length === 0) delete repayments[item]
  else repayments[item] = perCity
  return { ...overrides, repayments }
}

/** Deep-merges incoming per-city values (e.g. from a share link) over base. */
export function mergeUsageOverrides(
  base: UsageOverrides,
  incoming: UsageOverrides,
): UsageOverrides {
  const mergeNumbers = (
    left: Record<string, Record<string, number>>,
    right: Record<string, Record<string, number>>,
  ) => {
    const next: Record<string, Record<string, number>> = { ...left }
    for (const [item, perCity] of Object.entries(right)) {
      next[item] = { ...next[item], ...perCity }
    }
    return next
  }
  const mergeRepayments = (
    left: Record<string, Record<string, Repayment>>,
    right: Record<string, Record<string, Repayment>>,
  ) => {
    const next: Record<string, Record<string, Repayment>> = { ...left }
    for (const [item, perCity] of Object.entries(right)) {
      next[item] = { ...next[item], ...perCity }
    }
    return next
  }
  return {
    area: mergeNumbers(base.area, incoming.area),
    years: mergeNumbers(base.years, incoming.years),
    rates: mergeNumbers(base.rates, incoming.rates),
    repayments: mergeRepayments(base.repayments, incoming.repayments),
  }
}

/** Cities that carry any per-city value for this item. */
export function usageOverrideCityIds(overrides: UsageOverrides, item: string): string[] {
  const ids = new Set<string>()
  for (const kind of ["area", "years", "rates", "repayments"] as const) {
    for (const cityId of Object.keys(overrides[kind][item] ?? {})) ids.add(cityId)
  }
  return [...ids]
}

/** Scopes a period to one city so financing resolves against its values. */
export function cityPeriod(
  period: PeriodContext,
  city: { id: string; mortgage_rate?: number | null },
  overrides?: UsageOverrides,
): PeriodContext {
  return {
    ...period,
    city: { id: city.id, mortgage_rate: city.mortgage_rate ?? null },
    overrides,
  }
}

export function isPositiveFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

export function usageBlock(
  item: string,
  quantity: number,
  period?: PeriodContext,
): Exclusion | null {
  if (!period || period.horizon === "listed") return null
  const cadence = cadenceOf(item)
  if (cadence === "unit" && period.mode === "single" && !isPositiveFinite(period.usage.times[item])) {
    return { code: "needs_times", item }
  }
  if (cadence === "unit" && period.mode === "combo" && !isPositiveFinite(quantity)) {
    return { code: "needs_times", item }
  }
  if (cadence === "assetArea" && period.mode === "single" && !isPositiveFinite(period.usage.area[item])) {
    return { code: "needs_area", item }
  }
  if (
    cadence === "assetArea" &&
    period.mode === "combo" &&
    !isPositiveFinite(quantity)
  ) {
    return { code: "needs_area", item }
  }
  if (
    (cadence === "asset" || cadence === "assetArea") &&
    period.usage.years[item] !== undefined &&
    !isPositiveFinite(period.usage.years[item])
  ) {
    return { code: "needs_years", item }
  }
  return null
}

export function firstUsageBlock(lines: BasketLine[], period?: PeriodContext): Exclusion | null {
  for (const line of lines) {
    const reason = usageBlock(line.item, line.quantity, period)
    if (reason) return reason
  }
  return null
}

/**
 * Dollars to put through the wage. `listed` keeps 标价 × quantity.
 * A month/year horizon converts flows, multiplies unit prices by how often
 * they occur, and spread cars and apartment prices over their years.
 * A positive annual rate uses equal principal or equal installment on the
 * full price. No rate keeps the straight line. Single-item rows take times
 * and area from `usage`; combo rows take them from `quantity`. Years, rates,
 * repayment modes, and floor area resolve per city when the period carries
 * one, falling back to the shared per-item values.
 */
export function lineSpendUsd(
  listedUsd: number,
  item: string,
  quantity: number,
  period?: PeriodContext,
): { ok: true; usd: number } | { ok: false; reason: Exclusion } {
  if (!period || period.horizon === "listed") {
    if (!isPositiveFinite(quantity)) {
      return { ok: false, reason: { code: "non_positive_quantity", item } }
    }
    return { ok: true, usd: listedUsd * quantity }
  }

  const block = usageBlock(item, quantity, period)
  if (block) return { ok: false, reason: block }

  const cadence = cadenceOf(item)
  const countFromLine = cadence === "monthly" || cadence === "yearly" || period.mode === "combo"
  if (countFromLine && !isPositiveFinite(quantity)) {
    return { ok: false, reason: { code: "non_positive_quantity", item } }
  }

  const horizon = period.horizon
  switch (cadence) {
    case "monthly":
      return {
        ok: true,
        usd: horizon === "year" ? listedUsd * quantity * 12 : listedUsd * quantity,
      }
    case "yearly":
      return {
        ok: true,
        usd: horizon === "month" ? (listedUsd * quantity) / 12 : listedUsd * quantity,
      }
    case "unit": {
      const times = period.mode === "single" ? period.usage.times[item]! : quantity
      return { ok: true, usd: listedUsd * times }
    }
    case "asset": {
      const count = period.mode === "single" ? 1 : quantity
      return {
        ok: true,
        usd: purchasePeriodUsd(listedUsd * count, item, period),
      }
    }
    case "assetArea": {
      const cityId = period.city?.id
      const areaOverride =
        cityId === undefined ? undefined : period.overrides?.area[item]?.[cityId]
      const area = isPositiveFinite(areaOverride)
        ? areaOverride
        : period.mode === "single"
          ? period.usage.area[item]!
          : quantity
      return {
        ok: true,
        usd: purchasePeriodUsd(listedUsd * area, item, period),
      }
    }
  }
}

export type FinancingSource = "visitor-city" | "visitor" | "city" | "none"

export type Financing = {
  years: number
  rate: number | undefined
  repayment: Repayment
  rateSource: FinancingSource
  /** True when a per-city override or the city's Numbeo rate shaped this. */
  citySpecific: boolean
}

/**
 * Financing for one purchase in one city. Visitor per-city values win over the
 * shared per-item value; Numbeo's city mortgage rate is the last rate source,
 * and it carries its 20-year fixed term when no years are set anywhere.
 */
export function resolveFinancing(
  item: string,
  usage: Usage,
  city?: { id: string; mortgage_rate?: number | null },
  overrides?: UsageOverrides,
): Financing {
  const cityId = city?.id
  const yearsOverride = cityId === undefined ? undefined : overrides?.years[item]?.[cityId]
  const rateOverride = cityId === undefined ? undefined : overrides?.rates[item]?.[cityId]
  const repaymentOverride =
    cityId === undefined ? undefined : overrides?.repayments[item]?.[cityId]

  let rate: number | undefined
  let rateSource: FinancingSource = "none"
  if (isPositiveFinite(rateOverride)) {
    rate = rateOverride
    rateSource = "visitor-city"
  } else if (isPositiveFinite(usage.rates[item])) {
    rate = usage.rates[item]
    rateSource = "visitor"
  } else if (city !== undefined && isPositiveFinite(city.mortgage_rate ?? undefined)) {
    rate = city.mortgage_rate!
    rateSource = "city"
  }

  const fallbackYears = rateSource === "city" ? MORTGAGE_TERM_YEARS : DEFAULT_PURCHASE_YEARS
  const years = isPositiveFinite(yearsOverride)
    ? yearsOverride
    : isPositiveFinite(usage.years[item])
      ? usage.years[item]
      : fallbackYears

  const repayment = isRepayment(repaymentOverride)
    ? repaymentOverride
    : isRepayment(usage.repayments[item])
      ? usage.repayments[item]
      : "payment"

  return {
    years,
    rate,
    repayment,
    rateSource,
    citySpecific:
      isPositiveFinite(yearsOverride) ||
      isPositiveFinite(rateOverride) ||
      isRepayment(repaymentOverride) ||
      rateSource === "city",
  }
}

export function horizonFactor(cadence: Cadence, horizon: Horizon): "x12" | "div12" | null {
  if (horizon === "listed") return null
  if (cadence === "monthly" && horizon === "year") return "x12"
  if (cadence === "yearly" && horizon === "month") return "div12"
  return null
}

/**
 * Cost of a purchase for one month or one year. No interest stays `price / years`.
 * A positive annual percent uses `n = round(years × 12)` monthly periods,
 * monthly rate `percent / 100 / 12`, and the full price as principal.
 * Equal installment is the constant payment. Equal principal uses the
 * average payment over the whole term, because the page shows one number.
 * Financing resolves per city: visitor per-city values, then the shared
 * per-item values, then the city's Numbeo mortgage rate with its 20-year term.
 */
export function purchasePeriodUsd(principal: number, item: string, period: PeriodContext): number {
  const financing = resolveFinancing(item, period.usage, period.city, period.overrides)
  const years = financing.years
  const perYear = principal / years
  const rate = financing.rate
  if (!isPositiveFinite(rate)) return period.horizon === "month" ? perYear / 12 : perYear

  const months = Math.max(1, Math.round(years * 12))
  const monthlyRate = rate / 100 / 12
  const average =
    financing.repayment === "principal"
      ? principal / months + (principal * monthlyRate * (months + 1)) / (2 * months)
      : equalInstallment(principal, monthlyRate, months)
  const monthly = Number.isFinite(average) && average > 0 ? average : principal / months
  return period.horizon === "month" ? monthly : monthly * 12
}

function equalInstallment(principal: number, monthlyRate: number, months: number): number {
  if (monthlyRate === 0) return principal / months
  const growth = (1 + monthlyRate) ** months
  if (!Number.isFinite(growth) || growth === 1) return principal / months
  return (principal * monthlyRate * growth) / (growth - 1)
}

export function setUsageNumber(
  usage: Usage,
  kind: UsageAmount,
  item: string,
  value: number | undefined,
): Usage {
  const next = { ...usage[kind] }
  if (!isPositiveFinite(value)) delete next[item]
  else next[item] = value
  return { ...usage, [kind]: next }
}

export function setUsageRepayment(
  usage: Usage,
  item: string,
  value: Repayment | undefined,
): Usage {
  const next = { ...usage.repayments }
  if (!isRepayment(value)) delete next[item]
  else next[item] = value
  return { ...usage, repayments: next }
}

/** Writes `value` onto unit items (times) or purchases (years) that are still empty. */
export function fillEmptyUsage(usage: Usage, kind: "times" | "years", value: number): Usage {
  if (!isPositiveFinite(value)) return usage
  const next = { ...usage[kind] }
  let changed = false
  for (const item of NUMBEO_ITEMS) {
    const cadence = ITEM_CADENCE[item]
    const applies =
      kind === "times" ? cadence === "unit" : cadence === "asset" || cadence === "assetArea"
    if (!applies || isPositiveFinite(next[item])) continue
    next[item] = value
    changed = true
  }
  if (!changed) return usage
  return { ...usage, [kind]: next }
}
