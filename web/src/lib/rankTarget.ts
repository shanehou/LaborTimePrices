import { BASKETS, type BasketId } from "@/data/items"
import type { BasketLine } from "@/lib/types"

export type CustomBasket = Record<string, { checked: boolean; quantity: string }>

export function customLines(custom: CustomBasket): BasketLine[] {
  return Object.entries(custom).flatMap(([item, state]) => {
    if (!state.checked) return []
    const quantity = Number(state.quantity)
    return [{ item, quantity: Number.isFinite(quantity) ? quantity : Number.NaN }]
  })
}

export function linesForTarget(target: string, custom: CustomBasket): BasketLine[] {
  if (target.startsWith("item:")) {
    const item = target.slice("item:".length)
    return item ? [{ item, quantity: 1 }] : []
  }
  if (target === "basket:custom") return customLines(custom)
  const id = target.slice("basket:".length) as BasketId
  const basket = BASKETS.find((entry) => entry.id === id)
  if (!basket) return []
  return basket.lines.map((line) => ({ item: line.item, quantity: line.quantity }))
}
