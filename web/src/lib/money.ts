export const CURRENCIES = [
  "USD",
  "CNY",
  "EUR",
  "GBP",
  "JPY",
  "HKD",
  "SGD",
  "AUD",
  "CAD",
  "CHF",
  "KRW",
] as const

export type CurrencyCode = (typeof CURRENCIES)[number]

export const QUOTE_CURRENCIES = CURRENCIES.filter(
  (code): code is Exclude<CurrencyCode, "USD"> => code !== "USD",
)

const CURRENCY_SET = new Set<string>(CURRENCIES)
const DATE = /^\d{4}-\d{2}-\d{2}$/

export type FxTable = {
  base: "USD"
  date: string
  rates: Record<Exclude<CurrencyCode, "USD">, number>
}

export type MoneyFormat = {
  currency: CurrencyCode
  rate: number
  date: string | null
}

export const USD_MONEY: MoneyFormat = { currency: "USD", rate: 1, date: null }

export function isCurrencyCode(value: string | null | undefined): value is CurrencyCode {
  return value !== null && value !== undefined && CURRENCY_SET.has(value)
}

export function parseFxTable(input: unknown): FxTable | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return null
  const record = input as { base?: unknown; date?: unknown; rates?: unknown }
  if (record.base !== "USD") return null
  if (typeof record.date !== "string" || !DATE.test(record.date)) return null
  if (typeof record.rates !== "object" || record.rates === null || Array.isArray(record.rates)) {
    return null
  }
  const source = record.rates as Record<string, unknown>
  const rates = {} as FxTable["rates"]
  for (const code of QUOTE_CURRENCIES) {
    const rate = source[code]
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) return null
    rates[code] = rate
  }
  return { base: "USD", date: record.date, rates }
}

export function fxRate(table: FxTable | null, currency: CurrencyCode): number | null {
  if (currency === "USD") return 1
  const rate = table?.rates[currency]
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) return null
  return rate
}

export function moneyFormat(currency: CurrencyCode, table: FxTable | null): MoneyFormat {
  const rate = fxRate(table, currency)
  if (rate === null) return USD_MONEY
  return { currency, rate, date: table?.date ?? null }
}
