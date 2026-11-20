// @vitest-environment jsdom
import { cleanup, render, within } from "@testing-library/react"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { ITEMS } from "@/data/items"
import type { CityRecord } from "@/lib/types"
import { CompareTable } from "./CompareTable"

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverStub)
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0)
    return 0
  })
})

afterAll(() => {
  vi.unstubAllGlobals()
})

afterEach(cleanup)

function city(partial: Partial<CityRecord> & Pick<CityRecord, "id">): CityRecord {
  return {
    name: partial.id,
    country: "Test",
    monthly_net_salary: 3000,
    monthly_work_hours: 150,
    prices: [{ category: "Restaurants", item: ITEMS.coffee, price_usd: 5 }],
    ...partial,
  }
}

const alpha = city({ id: "alpha", name: "Alpha" })
const beta = city({ id: "beta", name: "Beta" })

function cityHeader(cityId: string): HTMLElement {
  const header = document.querySelector(`th[data-city="${cityId}"]`)
  if (!(header instanceof HTMLElement)) throw new Error(`Missing compare header for ${cityId}`)
  return header
}

describe("CompareTable visitor badges", () => {
  it("marks the city whose hours and salary were overridden", () => {
    render(
      <CompareTable
        lang="zh"
        cities={[alpha, beta]}
        overrides={{ alpha: 80 }}
        salaryOverrides={{ alpha: 6000 }}
        unit="hours"
        onUnit={() => {}}
      />,
    )

    expect(within(cityHeader("alpha")).getByText("已按你的工时")).toBeTruthy()
    expect(within(cityHeader("alpha")).getByText("已按你的收入")).toBeTruthy()
    expect(within(cityHeader("beta")).queryByText("已按你的工时")).toBeNull()
    expect(within(cityHeader("beta")).queryByText("已按你的收入")).toBeNull()
  })
})
