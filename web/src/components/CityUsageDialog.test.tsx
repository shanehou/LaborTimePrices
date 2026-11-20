// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ITEMS } from "@/data/items"
import {
  emptyUsage,
  emptyUsageOverrides,
  setUsageOverrideNumber,
  type Usage,
  type UsageOverrides,
} from "@/lib/period"
import type { CityRecord } from "@/lib/types"
import { CityUsageDialog, type UsageOverridePatch } from "./CityUsageDialog"

afterEach(cleanup)

const car = "Volkswagen Golf 1.5 (or Equivalent New Compact Car)"
const apartment = "Price per Square Meter to Buy Apartment in City Centre"

function city(partial: Partial<CityRecord> & Pick<CityRecord, "id">): CityRecord {
  return {
    name: partial.id,
    country: "Test",
    monthly_net_salary: 3000,
    monthly_work_hours: 150,
    prices: [],
    ...partial,
  }
}

const shanghai = city({ id: "1", name: "Shanghai", mortgage_rate: 3.5 })
const zurich = city({ id: "2", name: "Zurich" })

async function openDialog(props: {
  item?: string
  cities?: CityRecord[]
  usage?: Usage
  overrides?: UsageOverrides
  sharedArea?: number
  onOverride?: (item: string, cityId: string, patch: UsageOverridePatch) => void
}) {
  render(
    <CityUsageDialog
      lang="zh"
      item={props.item ?? car}
      cities={props.cities ?? [shanghai]}
      usage={props.usage ?? emptyUsage()}
      overrides={props.overrides ?? emptyUsageOverrides()}
      sharedArea={props.sharedArea}
      onOverride={props.onOverride ?? (() => {})}
    />,
  )
  fireEvent.click(screen.getByRole("button", { name: /按城市/ }))
  return screen.findByRole("dialog")
}

describe("CityUsageDialog number fields", () => {
  it("uses resolved financing as placeholders and an existing override as the value", async () => {
    const overrides = setUsageOverrideNumber(emptyUsageOverrides(), "years", car, "1", 5)
    const dialog = await openDialog({ overrides })

    const years = within(dialog).getByLabelText(/的摊销年数/) as HTMLInputElement
    expect(years.value).toBe("5")
    expect(years.placeholder).toBe("5")

    const rate = within(dialog).getByLabelText(/的年利率/) as HTMLInputElement
    expect(rate.value).toBe("")
    expect(rate.placeholder).toBe("3.5")
    expect(within(dialog).getByText("Numbeo 20 年固定")).toBeTruthy()
  })

  it("sends a positive year and clears the override when the field is emptied", async () => {
    const onOverride = vi.fn()
    const dialog = await openDialog({ onOverride })

    const years = within(dialog).getByLabelText(/的摊销年数/) as HTMLInputElement
    expect(years.placeholder).toBe("20")
    fireEvent.focus(years)
    fireEvent.change(years, { target: { value: "5" } })
    expect(onOverride).toHaveBeenLastCalledWith(car, "1", { years: 5 })

    fireEvent.change(years, { target: { value: "" } })
    expect(years.value).toBe("")
    expect(onOverride).toHaveBeenLastCalledWith(car, "1", { years: null })
  })

  it("edits the rate per city without affecting other rows", async () => {
    const onOverride = vi.fn()
    const dialog = await openDialog({ cities: [shanghai, zurich], onOverride })

    const rows = within(dialog).getAllByRole("row")
    const shanghaiRow = rows.find((row) => row.textContent?.includes("Shanghai"))
    const zurichRow = rows.find((row) => row.textContent?.includes("Zurich"))
    if (!shanghaiRow || !zurichRow) throw new Error("missing city rows")

    const shanghaiRate = within(shanghaiRow).getByLabelText(/的年利率/) as HTMLInputElement
    const zurichRate = within(zurichRow).getByLabelText(/的年利率/) as HTMLInputElement
    expect(shanghaiRate.placeholder).toBe("3.5")
    expect(zurichRate.placeholder).toBe("—")

    fireEvent.focus(shanghaiRate)
    fireEvent.change(shanghaiRate, { target: { value: "6.2" } })
    expect(onOverride).toHaveBeenLastCalledWith(car, "1", { rate: 6.2 })
    expect(zurichRate.value).toBe("")
  })

  it("defaults the floor area to the shared quantity and clears it per city", async () => {
    const onOverride = vi.fn()
    const dialog = await openDialog({
      item: apartment,
      cities: [zurich],
      sharedArea: 72,
      onOverride,
    })

    const area = within(dialog).getByLabelText(/的平方米/) as HTMLInputElement
    expect(area.value).toBe("")
    expect(area.placeholder).toBe("72")

    fireEvent.focus(area)
    fireEvent.change(area, { target: { value: "90" } })
    expect(onOverride).toHaveBeenLastCalledWith(apartment, "2", { area: 90 })

    fireEvent.change(area, { target: { value: "" } })
    expect(onOverride).toHaveBeenLastCalledWith(apartment, "2", { area: null })
  })

  it("uses a dash when the floor area has no shared quantity", async () => {
    const dialog = await openDialog({ item: apartment, cities: [zurich] })

    const area = within(dialog).getByLabelText(/的平方米/) as HTMLInputElement
    expect(area.placeholder).toBe("—")
  })

  it("does not render a per-city button for non-purchase items", () => {
    const { container } = render(
      <CityUsageDialog
        lang="zh"
        item={ITEMS.coffee}
        cities={[shanghai]}
        usage={emptyUsage()}
        overrides={emptyUsageOverrides()}
        onOverride={() => {}}
      />,
    )
    expect(container.innerHTML).toBe("")
  })
})
