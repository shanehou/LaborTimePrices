import { describe, expect, it } from "vitest"
import { en } from "./en"
import { zh } from "./zh"
import { labelCountry, labelItem, t } from "./index"
import { cityMatches } from "../lib/search"

describe("i18n", () => {
  it("falls back to English when a Chinese string is missing", () => {
    expect(t("zh", "brandTitle")).toBe("同样的东西，\n要工作多久")
    expect(t("en", "brandTitle")).toBe("The same things,\nin hours of work")
    const record = zh as Record<string, string>
    const saved = record.brandLead
    record.brandLead = ""
    expect(t("zh", "brandLead")).toBe(en.brandLead)
    record.brandLead = saved
  })

  it("shows the English item when there is no Chinese label", () => {
    expect(labelItem("zh", "Cappuccino")).toBe("卡布奇诺")
    expect(labelItem("zh", "Unknown Pastry")).toBe("Unknown Pastry")
    expect(labelItem("en", "Cappuccino")).toBe("Cappuccino")
  })

  it("searches the English city name and the country in the current language", () => {
    const lisbon = { name: "Lisbon", country: "Portugal" }
    expect(cityMatches(lisbon, "lis", "zh")).toBe(true)
    expect(cityMatches(lisbon, "葡萄牙", "zh")).toBe(true)
    expect(cityMatches(lisbon, "Portugal", "zh")).toBe(false)
    expect(cityMatches(lisbon, "Portugal", "en")).toBe(true)
    expect(cityMatches(lisbon, "葡萄牙", "en")).toBe(false)
    expect(labelCountry("zh", "Portugal")).toBe("葡萄牙")
    expect(labelCountry("en", "Nowhere")).toBe("Nowhere")
  })
})
