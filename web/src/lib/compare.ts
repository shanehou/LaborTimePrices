import { formatPlain } from "./format"
import type { Lang } from "../i18n"

export type DeltaTone = "red" | "green" | "neutral"

/**
 * Relative difference of a value from the baseline, or null when the two
 * numbers are not comparable (non-finite value, or a non-positive baseline).
 */
export function percentDelta(value: number, baseline: number): number | null {
  if (!Number.isFinite(value) || !Number.isFinite(baseline) || baseline <= 0) return null
  return (value - baseline) / baseline
}

/**
 * Color convention for a delta. Chinese follows the local market convention
 * (red = higher, green = lower); English is the opposite.
 */
export function deltaTone(lang: Lang, ratio: number): DeltaTone {
  if (!Number.isFinite(ratio)) return "neutral"
  const percent = Math.round(ratio * 100)
  if (percent === 0) return "neutral"
  const higher = percent > 0
  const red = lang === "zh" ? higher : !higher
  return red ? "red" : "green"
}

export function formatDeltaPercent(lang: Lang, ratio: number): string {
  const percent = Math.round(ratio * 100)
  if (percent === 0) return "0%"
  const sign = percent > 0 ? "+" : ""
  return `${sign}${formatPlain(lang, percent, 0)}%`
}
