import { describe, expect, it } from "vitest"
import { ITEMS, NUMBEO_ITEMS } from "../data/items"
import { cityMatches } from "../lib/search"
import { en } from "./en"
import { labelCategory, labelCountry, labelItem, t } from "./index"
import { zh, zhCategoryLabels, zhCountryLabels, zhItemLabels } from "./zh"

describe("i18n", () => {
  it("keeps the Chinese catalog in sync with the English keys", () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(typeof zh[key]).toBe("string")
      expect(zh[key].trim()).not.toBe("")
    }
  })

  it("falls back to English when a Chinese string is missing", () => {
    expect(t("zh", "brandTitle")).toBe("同样的东西，\n要工作多久")
    expect(t("en", "brandTitle")).toBe("The same things,\nin hours of work")
    const record = zh as unknown as Record<string, string>
    const saved = record.brandLead
    record.brandLead = ""
    expect(t("zh", "brandLead")).toBe(en.brandLead)
    record.brandLead = saved
  })

  it("shows the English item when there is no Chinese label", () => {
    expect(labelItem("zh", ITEMS.coffee)).toBe("卡布奇诺（常规杯）")
    expect(labelItem("zh", "Unknown Pastry")).toBe("Unknown Pastry")
    expect(labelItem("en", ITEMS.coffee)).toBe(ITEMS.coffee)
  })

  it("labels every Numbeo item in Chinese and keeps English in English", () => {
    expect(new Set(NUMBEO_ITEMS).size).toBe(NUMBEO_ITEMS.length)
    const labels = NUMBEO_ITEMS.map((item) => {
      expect(zhItemLabels[item]).toBeTruthy()
      const zhLabel = labelItem("zh", item)
      expect(zhLabel).not.toBe(item)
      expect(/[\u4e00-\u9fff]/.test(zhLabel)).toBe(true)
      expect(labelItem("en", item)).toBe(item)
      return zhLabel
    })
    expect(new Set(labels).size).toBe(labels.length)
  })

  it("labels the built-in basket items", () => {
    for (const item of Object.values(ITEMS)) {
      expect(zhItemLabels[item]).toBeTruthy()
    }
    expect(labelItem("zh", ITEMS.utilities)).toContain("85")
    expect(labelItem("zh", ITEMS.school)).toContain("国际小学")
  })

  it("labels the ten Numbeo categories", () => {
    const categories = [
      "Restaurants",
      "Markets",
      "Transportation",
      "Utilities (Monthly)",
      "Sports And Leisure",
      "Childcare",
      "Clothing And Shoes",
      "Personal Care and Household Services",
      "Rent Per Month",
      "Buy Apartment Price",
    ]
    expect(Object.keys(zhCategoryLabels).sort()).toEqual([...categories].sort())
    for (const category of categories) {
      expect(labelCategory("zh", category)).not.toBe(category)
      expect(labelCategory("en", category)).toBe(category)
    }
  })

  it("labels common countries and falls back to English", () => {
    expect(Object.keys(zhCountryLabels).length).toBeGreaterThanOrEqual(40)
    expect(labelCountry("zh", "Portugal")).toBe("葡萄牙")
    expect(labelCountry("zh", "China")).toBe("中国")
    expect(labelCountry("en", "Nowhere")).toBe("Nowhere")
    expect(labelCountry("zh", "Nowhere")).toBe("Nowhere")
  })

  it("searches the English city name and the country in the current language", () => {
    const lisbon = { name: "Lisbon", country: "Portugal" }
    expect(cityMatches(lisbon, "lis", "zh")).toBe(true)
    expect(cityMatches(lisbon, "葡萄牙", "zh")).toBe(true)
    expect(cityMatches(lisbon, "Portugal", "zh")).toBe(false)
    expect(cityMatches(lisbon, "Portugal", "en")).toBe(true)
    expect(cityMatches(lisbon, "葡萄牙", "en")).toBe(false)
  })
})
