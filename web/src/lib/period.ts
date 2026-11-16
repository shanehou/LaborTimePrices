import { ITEM_CADENCE, cadenceOf, type Cadence } from "../data/cadence"
import { NUMBEO_ITEMS } from "../data/items"
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

export type Usage = {
  times: Record<string, number>
  years: Record<string, number>
  area: Record<string, number>
}

export type PeriodContext = {
  horizon: Horizon
  mode: PeriodMode
  usage: Usage
}

export function emptyUsage(): Usage {
  return { times: {}, years: {}, area: {} }
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
 * they occur, and straight-line amortizes cars and apartment prices.
 * Single-item rows take times and area from `usage`; combo rows take them
 * from `quantity`. Years are always shared.
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
      const perYear = (listedUsd * count) / purchaseYears(period.usage.years[item])
      return { ok: true, usd: horizon === "month" ? perYear / 12 : perYear }
    }
    case "assetArea": {
      const area = period.mode === "single" ? period.usage.area[item]! : quantity
      const perYear = (listedUsd * area) / purchaseYears(period.usage.years[item])
      return { ok: true, usd: horizon === "month" ? perYear / 12 : perYear }
    }
  }
}

export function horizonFactor(cadence: Cadence, horizon: Horizon): "x12" | "div12" | null {
  if (horizon === "listed") return null
  if (cadence === "monthly" && horizon === "year") return "x12"
  if (cadence === "yearly" && horizon === "month") return "div12"
  return null
}

export function setUsageNumber(
  usage: Usage,
  kind: keyof Usage,
  item: string,
  value: number | undefined,
): Usage {
  const next = { ...usage[kind] }
  if (!isPositiveFinite(value)) delete next[item]
  else next[item] = value
  return { ...usage, [kind]: next }
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
