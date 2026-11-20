// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ITEMS } from "@/data/items"
import { emptyUsage } from "@/lib/period"
import { ItemUsage } from "./ItemUsage"

afterEach(cleanup)

const car = "Volkswagen Golf 1.5 (or Equivalent New Compact Car)"
const apartment = "Price per Square Meter to Buy Apartment in City Centre"

describe("ItemUsage number fields", () => {
  it("reports and clears a purchase's amortization years", () => {
    const onYears = vi.fn()
    const { getByLabelText } = render(
      <ItemUsage
        lang="zh"
        item={car}
        horizon="month"
        mode="single"
        usage={emptyUsage()}
        onYears={onYears}
      />,
    )

    const years = getByLabelText(/的摊销年数/) as HTMLInputElement
    expect(years.value).toBe("")

    fireEvent.focus(years)
    fireEvent.change(years, { target: { value: "5" } })
    expect(onYears).toHaveBeenLastCalledWith(car, 5)

    fireEvent.change(years, { target: { value: "" } })
    expect(years.value).toBe("")
    expect(onYears).toHaveBeenLastCalledWith(car, undefined)
  })

  it("reports and clears a floor area", () => {
    const onArea = vi.fn()
    const { getByLabelText } = render(
      <ItemUsage
        lang="zh"
        item={apartment}
        horizon="month"
        mode="single"
        usage={emptyUsage()}
        onArea={onArea}
      />,
    )

    const area = getByLabelText(/的平方米/) as HTMLInputElement
    fireEvent.focus(area)
    fireEvent.change(area, { target: { value: "72" } })
    expect(onArea).toHaveBeenLastCalledWith(apartment, 72)

    fireEvent.change(area, { target: { value: "" } })
    expect(onArea).toHaveBeenLastCalledWith(apartment, undefined)
  })

  it("reports and clears how many times a unit item occurs", () => {
    const onTimes = vi.fn()
    const { getByLabelText } = render(
      <ItemUsage
        lang="zh"
        item={ITEMS.coffee}
        horizon="month"
        mode="single"
        usage={emptyUsage()}
        onTimes={onTimes}
      />,
    )

    const times = getByLabelText(/的本周期次数/) as HTMLInputElement
    fireEvent.focus(times)
    fireEvent.change(times, { target: { value: "3" } })
    expect(onTimes).toHaveBeenLastCalledWith(ITEMS.coffee, 3)

    fireEvent.change(times, { target: { value: "" } })
    expect(onTimes).toHaveBeenLastCalledWith(ITEMS.coffee, undefined)
  })

  it("hides period usage fields for listed prices", () => {
    const onYears = vi.fn()
    const { queryByLabelText } = render(
      <ItemUsage
        lang="zh"
        item={car}
        horizon="listed"
        mode="single"
        usage={emptyUsage()}
        onYears={onYears}
      />,
    )

    expect(queryByLabelText(/的摊销年数/)).toBeNull()
  })
})
