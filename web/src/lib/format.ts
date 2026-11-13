import type { Lang } from "../i18n"
import { formatMessage, t } from "../i18n"

function locale(lang: Lang) {
  return lang === "zh" ? "zh-CN" : "en-US"
}

export function formatUsd(lang: Lang, amount: number): string {
  return new Intl.NumberFormat(locale(lang), {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: amount >= 100 ? 0 : 2,
    maximumFractionDigits: amount >= 100 ? 0 : 2,
  }).format(amount)
}

export function formatPlain(lang: Lang, value: number, digits: number): string {
  return new Intl.NumberFormat(locale(lang), {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value)
}

export function formatLaborHours(lang: Lang, hours: number): string {
  const hourDigits = hours < 10 ? 2 : 1
  const hoursText = formatPlain(lang, hours, hourDigits)
  if (hours > 0 && hours < 1) {
    const minutes = formatPlain(lang, hours * 60, 0)
    return formatMessage(t(lang, "minutesSuffix"), { hours: hoursText, minutes })
  }
  return formatMessage(t(lang, "hoursSuffix"), { hours: hoursText })
}
