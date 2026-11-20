// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { NumberField } from "./NumberField"

afterEach(cleanup)

function Harness({ initial, placeholder }: { initial?: number; placeholder?: string }) {
  const [value, setValue] = useState<number | undefined>(initial)
  return <NumberField value={value} placeholder={placeholder} label="years" onValue={setValue} />
}

function input(container: HTMLElement): HTMLInputElement {
  const element = container.querySelector("input")
  if (!element) throw new Error("missing input")
  return element
}

describe("NumberField", () => {
  it("shows the fallback as a placeholder instead of editable text", () => {
    const { container } = render(<Harness placeholder="10" />)
    expect(input(container).value).toBe("")
    expect(input(container).placeholder).toBe("10")
  })

  it("can be cleared and replaced without snapping back", () => {
    const { container } = render(<Harness initial={10} />)
    const field = input(container)

    fireEvent.focus(field)
    expect(field.value).toBe("10")

    fireEvent.change(field, { target: { value: "1" } })
    expect(field.value).toBe("1")

    fireEvent.change(field, { target: { value: "" } })
    expect(field.value).toBe("")

    fireEvent.change(field, { target: { value: "2" } })
    fireEvent.change(field, { target: { value: "20" } })
    expect(field.value).toBe("20")

    fireEvent.blur(field)
    expect(field.value).toBe("20")
  })

  it("keeps an emptied field empty after blur", () => {
    const { container } = render(<Harness placeholder="10" />)
    const field = input(container)

    fireEvent.focus(field)
    fireEvent.change(field, { target: { value: "20" } })
    fireEvent.change(field, { target: { value: "" } })
    expect(field.value).toBe("")

    fireEvent.blur(field)
    expect(field.value).toBe("")
  })

  it("follows outside changes while it is not focused", () => {
    const { container, rerender } = render(
      <NumberField value={4} label="years" onValue={() => {}} />,
    )
    const field = input(container)
    expect(field.value).toBe("4")

    rerender(<NumberField value={6} label="years" onValue={() => {}} />)
    expect(field.value).toBe("6")
  })

  it("reports positive numbers, ignores invalid text, and clears on blank", () => {
    const onValue = vi.fn()
    const { container } = render(
      <NumberField value={undefined} label="rate" onValue={onValue} />,
    )
    const field = input(container)

    fireEvent.focus(field)
    for (const text of ["0", "-2", "nope", "Infinity"]) {
      fireEvent.change(field, { target: { value: text } })
      expect(field.value).toBe(text)
    }
    expect(onValue).not.toHaveBeenCalled()

    fireEvent.change(field, { target: { value: "2.5" } })
    expect(onValue).toHaveBeenLastCalledWith(2.5)

    fireEvent.change(field, { target: { value: "  " } })
    expect(onValue).toHaveBeenLastCalledWith(undefined)
  })

  it("restores the current value after invalid text on blur", () => {
    const { container } = render(
      <NumberField value={10} label="years" onValue={() => {}} />,
    )
    const field = input(container)

    fireEvent.focus(field)
    fireEvent.change(field, { target: { value: "nope" } })
    expect(field.value).toBe("nope")

    fireEvent.blur(field)
    expect(field.value).toBe("10")
  })

  it("keeps an in-progress edit when the value changes elsewhere", () => {
    const { container, rerender } = render(
      <NumberField value={4} label="years" onValue={() => {}} />,
    )
    const field = input(container)

    fireEvent.focus(field)
    fireEvent.change(field, { target: { value: "7" } })
    rerender(<NumberField value={9} label="years" onValue={() => {}} />)
    expect(field.value).toBe("7")

    fireEvent.blur(field)
    expect(field.value).toBe("9")
  })

  it("forwards the label, placeholder, class name, and decimal keyboard hint", () => {
    const { container } = render(
      <NumberField
        className="h-8 w-20 text-xs"
        value={undefined}
        placeholder="3.5"
        label="Annual rate"
        onValue={() => {}}
      />,
    )
    const field = input(container)

    expect(field.getAttribute("aria-label")).toBe("Annual rate")
    expect(field.placeholder).toBe("3.5")
    expect(field.className).toContain("h-8")
    expect(field.className).toContain("w-20")
    expect(field.getAttribute("inputmode")).toBe("decimal")
  })
})
