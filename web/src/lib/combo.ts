import { priceUsdFor, type PriceSample } from "../data/measure"
import type { Lang } from "../i18n"
import { findPrice } from "./labor"
import type { BasketLine, CityRecord } from "./types"

export type ComboDetailRow = {
  item: string
  quantity: number
  /** cityId -> listed price × quantity, or null when the city did not report it. */
  byCity: Record<string, number | null>
}

/**
 * Line-by-line breakdown of a combo: for each line and each selected city, the
 * listed price multiplied by that line's quantity. A missing item stays null so
 * the UI can show a dash instead of a misleading zero.
 */
export function comboDetail(
  lines: BasketLine[],
  cities: CityRecord[],
  view?: { lang: Lang; prices: readonly PriceSample[] },
): ComboDetailRow[] {
  return lines.map((line) => ({
    item: line.item,
    quantity: line.quantity,
    byCity: Object.fromEntries(
      cities.map((city) => {
        const price = findPrice(city, line.item)
        if (!price) return [city.id, null]
        const usd = view ? priceUsdFor(view.lang, price, view.prices) : price.price_usd
        return [city.id, usd * line.quantity]
      }),
    ),
  }))
}
