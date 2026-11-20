// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
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

function SalaryHarness({
  onSalaryChange,
}: {
  onSalaryChange?: (cityId: string, salaryUsd: number | null) => void
}) {
  const [salaryOverrides, setSalaryOverrides] = useState<Record<string, number>>({})
  return (
    <CitySettingsEditor
      lang="zh"
      cities={[alpha]}
      hoursOverrides={{}}
      salaryOverrides={salaryOverrides}
      onHoursChange={() => {}}
      onSalaryChange={(cityId, salaryUsd) => {
        onSalaryChange?.(cityId, salaryUsd)
        setSalaryOverrides((current) => {
          const next = { ...current }
          if (salaryUsd === null) delete next[cityId]
          else next[cityId] = salaryUsd
          return next
        })
      }}
    />
  )
}

function input(label: string): HTMLInputElement {
  return screen.getByLabelText(label) as HTMLInputElement
}

describe("CitySettingsEditor income period", () => {
  it("shows the same income as a monthly or yearly figure", () => {
    render(<SalaryHarness />)

    expect(input("Alpha 的税后月薪").value).toBe("3000")
    fireEvent.click(screen.getByRole("radio", { name: "按年" }))
    expect(input("Alpha 的税后年薪").value).toBe("36000")

    fireEvent.click(screen.getByRole("radio", { name: "按月" }))
    expect(input("Alpha 的税后月薪").value).toBe("3000")
  })

  it("stores a yearly income as the monthly equivalent", () => {
    const onSalaryChange = vi.fn()
    render(<SalaryHarness onSalaryChange={onSalaryChange} />)

    fireEvent.click(screen.getByRole("radio", { name: "按年" }))
    const field = input("Alpha 的税后年薪")
    fireEvent.focus(field)
    fireEvent.change(field, { target: { value: "48000" } })
    fireEvent.blur(field)

    expect(onSalaryChange).toHaveBeenLastCalledWith("alpha", 4000)
    expect(screen.getByText("已按你的收入")).toBeTruthy()

    fireEvent.click(screen.getByRole("radio", { name: "按月" }))
    expect(input("Alpha 的税后月薪").value).toBe("4000")
  })

  it("treats the yearly default as the city value rather than an override", () => {
    const onSalaryChange = vi.fn()
    render(<SalaryHarness onSalaryChange={onSalaryChange} />)

    fireEvent.click(screen.getByRole("radio", { name: "按年" }))
    const field = input("Alpha 的税后年薪")
    fireEvent.focus(field)
    fireEvent.change(field, { target: { value: "30000" } })
    expect(onSalaryChange).toHaveBeenLastCalledWith("alpha", 2500)

    fireEvent.change(field, { target: { value: "36000" } })
    expect(onSalaryChange).toHaveBeenLastCalledWith("alpha", null)
  })
})

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
