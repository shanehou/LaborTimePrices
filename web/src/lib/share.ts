import { ITEMS, NUMBEO_ITEMS } from "../data/items"
import type { Lang } from "../i18n"
import { emptyUsage, type Horizon, type Usage } from "./period"
import { CUSTOM_TARGET, PRESET_TARGET, type CustomBasket } from "./rankTarget"

export type ShareCity = { id: string; name: string }

export type ShareSnapshot = {
  cities: ShareCity[]
  hours: Record<string, number>
  lang: Lang | null
  tab: "items" | "combos"
  unit: "hours" | "usd"
  horizon: Horizon
  itemTarget: string
  comboTarget: string
  custom: CustomBasket
  customName: string
  usage: Usage
}

function itemIndex(item: string): number {
  return (NUMBEO_ITEMS as readonly string[]).indexOf(item)
}

function positive(value: number): boolean {
  return Number.isFinite(value) && value > 0
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
  if (times) params.set("r", times)
  if (years) params.set("y", years)
  if (area) params.set("a", area)
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

  return {
    cities,
    hours,
    lang,
    tab,
    unit,
    horizon,
    itemTarget: itemName ? `item:${itemName}` : `item:${ITEMS.coffee}`,
    comboTarget,
    custom,
    customName: params.get("cn") ?? "",
    usage,
  }
}
