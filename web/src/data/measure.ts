/**
 * Numbeo serves one measurement system per response. Some rows have a metric
 * name and an imperial name; volume labels share a price, while mass, distance
 * and area prices scale. Keep this table in sync with worker/numbeo.js.
 *
 * When a payload contains both names, the metric row is kept. When it contains
 * only one, English keeps that name and price, and Chinese uses the metric name
 * with the price scaled when the factor is not 1.
 */
import type { Lang } from "../i18n"

const POUND_KG = 0.45359237
const MILE_KM = 1.609344
const SQFT_PER_SQM = 1 / (0.3048 * 0.3048)

const PER_KG = 1 / POUND_KG
const LOAF_500G = 0.5 / POUND_KG
const PER_KM = 1 / MILE_KM

export type MeasureAlias = {
  item: string
  factor: number
}

function renamed(item: string, factor = 1): MeasureAlias {
  return { item, factor }
}

export const US_MEASURE_ALIASES: Record<string, MeasureAlias> = {
  "Domestic Draft Beer (1 Pint)": renamed("Domestic Draft Beer (0.5 Liter)"),
  "Imported Beer (12 oz Small Bottle)": renamed("Imported Beer (0.33 Liter Bottle)"),
  "Soft Drink (Coca-Cola or Pepsi, 12 oz Small Bottle)": renamed(
    "Soft Drink (Coca-Cola or Pepsi, 0.33 Liter Bottle)",
  ),
  "Bottled Water (12 oz)": renamed("Bottled Water (0.33 Liter)"),
  "Fresh White Bread (1 lb Loaf)": renamed("Fresh White Bread (500 g Loaf)", LOAF_500G),
  "White Rice (1 lb)": renamed("White Rice (1 kg)", PER_KG),
  "Local Cheese (1 lb)": renamed("Local Cheese (1 kg)", PER_KG),
  "Chicken Fillets (1 lb)": renamed("Chicken Fillets (1 kg)", PER_KG),
  "Beef Round or Equivalent Back Leg Red Meat (1 lb)": renamed(
    "Beef Round or Equivalent Back Leg Red Meat (1 kg)",
    PER_KG,
  ),
  "Apples (1 lb)": renamed("Apples (1 kg)", PER_KG),
  "Bananas (1 lb)": renamed("Bananas (1 kg)", PER_KG),
  "Oranges (1 lb)": renamed("Oranges (1 kg)", PER_KG),
  "Tomatoes (1 lb)": renamed("Tomatoes (1 kg)", PER_KG),
  "Potatoes (1 lb)": renamed("Potatoes (1 kg)", PER_KG),
  "Onions (1 lb)": renamed("Onions (1 kg)", PER_KG),
  "Bottled Water (50 oz)": renamed("Bottled Water (1.5 Liter)"),
  "Domestic Beer (16.9 oz Bottle)": renamed("Domestic Beer (0.5 Liter Bottle)"),
  "Taxi 1 mile (Standard Tariff)": renamed("Taxi 1 km (Standard Tariff)", PER_KM),
  "Basic Utilities for 915 Square Feet Apartment (Electricity, Heating, Cooling, Water, Garbage)":
    renamed(
      "Basic Utilities for 85 m2 Apartment (Electricity, Heating, Cooling, Water, Garbage)",
    ),
  "Price per Square Feet to Buy Apartment in City Centre": renamed(
    "Price per Square Meter to Buy Apartment in City Centre",
    SQFT_PER_SQM,
  ),
  "Price per Square Feet to Buy Apartment Outside of Centre": renamed(
    "Price per Square Meter to Buy Apartment Outside of Centre",
    SQFT_PER_SQM,
  ),
}

export type PriceSample = {
  item: string
}

const SQUARE_FEET_ITEMS = new Set([
  "Price per Square Feet to Buy Apartment in City Centre",
  "Price per Square Feet to Buy Apartment Outside of Centre",
])

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

export function canonicalItemName(item: string): string {
  return US_MEASURE_ALIASES[item]?.item ?? item
}

function rowKey(category: string, item: string): string {
  return `${category}\0${canonicalItemName(item)}`
}

/**
 * Drops an imperial row when the same category already has its metric name.
 * Imperial-only rows stay as Numbeo sent them.
 */
export function canonicalizePrices<T extends PriceSample & { category: string; price_usd: number }>(
  prices: readonly T[],
): T[] {
  const metricKeys = new Set<string>()
  for (const price of prices) {
    if (!US_MEASURE_ALIASES[price.item]) metricKeys.add(rowKey(price.category, price.item))
  }
  const result: T[] = []
  const seen = new Set<string>()
  for (const price of prices) {
    const key = rowKey(price.category, price.item)
    if (US_MEASURE_ALIASES[price.item] && metricKeys.has(key)) continue
    if (seen.has(key)) continue
    seen.add(key)
    result.push(price)
  }
  return result
}

/** True when some loaded row already uses the metric name for this item. */
export function hasMetricRow(item: string, prices: readonly PriceSample[]): boolean {
  const key = canonicalItemName(item)
  return prices.some((price) => price.item === key)
}

/** English label: the metric name when any row has it, otherwise the imperial original. */
export function englishItemName(item: string, prices: readonly PriceSample[]): string {
  const key = canonicalItemName(item)
  if (hasMetricRow(key, prices)) return key
  for (const price of prices) {
    if (canonicalItemName(price.item) === key && price.item !== key) return price.item
  }
  return key
}

export function priceUsdFor(
  lang: Lang,
  row: PriceSample & { price_usd: number },
  prices: readonly PriceSample[],
): number {
  const alias = US_MEASURE_ALIASES[row.item]
  if (!alias) return row.price_usd
  const useMetric = lang === "zh" || hasMetricRow(alias.item, prices)
  if (!useMetric || alias.factor === 1) return row.price_usd
  return roundMoney(row.price_usd * alias.factor)
}

/** English is showing the square-foot apartment price, so area is in square feet. */
export function showsImperialArea(
  lang: Lang,
  item: string,
  prices?: readonly PriceSample[],
): boolean {
  if (lang !== "en" || !prices) return false
  return SQUARE_FEET_ITEMS.has(englishItemName(item, prices))
}
