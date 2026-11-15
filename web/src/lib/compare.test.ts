import { describe, expect, it } from "vitest"
import { deltaTone, formatDeltaPercent, percentDelta } from "./compare"

describe("percentDelta", () => {
  it("returns the relative difference from the baseline", () => {
    expect(percentDelta(110, 100)).toBeCloseTo(0.1)
    expect(percentDelta(90, 100)).toBeCloseTo(-0.1)
    expect(percentDelta(100, 100)).toBe(0)
  })

  it("refuses a non-positive or non-finite baseline and non-finite values", () => {
    expect(percentDelta(5, 0)).toBeNull()
    expect(percentDelta(5, -10)).toBeNull()
    expect(percentDelta(5, Number.NaN)).toBeNull()
    expect(percentDelta(Number.POSITIVE_INFINITY, 10)).toBeNull()
  })
})

describe("deltaTone", () => {
  it("uses red for higher in Chinese and green for higher in English", () => {
    expect(deltaTone("zh", 0.12)).toBe("red")
    expect(deltaTone("zh", -0.12)).toBe("green")
    expect(deltaTone("en", 0.12)).toBe("green")
    expect(deltaTone("en", -0.12)).toBe("red")
  })

  it("is neutral for zero and non-finite deltas", () => {
    expect(deltaTone("zh", 0)).toBe("neutral")
    expect(deltaTone("en", 0)).toBe("neutral")
    expect(deltaTone("zh", Number.NaN)).toBe("neutral")
  })

  it("treats a delta that rounds to 0% as neutral", () => {
    expect(deltaTone("zh", 0.004)).toBe("neutral")
    expect(deltaTone("en", -0.004)).toBe("neutral")
  })
})

describe("formatDeltaPercent", () => {
  it("adds a plus sign only for positive deltas", () => {
    expect(formatDeltaPercent("zh", 0.4123)).toBe("+41%")
    expect(formatDeltaPercent("en", -0.12)).toBe("-12%")
    expect(formatDeltaPercent("en", 0)).toBe("0%")
  })

  it("prints 0% instead of -0% for deltas that round to zero", () => {
    expect(formatDeltaPercent("en", -0.004)).toBe("0%")
  })
})
