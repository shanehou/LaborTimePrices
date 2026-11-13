import { afterEach, describe, expect, it, vi } from "vitest"
import { languageFromTag, readHourOverrides, writeHourOverride } from "./storage"

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
})
