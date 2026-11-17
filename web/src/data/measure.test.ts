import { describe, expect, it } from "vitest"
import { cadenceOf } from "./cadence"
import { ITEMS } from "./items"
import {
  canonicalizePrices,
  englishItemName,
  priceUsdFor,
  showsImperialArea,
} from "./measure"
import { labelItem } from "../i18n"

const IMPERIAL_UTILITIES =
  "Basic Utilities for 915 Square Feet Apartment (Electricity, Heating, Cooling, Water, Garbage)"
const SQUARE_FEET = "Price per Square Feet to Buy Apartment in City Centre"
const SQUARE_METER = "Price per Square Meter to Buy Apartment in City Centre"

describe("measurement units", () => {
  it("keeps an imperial-only row and drops it when the metric row is also present", () => {
    expect(
      canonicalizePrices([
        { category: "Markets", item: "Apples (1 lb)", price_usd: 1.03 },
        { category: "Utilities (Monthly)", item: IMPERIAL_UTILITIES, price_usd: 10 },
        { category: "Utilities (Monthly)", item: ITEMS.utilities, price_usd: 59.47 },
      ]),
    ).toEqual([
      { category: "Markets", item: "Apples (1 lb)", price_usd: 1.03 },
      { category: "Utilities (Monthly)", item: ITEMS.utilities, price_usd: 59.47 },
    ])
  })

  it("shows the original unit in English and the metric unit in Chinese", () => {
    const imperial = [{ item: "Apples (1 lb)" }]
    expect(englishItemName("Apples (1 kg)", imperial)).toBe("Apples (1 lb)")
    expect(labelItem("en", "Apples (1 kg)", imperial)).toBe("Apples (1 lb)")
    expect(labelItem("zh", "Apples (1 lb)")).toBe("苹果（1 千克）")
    expect(priceUsdFor("en", { item: "Apples (1 lb)", price_usd: 1.03 }, imperial)).toBe(1.03)
    expect(priceUsdFor("zh", { item: "Apples (1 lb)", price_usd: 1.03 }, imperial)).toBe(2.27)
    expect(cadenceOf(IMPERIAL_UTILITIES)).toBe("monthly")
    expect(labelItem("zh", IMPERIAL_UTILITIES)).toBe("85 平米公寓基本水电（电、暖气、冷气、水、垃圾）")
    expect(priceUsdFor("zh", { item: IMPERIAL_UTILITIES, price_usd: 59.47 }, [{ item: IMPERIAL_UTILITIES }])).toBe(
      59.47,
    )
  })

  it("prefers metric for English when both units are in the loaded rows", () => {
    const both = [{ item: "Apples (1 lb)" }, { item: "Apples (1 kg)" }]
    expect(labelItem("en", "Apples (1 kg)", both)).toBe("Apples (1 kg)")
    expect(priceUsdFor("en", { item: "Apples (1 lb)", price_usd: 1.03 }, both)).toBe(2.27)
    expect(showsImperialArea("en", SQUARE_METER, [{ item: SQUARE_FEET }])).toBe(true)
    expect(showsImperialArea("en", SQUARE_METER, [{ item: SQUARE_METER }, { item: SQUARE_FEET }])).toBe(false)
    expect(showsImperialArea("zh", SQUARE_METER, [{ item: SQUARE_FEET }])).toBe(false)
  })
})
