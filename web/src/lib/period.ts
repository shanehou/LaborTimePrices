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

export type PeriodContext = {
  horizon: Horizon
  mode: PeriodMode
  usage: Usage
}

export function emptyUsage(): Usage {
  return { times: {}, years: {}, area: {}, rates: {}, repayments: {} }
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
 * and repayment modes are always shared.
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
        usd: purchasePeriodUsd(listedUsd * count, item, period.usage, horizon),
      }
    }
    case "assetArea": {
      const area = period.mode === "single" ? period.usage.area[item]! : quantity
      return {
        ok: true,
        usd: purchasePeriodUsd(listedUsd * area, item, period.usage, horizon),
      }
    }
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
 */
export function purchasePeriodUsd(
  principal: number,
  item: string,
  usage: Usage,
  horizon: Exclude<Horizon, "listed">,
): number {
  const years = purchaseYears(usage.years[item])
  const perYear = principal / years
  const rate = usage.rates[item]
  if (!isPositiveFinite(rate)) return horizon === "month" ? perYear / 12 : perYear

  const months = Math.max(1, Math.round(years * 12))
  const monthlyRate = rate / 100 / 12
  const average =
    usage.repayments[item] === "principal"
      ? principal / months + (principal * monthlyRate * (months + 1)) / (2 * months)
      : equalInstallment(principal, monthlyRate, months)
  const monthly = Number.isFinite(average) && average > 0 ? average : principal / months
  return horizon === "month" ? monthly : monthly * 12
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
