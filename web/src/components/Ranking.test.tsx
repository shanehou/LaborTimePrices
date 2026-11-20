// @vitest-environment jsdom
import { cleanup, render, within } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { ITEMS } from "@/data/items"
import { emptyUsage } from "@/lib/period"
import type { CityRecord } from "@/lib/types"
import { Ranking } from "./Ranking"

const period = { horizon: "listed" as const, mode: "single" as const, usage: emptyUsage() }
const lines = [{ item: ITEMS.coffee, quantity: 1 }]

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

function rankedRow(cityId: string): HTMLElement {
  const row = document.querySelector(`li[data-city="${cityId}"]`)
  if (!(row instanceof HTMLElement)) throw new Error(`Missing ranking row for ${cityId}`)
  return row
}

function renderRanking(props: {
  overrides?: Record<string, number>
  salaryOverrides?: Record<string, number>
}) {
  return render(
    <Ranking
      lang="zh"
      cities={[alpha, beta]}
      lines={lines}
      overrides={props.overrides ?? {}}
      salaryOverrides={props.salaryOverrides}
      period={period}
      customEmpty={false}
    />,
  )
}

afterEach(cleanup)

describe("Ranking visitor badges", () => {
  it("marks only the city whose salary was overridden by the visitor", () => {
    renderRanking({ salaryOverrides: { alpha: 6000 } })

    expect(within(rankedRow("alpha")).getByText("已按你的收入")).toBeTruthy()
    expect(within(rankedRow("alpha")).queryByText("已按你的工时")).toBeNull()
    expect(within(rankedRow("beta")).queryByText("已按你的收入")).toBeNull()
    expect(within(rankedRow("beta")).queryByText("已按你的工时")).toBeNull()
  })

  it("shows both visitor badges when hours and salary are overridden", () => {
    renderRanking({ overrides: { alpha: 80 }, salaryOverrides: { alpha: 6000 } })

    expect(within(rankedRow("alpha")).getByText("已按你的工时")).toBeTruthy()
    expect(within(rankedRow("alpha")).getByText("已按你的收入")).toBeTruthy()
    expect(within(rankedRow("beta")).queryByText("已按你的工时")).toBeNull()
    expect(within(rankedRow("beta")).queryByText("已按你的收入")).toBeNull()
  })

  it("shows no visitor badges without overrides", () => {
    const { container } = renderRanking({})

    expect(within(container).queryByText("已按你的工时")).toBeNull()
    expect(within(container).queryByText("已按你的收入")).toBeNull()
  })
})
