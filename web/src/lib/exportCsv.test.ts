import { describe, expect, it } from "vitest"
import { ITEMS } from "../data/items"
import { buildComboCsv, buildItemsCsv, describeQuantity, itemsFilename } from "./exportCsv"
import { emptyUsage } from "./period"
import type { CityRecord } from "./types"

function city(id: string, name: string, price: number, salary = 2000): CityRecord {
  return {
    id,
    name,
    country: "Test",
    monthly_net_salary: salary,
    monthly_work_hours: 100,
    prices: [{ category: "Test", item: ITEMS.coffee, price_usd: price }, { category: "Test", item: ITEMS.school, price_usd: 12000 }],
  }
}

describe("csv export", () => {
  const shanghai = city("1", "Shanghai", 4)
  const zurich = city("2", 'Zurich, "A"', 8)

  it("writes a BOM, Chinese headers, and both currencies", () => {
    const csv = buildItemsCsv({
      lang: "zh",
      cities: [shanghai, zurich],
      items: [ITEMS.coffee],
      overrides: {},
      horizon: "listed",
      usage: emptyUsage(),
    })
    expect(csv.startsWith("\uFEFF")).toBe(true)
    expect(itemsFilename("month")).toBe("ltp-items-month.csv")
    const rows = csv.slice(1).split("\r\n")
    expect(rows[0]).toContain("支出,口径,用量")
    expect(rows[0]).toContain("Shanghai USD")
    expect(rows[0]).toContain("Shanghai 劳动小时")
    expect(rows[0]).toContain('"Zurich, ""A"" USD"')
    expect(rows[1]).toContain("卡布奇诺（常规杯）")
    expect(rows[1]).toContain("4,0.2,0%")
    expect(rows[1]).toContain("8,0.4,+100%")
  })

  it("leaves a monthly unit blank until a count is filled, and divides a yearly fee", () => {
    const blank = buildItemsCsv({
      lang: "zh",
      cities: [shanghai],
      items: [ITEMS.coffee],
      overrides: {},
      horizon: "month",
      usage: emptyUsage(),
    })
    expect(blank).toContain("未填写本周期次数")
    expect(blank).not.toContain(",4,")

    const school = buildItemsCsv({
      lang: "en",
      cities: [shanghai],
      items: [ITEMS.school],
      overrides: {},
      horizon: "month",
      usage: emptyUsage(),
    })
    expect(school).toContain("1000,50")
  })

  it("exports combo lines and a total", () => {
    const csv = buildComboCsv({
      lang: "en",
      cities: [shanghai],
      lines: [{ item: ITEMS.coffee, quantity: 2 }],
      overrides: {},
      horizon: "listed",
      usage: emptyUsage(),
    })
    expect(describeQuantity("zh", "Price per Square Meter to Buy Apartment in City Centre", 70, "month", 20)).toBe(
      "70 平方米 · 20 年",
    )
    expect(describeQuantity("zh", "Price per Square Meter to Buy Apartment in City Centre", 70, "month", undefined)).toBe(
      "70 平方米 · 10 年",
    )
    expect(csv).toContain("Total")
    expect(csv).toContain("8,0.4")
  })

  it("converts displayed amounts and leaves labor hours in the USD calculation", () => {
    const csv = buildItemsCsv({
      lang: "en",
      cities: [shanghai],
      items: [ITEMS.coffee],
      overrides: {},
      horizon: "listed",
      usage: emptyUsage(),
      money: {
        currency: "CNY",
        rate: 2,
        date: "2026-11-16",
      },
    })
    expect(csv).toContain("Shanghai CNY")
    expect(csv).toContain("8,0.2,0%")
  })
})
