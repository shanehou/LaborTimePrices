import { ITEMS, NUMBEO_ITEMS } from "../data/items"
import type { Lang } from "../i18n"
import { isCurrencyCode, type CurrencyCode } from "./money"
import {
  emptyUsage,
  emptyUsageOverrides,
  isRepayment,
  type Horizon,
  type Repayment,
  type Usage,
  type UsageOverrides,
} from "./period"
import { CUSTOM_TARGET, PRESET_TARGET, type CustomBasket } from "./rankTarget"

export type ShareCity = { id: string; name: string }

export type ShareSnapshot = {
  cities: ShareCity[]
  hours: Record<string, number>
  /** Per-city net salaries in USD. */
  salaries: Record<string, number>
  lang: Lang | null
  tab: "items" | "combos"
  unit: "hours" | "usd"
  horizon: Horizon
  itemTarget: string
  comboTarget: string
  custom: CustomBasket
  customName: string
  usage: Usage
  usageOverrides: UsageOverrides
  currency: CurrencyCode
}

function itemIndex(item: string): number {
  return (NUMBEO_ITEMS as readonly string[]).indexOf(item)
}

function positive(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

function filterCities(
  map: Record<string, Record<string, number>>,
  cityIds: Set<string>,
): Record<string, Record<string, number>> {
  const next: Record<string, Record<string, number>> = {}
  for (const [item, perCity] of Object.entries(map)) {
    const kept = Object.fromEntries(
      Object.entries(perCity).filter(([cityId, value]) => cityIds.has(cityId) && positive(value)),
    )
    if (Object.keys(kept).length > 0) next[item] = kept
  }
  return next
}

function filterRepaymentCities(
  map: Record<string, Record<string, Repayment>>,
  cityIds: Set<string>,
): Record<string, Record<string, Repayment>> {
  const next: Record<string, Record<string, Repayment>> = {}
  for (const [item, perCity] of Object.entries(map)) {
    const kept = Object.fromEntries(
      Object.entries(perCity).filter(([cityId, mode]) => cityIds.has(cityId) && isRepayment(mode)),
    )
    if (Object.keys(kept).length > 0) next[item] = kept
  }
  return next
}

function pairsFromMap(map: Record<string, number>): string {
  return Object.entries(map)
    .flatMap(([item, value]) => {
      const index = itemIndex(item)
      if (index < 0 || !positive(value)) return []
      return [`${index}:${value}`]
    })
    .sort((left, right) => Number(left.split(":")[0]) - Number(right.split(":")[0]))
    .join("|")
}

function readPairs(value: string | null): { index: number; value: number }[] {
  if (!value) return []
  const pairs: { index: number; value: number }[] = []
  for (const part of value.split("|")) {
    const splitAt = part.indexOf(":")
    if (splitAt <= 0) continue
    const index = Number(part.slice(0, splitAt))
    const amount = Number(part.slice(splitAt + 1))
    if (!Number.isInteger(index) || index < 0 || index >= NUMBEO_ITEMS.length) continue
    if (!positive(amount)) continue
    pairs.push({ index, value: amount })
  }
  return pairs
}

function repaymentPairs(map: Record<string, Repayment>): string {
  return Object.entries(map)
    .flatMap(([item, mode]) => {
      const index = itemIndex(item)
      if (index < 0 || !isRepayment(mode)) return []
      return [`${index}:${mode === "principal" ? "q" : "p"}`]
    })
    .sort((left, right) => Number(left.split(":")[0]) - Number(right.split(":")[0]))
    .join("|")
}

function readRepayments(value: string | null): { index: number; mode: Repayment }[] {
  if (!value) return []
  const pairs: { index: number; mode: Repayment }[] = []
  for (const part of value.split("|")) {
    const splitAt = part.indexOf(":")
    if (splitAt <= 0) continue
    const index = Number(part.slice(0, splitAt))
    const code = part.slice(splitAt + 1)
    const mode = code === "q" ? "principal" : code === "p" ? "payment" : null
    if (!Number.isInteger(index) || index < 0 || index >= NUMBEO_ITEMS.length || !mode) continue
    pairs.push({ index, mode })
  }
  return pairs
}

function encodeOverrideTriples(map: Record<string, Record<string, number>>): string {
  return Object.entries(map)
    .flatMap(([item, perCity]) => {
      const index = itemIndex(item)
      if (index < 0) return []
      return Object.entries(perCity).flatMap(([cityId, value]) =>
        positive(value) && cityId !== "" ? [`${index}:${cityId}:${value}`] : [],
      )
    })
    .join("|")
}

function encodeRepaymentTriples(map: Record<string, Record<string, Repayment>>): string {
  return Object.entries(map)
    .flatMap(([item, perCity]) => {
      const index = itemIndex(item)
      if (index < 0) return []
      return Object.entries(perCity).flatMap(([cityId, mode]) =>
        isRepayment(mode) && cityId !== ""
          ? [`${index}:${cityId}:${mode === "principal" ? "q" : "p"}`]
          : [],
      )
    })
    .join("|")
}

type OverrideTriple = { index: number; cityId: string; value: number }

function readOverrideTriples(value: string | null): OverrideTriple[] {
  if (!value) return []
  const triples: OverrideTriple[] = []
  for (const part of value.split("|")) {
    const segments = part.split(":")
    if (segments.length !== 3) continue
    const index = Number(segments[0])
    const cityId = segments[1]
    const amount = Number(segments[2])
    if (!Number.isInteger(index) || index < 0 || index >= NUMBEO_ITEMS.length) continue
    if (cityId === "") continue
    if (!positive(amount)) continue
    triples.push({ index, cityId, value: amount })
  }
  return triples
}

type RepaymentTriple = { index: number; cityId: string; mode: Repayment }

function readRepaymentTriples(value: string | null): RepaymentTriple[] {
  if (!value) return []
  const triples: RepaymentTriple[] = []
  for (const part of value.split("|")) {
    const segments = part.split(":")
    if (segments.length !== 3) continue
    const index = Number(segments[0])
    const cityId = segments[1]
    const code = segments[2]
    const mode = code === "q" ? "principal" : code === "p" ? "payment" : null
    if (!Number.isInteger(index) || index < 0 || index >= NUMBEO_ITEMS.length) continue
    if (cityId === "" || !mode) continue
    triples.push({ index, cityId, mode })
  }
  return triples
}

export function encodeShare(snapshot: ShareSnapshot): string {
  const params = new URLSearchParams()
  params.set("s", "1")
  if (snapshot.lang) params.set("lang", snapshot.lang)
  params.set("t", snapshot.tab)
  params.set("u", snapshot.unit)
  params.set("z", snapshot.horizon)
  const targetItem = snapshot.itemTarget.startsWith("item:")
    ? snapshot.itemTarget.slice("item:".length)
    : ""
  const targetIndex = itemIndex(targetItem)
  if (targetIndex >= 0) params.set("it", String(targetIndex))
  params.set("bt", snapshot.comboTarget === CUSTOM_TARGET ? "custom" : "preset")
  const customName = snapshot.customName.trim()
  if (customName) params.set("cn", customName)
  if (snapshot.cities.length > 0) {
    params.set("c", snapshot.cities.map((city) => city.id).join("|"))
    params.set("n", snapshot.cities.map((city) => city.name.replaceAll("|", "/")).join("|"))
  }
  const hours = snapshot.cities
    .filter((city) => positive(snapshot.hours[city.id] ?? Number.NaN))
    .map((city) => `${city.id}:${snapshot.hours[city.id]}`)
  if (hours.length > 0) params.set("h", hours.join("|"))
  const salaries = snapshot.cities
    .filter((city) => positive(snapshot.salaries[city.id] ?? Number.NaN))
    .map((city) => `${city.id}:${snapshot.salaries[city.id]}`)
  if (salaries.length > 0) params.set("sa", salaries.join("|"))
  const selectedIds = new Set(snapshot.cities.map((city) => city.id))
  const usageOverrides = snapshot.usageOverrides
  const overrideArea = encodeOverrideTriples(filterCities(usageOverrides.area, selectedIds))
  const overrideYears = encodeOverrideTriples(filterCities(usageOverrides.years, selectedIds))
  const overrideRates = encodeOverrideTriples(filterCities(usageOverrides.rates, selectedIds))
  const overrideRepayments = encodeRepaymentTriples(
    filterRepaymentCities(usageOverrides.repayments, selectedIds),
  )
  if (overrideArea) params.set("ac", overrideArea)
  if (overrideYears) params.set("yc", overrideYears)
  if (overrideRates) params.set("irc", overrideRates)
  if (overrideRepayments) params.set("imc", overrideRepayments)
  const basket = Object.entries(snapshot.custom)
    .flatMap(([item, state]) => {
      if (!state.checked) return []
      const index = itemIndex(item)
      const quantity = Number(state.quantity)
      if (index < 0 || !positive(quantity)) return []
      return [`${index}:${quantity}`]
    })
    .sort((left, right) => Number(left.split(":")[0]) - Number(right.split(":")[0]))
  if (basket.length > 0) params.set("b", basket.join("|"))
  const times = pairsFromMap(snapshot.usage.times)
  const years = pairsFromMap(snapshot.usage.years)
  const area = pairsFromMap(snapshot.usage.area)
  const rates = pairsFromMap(snapshot.usage.rates)
  const repayments = repaymentPairs(snapshot.usage.repayments)
  if (times) params.set("r", times)
  if (years) params.set("y", years)
  if (area) params.set("a", area)
  if (rates) params.set("ir", rates)
  if (repayments) params.set("im", repayments)
  if (snapshot.currency !== "USD") params.set("cur", snapshot.currency)
  return params.toString()
}

export function decodeShare(hash: string): ShareSnapshot | null {
  const body = hash.startsWith("#") ? hash.slice(1) : hash
  if (!body) return null
  const params = new URLSearchParams(body)
  if (params.get("s") !== "1") return null

  const langParam = params.get("lang")
  const lang: Lang | null = langParam === "zh" || langParam === "en" ? langParam : null
  const tab = params.get("t") === "combos" ? "combos" : "items"
  const unit = params.get("u") === "usd" ? "usd" : "hours"
  const horizonParam = params.get("z")
  const horizon: Horizon =
    horizonParam === "month" || horizonParam === "year" || horizonParam === "listed"
      ? horizonParam
      : "listed"
  const parsedItem = Number(params.get("it"))
  const itemName =
    Number.isInteger(parsedItem) && parsedItem >= 0 && parsedItem < NUMBEO_ITEMS.length
      ? NUMBEO_ITEMS[parsedItem]
      : null
  const comboTarget = params.get("bt") === "custom" ? CUSTOM_TARGET : PRESET_TARGET
  const currencyParam = params.get("cur")
  const currency: CurrencyCode = isCurrencyCode(currencyParam) ? currencyParam : "USD"

  const ids = (params.get("c") ?? "").split("|").filter((id) => id.length > 0)
  const names = (params.get("n") ?? "").split("|")
  const cities = ids.map((id, index) => ({
    id,
    name: names[index] ? names[index] : id,
  }))

  const hours: Record<string, number> = {}
  for (const part of (params.get("h") ?? "").split("|")) {
    if (!part) continue
    const splitAt = part.indexOf(":")
    if (splitAt <= 0) continue
    const id = part.slice(0, splitAt)
    const value = Number(part.slice(splitAt + 1))
    if (positive(value)) hours[id] = value
  }

  const salaries: Record<string, number> = {}
  for (const part of (params.get("sa") ?? "").split("|")) {
    if (!part) continue
    const splitAt = part.indexOf(":")
    if (splitAt <= 0) continue
    const id = part.slice(0, splitAt)
    const value = Number(part.slice(splitAt + 1))
    if (positive(value)) salaries[id] = value
  }

  const usageOverrides = emptyUsageOverrides()
  const collectTriples = (
    value: string | null,
    write: (item: string, cityId: string, triple: OverrideTriple) => void,
  ) => {
    for (const triple of readOverrideTriples(value)) {
      const name = NUMBEO_ITEMS[triple.index]
      if (name) write(name, triple.cityId, triple)
    }
  }
  collectTriples(params.get("ac"), (item, cityId, triple) => {
    usageOverrides.area[item] = { ...usageOverrides.area[item], [cityId]: triple.value }
  })
  collectTriples(params.get("yc"), (item, cityId, triple) => {
    usageOverrides.years[item] = { ...usageOverrides.years[item], [cityId]: triple.value }
  })
  collectTriples(params.get("irc"), (item, cityId, triple) => {
    usageOverrides.rates[item] = { ...usageOverrides.rates[item], [cityId]: triple.value }
  })
  for (const triple of readRepaymentTriples(params.get("imc"))) {
    const name = NUMBEO_ITEMS[triple.index]
    if (!name) continue
    usageOverrides.repayments[name] = {
      ...usageOverrides.repayments[name],
      [triple.cityId]: triple.mode,
    }
  }

  const custom: CustomBasket = {}
  for (const pair of readPairs(params.get("b"))) {
    const name = NUMBEO_ITEMS[pair.index]
    if (!name) continue
    custom[name] = { checked: true, quantity: String(pair.value) }
  }

  const usage = emptyUsage()
  for (const pair of readPairs(params.get("r"))) {
    const name = NUMBEO_ITEMS[pair.index]
    if (name) usage.times[name] = pair.value
  }
  for (const pair of readPairs(params.get("y"))) {
    const name = NUMBEO_ITEMS[pair.index]
    if (name) usage.years[name] = pair.value
  }
  for (const pair of readPairs(params.get("a"))) {
    const name = NUMBEO_ITEMS[pair.index]
    if (name) usage.area[name] = pair.value
  }
  for (const pair of readPairs(params.get("ir"))) {
    const name = NUMBEO_ITEMS[pair.index]
    if (name) usage.rates[name] = pair.value
  }
  for (const pair of readRepayments(params.get("im"))) {
    const name = NUMBEO_ITEMS[pair.index]
    if (name) usage.repayments[name] = pair.mode
  }

  return {
    cities,
    hours,
    salaries,
    lang,
    tab,
    unit,
    horizon,
    itemTarget: itemName ? `item:${itemName}` : `item:${ITEMS.coffee}`,
    comboTarget,
    custom,
    customName: params.get("cn") ?? "",
    usage,
    usageOverrides,
    currency,
  }
}
