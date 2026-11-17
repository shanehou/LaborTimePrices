import { describe, expect, it } from "vitest"
import { formatMoney } from "./format"
import { QUOTE_CURRENCIES, moneyFormat, parseFxTable, type FxTable } from "./money"

function table(rate = 7): FxTable {
  return {
    base: "USD",
    date: "2026-11-16",
    rates: Object.fromEntries(QUOTE_CURRENCIES.map((code) => [code, rate])) as FxTable["rates"],
  }
}

describe("parseFxTable", () => {
  it("accepts a complete USD table and rejects a missing quote", () => {
    expect(parseFxTable(table())?.rates.CNY).toBe(7)
    const broken = table()
    const rates = { ...broken.rates }
    delete (rates as Partial<FxTable["rates"]>).JPY
    expect(parseFxTable({ ...broken, rates })).toBeNull()
    expect(parseFxTable({ ...table(), rates: { ...table().rates, CNY: 0 } })).toBeNull()
  })
})

describe("formatMoney", () => {
  it("converts from USD and hides minor units for yen and won", () => {
    const fx = table(2)
    expect(moneyFormat("CNY", fx)).toEqual({ currency: "CNY", rate: 2, date: "2026-11-16" })
    expect(moneyFormat("CNY", null)).toEqual({ currency: "USD", rate: 1, date: null })
    expect(formatMoney("en", 1.5, { currency: "CNY", rate: 2, date: null })).toMatch(/3\.00/)
    expect(formatMoney("en", 80, { currency: "CNY", rate: 2, date: null })).not.toMatch(/\.00/)
    expect(formatMoney("en", 1.25, { currency: "JPY", rate: 100, date: null })).not.toMatch(/[.,]\d/)
    expect(formatMoney("zh", 1.25, { currency: "KRW", rate: 1000, date: null })).toContain("1,250")
    expect(formatMoney("en", 150)).not.toMatch(/\.00/)
  })
})
