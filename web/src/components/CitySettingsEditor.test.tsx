// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { ITEMS } from "@/data/items"
import type { CityRecord } from "@/lib/types"
import { CitySettingsEditor } from "./CitySettingsEditor"

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

function renderEditor(props: {
  hoursOverrides?: Record<string, number>
  salaryOverrides?: Record<string, number>
}) {
  return render(
    <CitySettingsEditor
      lang="zh"
      cities={[alpha]}
      hoursOverrides={props.hoursOverrides ?? {}}
      salaryOverrides={props.salaryOverrides ?? {}}
      onHoursChange={() => {}}
      onSalaryChange={() => {}}
    />,
  )
}

describe("CitySettingsEditor source labels", () => {
  it("marks visitor hours and salary overrides", () => {
    const { container } = renderEditor({
      hoursOverrides: { alpha: 80 },
      salaryOverrides: { alpha: 6000 },
    })

    expect(container.textContent).toContain("已按你的工时")
    expect(container.textContent).toContain("已按你的收入")
  })

  it("labels city hours and Numbeo salary when there is no override", () => {
    const { container } = renderEditor({})

    expect(container.textContent).toContain("城市自带")
    expect(container.textContent).toContain("Numbeo 数据")
    expect(container.textContent).not.toContain("已按你的工时")
    expect(container.textContent).not.toContain("已按你的收入")
  })
})
