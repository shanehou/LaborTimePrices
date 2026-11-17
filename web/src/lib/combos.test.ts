import { describe, expect, it } from "vitest"
import { ITEMS } from "../data/items"
import { CUSTOM_TARGET, PRESET_TARGET } from "./rankTarget"
import {
  appendCombo,
  COMBO_LIMIT,
  emptyLibrary,
  normalizeLibrary,
  presetDraft,
  removeCombo,
  replaceCombo,
  resolveComboSession,
  type ComboLibrary,
  type SavedCombo,
} from "./combos"

const car = "Volkswagen Golf 1.5 (or Equivalent New Compact Car)"

function shareCustom(name = "两人的月") {
  return {
    comboTarget: CUSTOM_TARGET,
    customName: name,
    custom: {
      [ITEMS.coffee]: { checked: true, quantity: "30" },
    },
    usage: {
      years: { [car]: 8 },
      rates: { [car]: 4.2 },
      repayments: { [car]: "principal" as const },
    },
  }
}

function saved(id: string, years: number): SavedCombo {
  return {
    id,
    name: id,
    basket: { [car]: { checked: true, quantity: "1" } },
    years: { [car]: years },
    rates: {},
    repayments: {},
  }
}

describe("normalizeLibrary", () => {
  it("drops bad ids, non-positive quantities and years, and keeps twenty combos", () => {
    const combos = Array.from({ length: COMBO_LIMIT + 2 }, (_, index) => ({
      id: `id-${index}`,
      name: "n".repeat(50),
      basket: {
        [ITEMS.coffee]: { checked: true, quantity: index === 0 ? "0" : "2" },
        "Apples (1 lb)": { checked: true, quantity: "4" },
      },
      years: { [car]: index === 1 ? 0 : 6 },
      rates: { [car]: index === 1 ? 0 : 4.5 },
      repayments: { [car]: index === 1 ? "interest-only" : "principal" },
    }))
    const library = normalizeLibrary({
      activeId: "id-3",
      combos: [{ id: "" }, ...combos, { id: "id-0", name: "dup" }],
    })
    expect(library.combos).toHaveLength(COMBO_LIMIT)
    expect(library.combos[0]?.name).toHaveLength(40)
    expect(library.combos[0]?.basket[ITEMS.coffee]).toBeUndefined()
    expect(library.combos[0]?.basket["Apples (1 kg)"]).toEqual({ checked: true, quantity: "4" })
    expect(library.combos[1]?.years).toEqual({})
    expect(library.combos[1]?.rates).toEqual({})
    expect(library.combos[1]?.repayments).toEqual({})
    expect(library.combos[0]?.years).toEqual({ [car]: 6 })
    expect(library.combos[0]?.rates).toEqual({ [car]: 4.5 })
    expect(library.combos[0]?.repayments).toEqual({ [car]: "principal" })
    expect(library.activeId).toBe("id-3")
    expect(normalizeLibrary({ activeId: "missing", combos: [] }).activeId).toBeNull()
  })
})

describe("combo edits", () => {
  it("keeps each combo's years when one of them changes", () => {
    const first = appendCombo(emptyLibrary(), {
      name: "five",
      basket: saved("a", 5).basket,
      years: { [car]: 5 },
      rates: { [car]: 3 },
      repayments: { [car]: "payment" },
    })
    expect(first).not.toBeNull()
    const second = appendCombo(first!.library, {
      name: "ten",
      basket: saved("b", 10).basket,
      years: { [car]: 10 },
      rates: {},
      repayments: {},
    })
    const updated = replaceCombo(second!.library, {
      ...second!.combo,
      years: { [car]: 12 },
    })
    expect(updated.combos.map((combo) => combo.years[car])).toEqual([5, 12])
    const removed = removeCombo(updated, second!.combo.id)
    expect(removed.activeId).toBeNull()
    expect(removed.combos).toHaveLength(1)
  })

  it("refuses a twenty-first combo", () => {
    let library: ComboLibrary = emptyLibrary()
    for (let index = 0; index < COMBO_LIMIT; index += 1) {
      const added = appendCombo(library, {
        name: String(index),
        basket: {},
        years: {},
        rates: {},
        repayments: {},
      })
      expect(added).not.toBeNull()
      library = added!.library
    }
    expect(
      appendCombo(library, { name: "overflow", basket: {}, years: {}, rates: {}, repayments: {} }),
    ).toBeNull()
  })

  it("copies the preset lines into a new draft", () => {
    const draft = presetDraft({
      years: { [car]: 4, [ITEMS.rentOutside]: 3 },
      rates: { [car]: 9, [ITEMS.rentOutside]: 2.5 },
      repayments: { [ITEMS.rentOutside]: "principal" },
    })
    expect(draft.basket[ITEMS.rentOutside]).toEqual({ checked: true, quantity: "1" })
    expect(draft.basket[ITEMS.utilities]).toEqual({ checked: true, quantity: "1" })
    expect(draft.years).toEqual({ [ITEMS.rentOutside]: 3 })
    expect(draft.rates).toEqual({ [ITEMS.rentOutside]: 2.5 })
    expect(draft.repayments).toEqual({ [ITEMS.rentOutside]: "principal" })
  })
})

describe("resolveComboSession", () => {
  const library: ComboLibrary = {
    combos: [saved("keep", 9)],
    activeId: "keep",
  }

  it("restores the saved selection when the hash is the one this browser wrote", () => {
    const resolved = resolveComboSession({
      library,
      hashBody: "s=1&bt=custom",
      lastHash: "s=1&bt=custom",
      share: shareCustom(),
    })
    expect(resolved.session.mode).toBe("saved")
    expect(resolved.session.library.activeId).toBe("keep")
    expect(resolved.session.draft).toBeNull()
    expect(resolved.persistLibrary).toBeNull()
  })

  it("adopts a shared combo when the library is empty", () => {
    const resolved = resolveComboSession({
      library: emptyLibrary(),
      hashBody: "s=1&bt=custom",
      lastHash: null,
      share: shareCustom("从链接来"),
    })
    expect(resolved.session.mode).toBe("saved")
    expect(resolved.session.library.combos).toHaveLength(1)
    expect(resolved.session.library.combos[0]?.name).toBe("从链接来")
    expect(resolved.session.library.combos[0]?.years[car]).toBe(8)
    expect(resolved.session.library.combos[0]?.rates[car]).toBe(4.2)
    expect(resolved.session.library.combos[0]?.repayments[car]).toBe("principal")
    expect(resolved.persistHash).toBe("s=1&bt=custom")
  })

  it("keeps a shared combo as a draft when this browser already has a library", () => {
    const resolved = resolveComboSession({
      library,
      hashBody: "s=1&bt=custom&cn=guest",
      lastHash: "s=1&bt=preset",
      share: shareCustom("guest"),
    })
    expect(resolved.session.mode).toBe("draft")
    expect(resolved.session.draft?.name).toBe("guest")
    expect(resolved.session.library.combos).toHaveLength(1)
    expect(resolved.persistLibrary).toBeNull()
  })

  it("selects the preset when a shared link is not a custom combo", () => {
    const resolved = resolveComboSession({
      library,
      hashBody: "s=1&bt=preset",
      lastHash: "older",
      share: { ...shareCustom(), comboTarget: PRESET_TARGET },
    })
    expect(resolved.session.mode).toBe("preset")
    expect(resolved.session.library.activeId).toBeNull()
    expect(resolved.session.library.combos).toHaveLength(1)
  })
})
