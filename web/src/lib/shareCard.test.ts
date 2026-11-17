import { describe, expect, it } from "vitest"
import { buildShareCard } from "./shareCard"
import { emptyUsage } from "./period"

const car = "Volkswagen Golf 1.5 (or Equivalent New Compact Car)"

describe("share card", () => {
  it("does not add an amortization note", () => {
    const card = buildShareCard({
      lang: "zh",
      tab: "combos",
      horizon: "month",
      cities: [],
      overrides: {},
      comboTarget: "basket:custom",
      customName: "两人的月",
      lines: [{ item: car, quantity: 1 }],
      usage: {
        ...emptyUsage(),
        years: { [car]: 8 },
        rates: { [car]: 3.5 },
        repayments: { [car]: "payment" },
      },
    })
    expect(card.note).toBeNull()
    expect(card.title).toBe("两人的月")
    expect(card.lines[0]?.detail).toBe("1 件 · 8 年 · 3.5% 等额本息")
  })
})
