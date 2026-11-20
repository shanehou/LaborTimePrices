// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cadenceOf } from "@/data/cadence"
import { ITEMS } from "@/data/items"
import { emptyUsage, emptyUsageOverrides } from "@/lib/period"
import type { CustomBasket } from "@/lib/rankTarget"
import { BasketEditor } from "./BasketEditor"

afterEach(cleanup)

const car = "Volkswagen Golf 1.5 (or Equivalent New Compact Car)"
const coffee = ITEMS.coffee

function renderEditor(props: {
  custom: CustomBasket
  horizon?: "listed" | "month" | "year"
  onYears?: (item: string, years: number | undefined) => void
  onRate?: (item: string, rate: number | undefined) => void
}) {
  return render(
    <BasketEditor
      lang="zh"
      groups={[
        { category: "Transportation", items: [car] },
        { category: "Restaurants", items: [coffee] },
      ]}
      hasCities={false}
      cities={[]}
      custom={props.custom}
      horizon={props.horizon ?? "month"}
      usage={emptyUsage()}
      usageOverrides={emptyUsageOverrides()}
      onToggle={() => {}}
      onQuantity={() => {}}
      onYears={props.onYears ?? (() => {})}
      onRate={props.onRate ?? (() => {})}
      onRepayment={() => {}}
      onUsageOverride={() => {}}
    />,
  )
}

const checkedCar: CustomBasket = { [car]: { checked: true, quantity: "1" } }

describe("BasketEditor purchase fields", () => {
  it("shows the default amortization as a placeholder, not as editable text", () => {
    const { getByLabelText } = renderEditor({ custom: checkedCar })

    const years = getByLabelText(/的摊销年数/) as HTMLInputElement
    expect(years.value).toBe("")
    expect(years.placeholder).toBe("10")

    const rate = getByLabelText(/的年利率/) as HTMLInputElement
    expect(rate.value).toBe("")
  })

  it("keeps a cleared years field editable instead of snapping to the default", () => {
    const onYears = vi.fn()
    const { getByLabelText } = renderEditor({ custom: checkedCar, onYears })

    const years = getByLabelText(/的摊销年数/) as HTMLInputElement
    fireEvent.focus(years)
    fireEvent.change(years, { target: { value: "2" } })
    fireEvent.change(years, { target: { value: "20" } })
    expect(years.value).toBe("20")
    expect(onYears).toHaveBeenLastCalledWith(car, 20)

    fireEvent.change(years, { target: { value: "" } })
    expect(years.value).toBe("")
    expect(onYears).toHaveBeenLastCalledWith(car, undefined)

    fireEvent.blur(years)
    expect(years.value).toBe("")
    expect(years.placeholder).toBe("10")
  })

  it("reports a decimal rate and clears it when the field is emptied", () => {
    const onRate = vi.fn()
    const { getByLabelText } = renderEditor({ custom: checkedCar, onRate })

    const rate = getByLabelText(/的年利率/) as HTMLInputElement
    fireEvent.focus(rate)
    fireEvent.change(rate, { target: { value: "3.5" } })
    expect(onRate).toHaveBeenLastCalledWith(car, 3.5)

    fireEvent.change(rate, { target: { value: "" } })
    expect(rate.value).toBe("")
    expect(onRate).toHaveBeenLastCalledWith(car, undefined)
  })

  it("only shows amortization fields for purchased items in a period view", () => {
    const purchase = renderEditor({ custom: checkedCar, horizon: "listed" })
    expect(purchase.queryByLabelText(/摊销年数/)).toBeNull()
    expect(purchase.queryByLabelText(/年利率/)).toBeNull()
    cleanup()

    const unit = renderEditor({
      custom: { [coffee]: { checked: true, quantity: "1" } },
      horizon: "month",
    })
    expect(cadenceOf(coffee)).toBe("unit")
    expect(unit.queryByLabelText(/摊销年数/)).toBeNull()
    expect(unit.queryByLabelText(/年利率/)).toBeNull()
  })
})
