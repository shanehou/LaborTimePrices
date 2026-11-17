import type { Lang } from "../i18n"
import { formatMessage, t } from "../i18n"
import { USD_MONEY, type MoneyFormat } from "./money"

const ZERO_DECIMAL = new Set(["JPY", "KRW"])

function locale(lang: Lang) {
  return lang === "zh" ? "zh-CN" : "en-US"
}

export function formatMoney(lang: Lang, usdAmount: number, money: MoneyFormat = USD_MONEY): string {
  const rate = Number.isFinite(money.rate) && money.rate > 0 ? money.rate : 1
  const amount = usdAmount * rate
  const currency = money.currency || "USD"
  const digits = ZERO_DECIMAL.has(currency) ? 0 : Math.abs(amount) >= 100 ? 0 : 2
  try {
    return new Intl.NumberFormat(locale(lang), {
      style: "currency",
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(amount)
  } catch {
    return formatMoney(lang, usdAmount, USD_MONEY)
  }
}

export function formatUsd(lang: Lang, amount: number): string {
  return formatMoney(lang, amount, USD_MONEY)
}

export function formatPlain(lang: Lang, value: number, digits: number): string {
  return new Intl.NumberFormat(locale(lang), {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value)
}

export function formatDate(lang: Lang, iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(locale(lang), { dateStyle: "medium" }).format(date)
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
