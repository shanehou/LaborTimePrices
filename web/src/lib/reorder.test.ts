import { describe, expect, it } from "vitest"
import { moveItem } from "./reorder"

describe("moveItem", () => {
  it("moves an item forward and backward", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"])
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"])
    expect(moveItem(["a", "b", "c"], 1, 2)).toEqual(["a", "c", "b"])
  })

  it("returns a copy without changing the order for invalid moves", () => {
    const items = ["a", "b", "c"]
    const same = moveItem(items, 1, 1)
    expect(same).toEqual(items)
    expect(same).not.toBe(items)
    expect(moveItem(items, -1, 0)).toEqual(items)
    expect(moveItem(items, 0, 3)).toEqual(items)
    expect(moveItem(items, 0.5, 1)).toEqual(items)
  })
})
