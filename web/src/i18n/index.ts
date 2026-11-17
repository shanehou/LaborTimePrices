import { canonicalItemName, englishItemName, type PriceSample } from "../data/measure"
import { en, type MessageKey } from "./en"
import { zh, zhCategoryLabels, zhCountryLabels, zhItemLabels } from "./zh"
import type { ApiErrorCode } from "../lib/api"
import type { Exclusion } from "../lib/types"

export type Lang = "zh" | "en"

export function t(lang: Lang, key: MessageKey): string {
  if (lang === "zh") {
    const value = zh[key]
    if (value) return value
  }
  return en[key] ?? key
}

export function formatMessage(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = vars[name]
    return value === undefined ? `{${name}}` : String(value)
  })
}

export function labelItem(lang: Lang, item: string, prices?: readonly PriceSample[]): string {
  const key = canonicalItemName(item)
  if (lang === "zh") return zhItemLabels[key] ?? item
  if (prices) return englishItemName(key, prices)
  return item
}

export function labelCategory(lang: Lang, category: string): string {
  if (lang === "zh") return zhCategoryLabels[category] ?? category
  return category
}

export function labelCountry(lang: Lang, country: string): string {
  if (lang === "zh") return zhCountryLabels[country] ?? country
  return country
}

export function exclusionMessage(
  lang: Lang,
  reason: Exclusion,
  prices?: readonly PriceSample[],
): string {
  const item = reason.item ? labelItem(lang, reason.item, prices) : ""
  switch (reason.code) {
    case "missing_salary":
      return t(lang, "reasonMissingSalary")
    case "non_positive_salary":
      return t(lang, "reasonNonPositiveSalary")
    case "non_positive_hours":
      return t(lang, "reasonNonPositiveHours")
    case "missing_item":
      return formatMessage(t(lang, "reasonMissingItem"), { item })
    case "non_positive_price":
      return formatMessage(t(lang, "reasonNonPositivePrice"), { item })
    case "non_positive_quantity":
      return formatMessage(t(lang, "reasonNonPositiveQuantity"), { item })
    case "needs_times":
      return t(lang, "reasonNeedsTimes")
    case "needs_years":
      return t(lang, "reasonNeedsYears")
    case "needs_area":
      return t(lang, "reasonNeedsArea")
  }
}

export function apiErrorMessage(lang: Lang, code: ApiErrorCode): string {
  switch (code) {
    case "timeout":
      return t(lang, "apiErrorTimeout")
    case "network":
      return t(lang, "apiErrorNetwork")
    case "http":
      return t(lang, "apiErrorHttp")
    case "rate_limited":
      return t(lang, "apiErrorRateLimited")
    case "upstream":
      return t(lang, "apiErrorUpstream")
    case "invalid":
      return t(lang, "apiErrorInvalid")
    case "bad_response":
      return t(lang, "apiErrorBadResponse")
  }
}
