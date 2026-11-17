import { canonicalItemName } from "../data/measure"
import type { Lang } from "../i18n"
import { emptyUsage, type Horizon, type Usage } from "./period"

const LANG_KEY = "ltp.lang"
const HOURS_KEY = "ltp.workHours"
const PERIOD_KEY = "ltp.period"

export type StoredPeriod = {
  horizon: Horizon
  usage: Usage
}

function storage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null
    return localStorage
  } catch {
    return null
  }
}

export function languageFromTag(tag: string | undefined): Lang {
  return tag?.toLowerCase().startsWith("zh") ? "zh" : "en"
}

export function readLang(): Lang | null {
  const value = storage()?.getItem(LANG_KEY)
  return value === "zh" || value === "en" ? value : null
}

export function writeLang(lang: Lang) {
  storage()?.setItem(LANG_KEY, lang)
}

export function initialLang(): Lang {
  const saved = readLang()
  if (saved) return saved
  const tag = typeof navigator === "undefined" ? undefined : navigator.language
  return languageFromTag(tag)
}

export function readHourOverrides(): Record<string, number> {
  const raw = storage()?.getItem(HOURS_KEY)
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {}
    const overrides: Record<string, number> = {}
    for (const [cityId, hours] of Object.entries(parsed)) {
      if (typeof hours === "number" && Number.isFinite(hours) && hours > 0) {
        overrides[cityId] = hours
      }
    }
    return overrides
  } catch {
    return {}
  }
}

export function writeHourOverride(cityId: string, hours: number | null): Record<string, number> {
  const next = readHourOverrides()
  if (hours === null || !Number.isFinite(hours) || hours <= 0) {
    delete next[cityId]
  } else {
    next[cityId] = hours
  }
  storage()?.setItem(HOURS_KEY, JSON.stringify(next))
  return next
}

function positiveMap(value: unknown): Record<string, number> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {}
  const next: Record<string, number> = {}
  for (const [item, amount] of Object.entries(value)) {
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) continue
    const name = canonicalItemName(item)
    if (name !== item && next[name] !== undefined) continue
    next[name] = amount
  }
  return next
}

export function readPeriod(): StoredPeriod {
  const fallback: StoredPeriod = { horizon: "listed", usage: emptyUsage() }
  const raw = storage()?.getItem(PERIOD_KEY)
  if (!raw) return fallback
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return fallback
    const record = parsed as { horizon?: unknown; usage?: unknown }
    const horizon: Horizon =
      record.horizon === "month" || record.horizon === "year" || record.horizon === "listed"
        ? record.horizon
        : "listed"
    const usageRecord =
      typeof record.usage === "object" && record.usage !== null && !Array.isArray(record.usage)
        ? (record.usage as { times?: unknown; years?: unknown; area?: unknown })
        : {}
    return {
      horizon,
      usage: {
        times: positiveMap(usageRecord.times),
        years: positiveMap(usageRecord.years),
        area: positiveMap(usageRecord.area),
      },
    }
  } catch {
    return fallback
  }
}

export function writePeriod(period: StoredPeriod) {
  storage()?.setItem(PERIOD_KEY, JSON.stringify(period))
}
