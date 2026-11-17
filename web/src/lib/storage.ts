import { canonicalItemName } from "../data/measure"
import type { Lang } from "../i18n"
import { emptyLibrary, normalizeLibrary, type ComboLibrary } from "./combos"
import { isCurrencyCode, parseFxTable, type CurrencyCode, type FxTable } from "./money"
import { emptyUsage, type Horizon, type Usage } from "./period"

const LANG_KEY = "ltp.lang"
const HOURS_KEY = "ltp.workHours"
const PERIOD_KEY = "ltp.period"
const COMBOS_KEY = "ltp.combos"
const LAST_HASH_KEY = "ltp.lastHash"
const CURRENCY_KEY = "ltp.currency"
const FX_KEY = "ltp.fx"

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

export function readComboLibrary(): ComboLibrary {
  const raw = storage()?.getItem(COMBOS_KEY)
  if (!raw) return emptyLibrary()
  try {
    return normalizeLibrary(JSON.parse(raw) as unknown)
  } catch {
    return emptyLibrary()
  }
}

export function writeComboLibrary(library: ComboLibrary) {
  storage()?.setItem(COMBOS_KEY, JSON.stringify(normalizeLibrary(library)))
}

export function readLastHash(): string | null {
  const value = storage()?.getItem(LAST_HASH_KEY)
  return value && value.length > 0 ? value : null
}

export function writeLastHash(hash: string) {
  const body = hash.startsWith("#") ? hash.slice(1) : hash
  if (!body) return
  storage()?.setItem(LAST_HASH_KEY, body)
}

export function readCurrency(): CurrencyCode {
  const value = storage()?.getItem(CURRENCY_KEY)
  return isCurrencyCode(value) ? value : "USD"
}

export function writeCurrency(currency: CurrencyCode) {
  storage()?.setItem(CURRENCY_KEY, currency)
}

export function readFx(): FxTable | null {
  const raw = storage()?.getItem(FX_KEY)
  if (!raw) return null
  try {
    return parseFxTable(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

export function writeFx(table: FxTable) {
  const parsed = parseFxTable(table)
  if (!parsed) return
  storage()?.setItem(FX_KEY, JSON.stringify(parsed))
}
