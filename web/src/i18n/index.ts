import { en, type MessageKey } from "./en"
import { zh, zhCategoryLabels, zhCountryLabels, zhItemLabels } from "./zh"
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

export function labelItem(lang: Lang, item: string): string {
  if (lang === "zh") return zhItemLabels[item] ?? item
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

export function exclusionMessage(lang: Lang, reason: Exclusion): string {
  const item = reason.item ? labelItem(lang, reason.item) : ""
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
  }
}

const loadReasonKey = {
  missing: "reasonMissing",
  http: "reasonHttp",
  timeout: "reasonTimeout",
  invalid_json: "reasonInvalidJson",
  invalid_schema: "reasonInvalidSchema",
  network: "reasonNetwork",
} as const

export type LoadReason = keyof typeof loadReasonKey

export function loadReasonMessage(
  lang: Lang,
  reason: LoadReason,
  detail?: string,
): string {
  return formatMessage(t(lang, loadReasonKey[reason]), { status: detail ?? "" })
}
