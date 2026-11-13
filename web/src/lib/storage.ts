import type { Lang } from "../i18n"

const LANG_KEY = "ltp.lang"
const HOURS_KEY = "ltp.workHours"

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
