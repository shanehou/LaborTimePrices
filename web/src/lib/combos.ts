import { canonicalItemName } from "../data/measure"
import { BASKETS } from "../data/items"
import { CUSTOM_TARGET, type CustomBasket } from "./rankTarget"

export const COMBO_LIMIT = 20
export const COMBO_NAME_LIMIT = 40

export type SavedCombo = {
  id: string
  name: string
  basket: CustomBasket
  years: Record<string, number>
}

export type ComboLibrary = {
  combos: SavedCombo[]
  activeId: string | null
}

export type ComboDraft = {
  name: string
  basket: CustomBasket
  years: Record<string, number>
}

export type ComboMode = "preset" | "saved" | "draft"

export type ComboSession = {
  library: ComboLibrary
  draft: ComboDraft | null
  mode: ComboMode
}

type ShareCombo = {
  comboTarget: string
  custom: CustomBasket
  customName: string
  usage: { years: Record<string, number> }
}

const QUANTITY_DRAFT = /^\d{0,8}(\.\d{0,4})?$/

export function emptyLibrary(): ComboLibrary {
  return { combos: [], activeId: null }
}

export function createComboId(): string {
  const cryptoRef = globalThis.crypto
  if (cryptoRef && typeof cryptoRef.randomUUID === "function") return cryptoRef.randomUUID()
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function clampComboName(name: string): string {
  return name.slice(0, COMBO_NAME_LIMIT)
}

function positiveYears(value: unknown): Record<string, number> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {}
  const years: Record<string, number> = {}
  for (const [item, amount] of Object.entries(value)) {
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) continue
    const name = canonicalItemName(item)
    if (name !== item && years[name] !== undefined) continue
    years[name] = amount
  }
  return years
}

function keepQuantity(quantity: string): boolean {
  if (!QUANTITY_DRAFT.test(quantity)) return false
  if (quantity === "" || quantity === "." || quantity.endsWith(".")) return true
  const value = Number(quantity)
  return Number.isFinite(value) && value > 0
}

function normalizeBasket(value: unknown): CustomBasket {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {}
  const basket: CustomBasket = {}
  for (const [item, state] of Object.entries(value)) {
    if (typeof state !== "object" || state === null || Array.isArray(state)) continue
    const record = state as { checked?: unknown; quantity?: unknown }
    if (typeof record.checked !== "boolean") continue
    let quantity = ""
    if (typeof record.quantity === "number" && Number.isFinite(record.quantity)) {
      quantity = String(record.quantity)
    } else if (typeof record.quantity === "string") {
      quantity = record.quantity.trim()
    } else {
      continue
    }
    if (!keepQuantity(quantity)) continue
    const name = canonicalItemName(item)
    if (name !== item && basket[name] !== undefined) continue
    basket[name] = { checked: record.checked, quantity }
  }
  return basket
}

export function normalizeLibrary(input: unknown): ComboLibrary {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return emptyLibrary()
  const record = input as { combos?: unknown; activeId?: unknown }
  if (!Array.isArray(record.combos)) return emptyLibrary()
  const combos: SavedCombo[] = []
  const seen = new Set<string>()
  for (const entry of record.combos) {
    if (combos.length >= COMBO_LIMIT) break
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue
    const row = entry as { id?: unknown; name?: unknown; basket?: unknown; years?: unknown }
    if (typeof row.id !== "string" || row.id.trim() === "" || seen.has(row.id)) continue
    seen.add(row.id)
    combos.push({
      id: row.id,
      name: typeof row.name === "string" ? clampComboName(row.name) : "",
      basket: normalizeBasket(row.basket),
      years: positiveYears(row.years),
    })
  }
  const activeId =
    typeof record.activeId === "string" && combos.some((combo) => combo.id === record.activeId)
      ? record.activeId
      : null
  return { combos, activeId }
}

export function createSavedCombo(draft: ComboDraft, id = createComboId()): SavedCombo {
  return {
    id,
    name: clampComboName(draft.name),
    basket: draft.basket,
    years: positiveYears(draft.years),
  }
}

export function presetDraft(years: Record<string, number>): ComboDraft {
  const basket: CustomBasket = Object.fromEntries(
    BASKETS[0].lines.map((line) => [line.item, { checked: true, quantity: String(line.quantity) }]),
  )
  const kept: Record<string, number> = {}
  for (const item of Object.keys(basket)) {
    const value = years[item]
    if (typeof value === "number" && Number.isFinite(value) && value > 0) kept[item] = value
  }
  return { name: "", basket, years: kept }
}

export function appendCombo(
  library: ComboLibrary,
  draft: ComboDraft,
): { library: ComboLibrary; combo: SavedCombo } | null {
  if (library.combos.length >= COMBO_LIMIT) return null
  const combo = createSavedCombo(draft)
  return {
    combo,
    library: { combos: [...library.combos, combo], activeId: combo.id },
  }
}

export function replaceCombo(library: ComboLibrary, combo: SavedCombo): ComboLibrary {
  return {
    ...library,
    combos: library.combos.map((entry) => (entry.id === combo.id ? combo : entry)),
  }
}

export function removeCombo(library: ComboLibrary, id: string): ComboLibrary {
  const combos = library.combos.filter((entry) => entry.id !== id)
  const activeId = library.activeId === id ? null : library.activeId
  return {
    combos,
    activeId: combos.some((entry) => entry.id === activeId) ? activeId : null,
  }
}

export function activeSaved(library: ComboLibrary): SavedCombo | null {
  return library.combos.find((combo) => combo.id === library.activeId) ?? null
}

function draftFromShare(share: ShareCombo): ComboDraft {
  return {
    name: clampComboName(share.customName),
    basket: share.custom,
    years: positiveYears(share.usage.years),
  }
}

/**
 * Own sessions (the address bar matches the hash this browser last wrote) restore
 * the library selection. A different hash is someone else's current combo: keep it
 * as a draft, unless this browser has no saved combos yet, in which case adopt it.
 */
export function resolveComboSession(input: {
  library: ComboLibrary
  hashBody: string
  lastHash: string | null
  share: ShareCombo | null
}): { session: ComboSession; persistLibrary: ComboLibrary | null; persistHash: string | null } {
  const library = normalizeLibrary(input.library)
  const own = input.hashBody.length > 0 && input.hashBody === input.lastHash
  const incomingCustom = input.share !== null && input.share.comboTarget === CUSTOM_TARGET

  if (own || !incomingCustom) {
    if (!own && input.share && !incomingCustom) {
      const next = { ...library, activeId: null }
      return {
        session: { library: next, draft: null, mode: "preset" },
        persistLibrary: next,
        persistHash: null,
      }
    }
    const active = activeSaved(library)
    return {
      session: { library, draft: null, mode: active ? "saved" : "preset" },
      persistLibrary: null,
      persistHash: null,
    }
  }

  const draft = draftFromShare(input.share as ShareCombo)
  if (library.combos.length === 0) {
    const combo = createSavedCombo(draft)
    const next = { combos: [combo], activeId: combo.id }
    return {
      session: { library: next, draft: null, mode: "saved" },
      persistLibrary: next,
      persistHash: input.hashBody,
    }
  }

  return {
    session: { library, draft, mode: "draft" },
    persistLibrary: null,
    persistHash: null,
  }
}
