import { afterEach, describe, expect, it, vi } from "vitest"
import { emptyUsage } from "./period"
import {
  languageFromTag,
  readComboLibrary,
  readCurrency,
  readHourOverrides,
  readPeriod,
  readSalaryOverrides,
  readUsageOverrides,
  writeComboLibrary,
  writeCurrency,
  writeHourOverride,
  writePeriod,
  writeSalaryOverride,
  writeUsageOverrides,
} from "./storage"

describe("languageFromTag", () => {
  it("uses Chinese only when the tag starts with zh", () => {
    expect(languageFromTag("zh-CN")).toBe("zh")
    expect(languageFromTag("zh-Hans")).toBe("zh")
    expect(languageFromTag("ZH")).toBe("zh")
    expect(languageFromTag("en-US")).toBe("en")
    expect(languageFromTag("pt-PT")).toBe("en")
    expect(languageFromTag(undefined)).toBe("en")
  })
})

describe("writeHourOverride", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("stores hours for one city without changing another", () => {
    const memory = new Map<string, string>()
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value)
      },
      removeItem: (key: string) => {
        memory.delete(key)
      },
    })

    writeHourOverride("shanghai", 80)
    writeHourOverride("zurich", 100)
    writeHourOverride("shanghai", 60)
    expect(readHourOverrides()).toEqual({ shanghai: 60, zurich: 100 })
    writeHourOverride("shanghai", null)
    expect(readHourOverrides()).toEqual({ zurich: 100 })
  })

  it("stores per-city salaries in USD and per-city usage overrides", () => {
    const memory = new Map<string, string>()
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value)
      },
      removeItem: (key: string) => {
        memory.delete(key)
      },
    })

    writeSalaryOverride("shanghai", 2500)
    writeSalaryOverride("zurich", 5100.5)
    writeSalaryOverride("shanghai", 2600)
    expect(readSalaryOverrides()).toEqual({ shanghai: 2600, zurich: 5100.5 })
    writeSalaryOverride("shanghai", null)
    expect(readSalaryOverrides()).toEqual({ zurich: 5100.5 })

    const car = "Volkswagen Golf 1.5 (or Equivalent New Compact Car)"
    writeUsageOverrides({
      area: {},
      years: { [car]: { "3781": 20 } },
      rates: { [car]: { "3781": 3.3, "1064": 1.1 } },
      repayments: { [car]: { "3781": "principal" } },
    })
    expect(readUsageOverrides()).toEqual({
      area: {},
      years: { [car]: { "3781": 20 } },
      rates: { [car]: { "3781": 3.3, "1064": 1.1 } },
      repayments: { [car]: { "3781": "principal" } },
    })

    // Broken payloads fall back to empty instead of throwing.
    memory.set("ltp.usageOverrides", "{")
    expect(readUsageOverrides()).toEqual({
      area: {},
      years: {},
      rates: {},
      repayments: {},
    })
    memory.set(
      "ltp.usageOverrides",
      JSON.stringify({
        years: { [car]: { "3781": 20, "9": -5, "": 3 } },
        rates: { [car]: { "3781": "high" } },
        repayments: { [car]: { "3781": "interest-only" } },
      }),
    )
    expect(readUsageOverrides()).toEqual({
      area: {},
      years: { [car]: { "3781": 20 } },
      rates: {},
      repayments: {},
    })
  })

  it("stores the horizon and drops non-positive usage", () => {
    const memory = new Map<string, string>()
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value)
      },
      removeItem: (key: string) => {
        memory.delete(key)
      },
    })
    writePeriod({
      horizon: "year",
      usage: {
        ...emptyUsage(),
        times: { coffee: 30, tea: 0 },
        years: { car: 10 },
        area: { home: Number.NaN },
      },
    })
    expect(readPeriod()).toEqual({
      horizon: "year",
      usage: { times: { coffee: 30 }, years: { car: 10 }, area: {}, rates: {}, repayments: {} },
    })
  })

  it("folds a saved US item name onto the metric catalog", () => {
    const memory = new Map<string, string>()
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value)
      },
      removeItem: (key: string) => {
        memory.delete(key)
      },
    })
    memory.set(
      "ltp.period",
      JSON.stringify({
        horizon: "month",
        usage: {
          times: { "Apples (1 lb)": 4, "Apples (1 kg)": 2 },
          years: {},
          area: {
            "Price per Square Feet to Buy Apartment Outside of Centre": 80,
          },
        },
      }),
    )
    expect(readPeriod()).toEqual({
      horizon: "month",
      usage: {
        times: { "Apples (1 kg)": 2 },
        years: {},
        area: { "Price per Square Meter to Buy Apartment Outside of Centre": 80 },
        rates: {},
        repayments: {},
      },
    })
  })

  it("keeps a positive purchase rate and drops a repayment that is not one of the two modes", () => {
    const memory = new Map<string, string>()
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value)
      },
      removeItem: (key: string) => {
        memory.delete(key)
      },
    })
    memory.set(
      "ltp.period",
      JSON.stringify({
        horizon: "month",
        usage: {
          times: {},
          years: {},
          area: {},
          rates: { car: 3.25, rent: 0 },
          repayments: { car: "principal", rent: "interest-only" },
        },
      }),
    )
    expect(readPeriod().usage.rates).toEqual({ car: 3.25 })
    expect(readPeriod().usage.repayments).toEqual({ car: "principal" })
  })

  it("stores named combos and ignores a broken library", () => {
    const memory = new Map<string, string>()
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value)
      },
      removeItem: (key: string) => {
        memory.delete(key)
      },
    })
    writeComboLibrary({
      activeId: "a",
      combos: [
        {
          id: "a",
          name: "月费",
          basket: { coffee: { checked: true, quantity: "2" } },
          years: { car: 9 },
          rates: { car: 2.8 },
          repayments: { car: "payment" },
        },
      ],
    })
    expect(readComboLibrary().combos[0]?.name).toBe("月费")
    expect(readComboLibrary().combos[0]?.rates).toEqual({ car: 2.8 })
    expect(readComboLibrary().combos[0]?.repayments).toEqual({ car: "payment" })
    expect(readComboLibrary().activeId).toBe("a")
    memory.set("ltp.combos", "{")
    expect(readComboLibrary()).toEqual({ combos: [], activeId: null })
    writeCurrency("CNY")
    expect(readCurrency()).toBe("CNY")
  })
})
