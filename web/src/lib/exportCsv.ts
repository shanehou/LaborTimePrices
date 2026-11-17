import { cadenceOf } from "../data/cadence"
import { priceUsdFor, showsImperialArea, type PriceSample } from "../data/measure"
import {
  exclusionMessage,
  formatMessage,
  labelItem,
  t,
  type Lang,
} from "../i18n"
import { percentDelta } from "./compare"
import { formatPlain } from "./format"
import { USD_MONEY, type MoneyFormat } from "./money"
import { evaluateBasket, findPrice, laborHoursForPrice, resolveMonthlyHours } from "./labor"
import {
  firstUsageBlock,
  horizonFactor,
  lineSpendUsd,
  purchaseYears,
  usageBlock,
  type Horizon,
  type PeriodContext,
  type Usage,
} from "./period"

import type { BasketLine, CityRecord } from "./types"

function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`
  return value
}

function csvNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100
  return Object.is(rounded, -0) ? "0" : String(rounded)
}

function csvPercent(ratio: number | null): string {
  if (ratio === null || !Number.isFinite(ratio)) return ""
  const percent = Math.round(ratio * 100)
  if (percent === 0) return "0%"
  return `${percent > 0 ? "+" : ""}${percent}%`
}

export function cadenceLabel(
  lang: Lang,
  item: string,
  prices?: readonly PriceSample[],
): string {
  if (showsImperialArea(lang, item, prices)) return t(lang, "cadenceAreaImperial")
  switch (cadenceOf(item)) {
    case "monthly":
      return t(lang, "cadenceMonthly")
    case "yearly":
      return t(lang, "cadenceYearly")
    case "asset":
      return t(lang, "cadenceAsset")
    case "assetArea":
      return t(lang, "cadenceArea")
    default:
      return t(lang, "cadenceUnit")
  }
}

export function usageText(
  lang: Lang,
  item: string,
  quantity: number,
  period: PeriodContext,
  prices?: readonly PriceSample[],
): string {
  const block = usageBlock(item, quantity, period)
  if (block) return exclusionMessage(lang, block, prices)
  const cadence = cadenceOf(item)
  const factor = horizonFactor(cadence, period.horizon)
  const factorText =
    factor === "x12" ? t(lang, "factorTimes12") : factor === "div12" ? t(lang, "factorDiv12") : ""
  if (period.horizon === "listed") return cadenceLabel(lang, item, prices)
  if (cadence === "unit") {
    const times = period.mode === "single" ? period.usage.times[item] : quantity
    return times === undefined ? "" : String(times)
  }
  if (cadence === "asset") {
    const count = period.mode === "single" ? 1 : quantity
    return `${count} / ${period.usage.years[item]}`
  }
  if (cadence === "assetArea") {
    const area = period.mode === "single" ? period.usage.area[item] : quantity
    return `${area} / ${period.usage.years[item]}`
  }
  return [cadenceLabel(lang, item, prices), factorText].filter(Boolean).join(" ")
}

type Figures = {
  usd: string
  hours: string
  usdValue: number | null
  hoursValue: number | null
}

function cityFigures(
  lang: Lang,
  city: CityRecord,
  item: string,
  quantity: number,
  period: PeriodContext,
  override: number | undefined,
  prices: readonly PriceSample[],
  money: MoneyFormat,
): Figures {
  if (usageBlock(item, quantity, period)) {
    return { usd: "", hours: "", usdValue: null, hoursValue: null }
  }
  const price = findPrice(city, item)
  const usd = price ? priceUsdFor(lang, price, prices) : 0
  if (!price || !(usd > 0)) {
    const reason = !price
      ? exclusionMessage(lang, { code: "missing_item", item }, prices)
      : exclusionMessage(lang, { code: "non_positive_price", item }, prices)
    return { usd: reason, hours: "", usdValue: null, hoursValue: null }
  }
  const spent = lineSpendUsd(usd, item, quantity, period)
  if (!spent.ok) {
    return { usd: exclusionMessage(lang, spent.reason), hours: "", usdValue: null, hoursValue: null }
  }
  const resolved = resolveMonthlyHours(city, override)
  const salary = city.monthly_net_salary
  if (!resolved.ok || salary === null || !(salary > 0)) {
    return { usd: csvNumber(displayAmount(spent.usd, money)), hours: "", usdValue: spent.usd, hoursValue: null }
  }
  const hours = laborHoursForPrice(spent.usd, salary, resolved.hours)
  return {
    usd: csvNumber(displayAmount(spent.usd, money)),
    hours: csvNumber(hours),
    usdValue: spent.usd,
    hoursValue: hours,
  }
}

function displayAmount(usd: number, money: MoneyFormat): number {
  const rate = Number.isFinite(money.rate) && money.rate > 0 ? money.rate : 1
  return usd * rate
}

function relative(figure: Figures, baseline: Figures | undefined): string {
  if (!baseline) return ""
  if (figure.hoursValue !== null && baseline.hoursValue !== null) {
    return csvPercent(percentDelta(figure.hoursValue, baseline.hoursValue))
  }
  if (figure.usdValue !== null && baseline.usdValue !== null) {
    return csvPercent(percentDelta(figure.usdValue, baseline.usdValue))
  }
  return ""
}

function serialize(rows: string[][]): string {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`
}

/** How a combo line's quantity should read, including floor area and years. */
export function describeQuantity(
  lang: Lang,
  item: string,
  quantity: number,
  horizon: Horizon,
  years: number | undefined,
  prices?: readonly PriceSample[],
): string {
  const cadence = cadenceOf(item)
  const amount = Number.isFinite(quantity) && quantity > 0 ? formatPlain(lang, quantity, 2) : ""
  if (horizon === "listed") return amount || "—"
  if (cadence === "unit") {
    return amount
      ? formatMessage(t(lang, "qtyTimes"), { count: amount })
      : t(lang, "reasonNeedsTimes")
  }
  if (cadence === "asset" || cadence === "assetArea") {
    const areaKey = showsImperialArea(lang, item, prices) ? "qtyAreaImperial" : "qtyArea"
    const count = amount
      ? formatMessage(t(lang, cadence === "assetArea" ? areaKey : "qtyPieces"), { count: amount })
      : exclusionMessage(lang, {
          code: cadence === "assetArea" ? "needs_area" : "non_positive_quantity",
          item,
        }, prices)
    const span = formatMessage(t(lang, "qtyYears"), {
      count: formatPlain(lang, purchaseYears(years), 2),
    })
    return `${count} · ${span}`
  }
  return amount || "—"
}

export function itemsFilename(horizon: Horizon): string {
  return `ltp-items-${horizon}.csv`
}

export function comboFilename(horizon: Horizon): string {
  return `ltp-combo-${horizon}.csv`
}

export function buildItemsCsv(input: {
  lang: Lang
  cities: CityRecord[]
  items: string[]
  overrides: Record<string, number>
  horizon: Horizon
  usage: Usage
  money?: MoneyFormat
}): string {
  const money = input.money ?? USD_MONEY
  const period: PeriodContext = { horizon: input.horizon, mode: "single", usage: input.usage }
  const prices = input.cities.flatMap((city) => city.prices)
  const header = [t(input.lang, "csvItem"), t(input.lang, "csvCadence"), t(input.lang, "csvUsage")]
  for (const city of input.cities) {
    header.push(
      `${city.name} ${money.currency}`,
      `${city.name} ${t(input.lang, "csvHours")}`,
      `${city.name} ${t(input.lang, "csvPercent")}`,
    )
  }
  const rows = [header]
  for (const item of input.items) {
    const figures = input.cities.map((city) =>
      cityFigures(input.lang, city, item, 1, period, input.overrides[city.id], prices, money),
    )
    rows.push([
      labelItem(input.lang, item, prices),
      cadenceLabel(input.lang, item, prices),
      usageText(input.lang, item, 1, period, prices),
      ...figures.flatMap((figure) => [figure.usd, figure.hours, relative(figure, figures[0])]),
    ])
  }
  return serialize(rows)
}

export function buildComboCsv(input: {
  lang: Lang
  cities: CityRecord[]
  lines: BasketLine[]
  overrides: Record<string, number>
  horizon: Horizon
  usage: Usage
  money?: MoneyFormat
}): string {
  const money = input.money ?? USD_MONEY
  const period: PeriodContext = { horizon: input.horizon, mode: "combo", usage: input.usage }
  const prices = input.cities.flatMap((city) => city.prices)
  const view = { lang: input.lang, prices }
  const header = [t(input.lang, "csvItem"), t(input.lang, "csvCadence"), t(input.lang, "comboQty")]
  for (const city of input.cities) {
    header.push(`${city.name} ${money.currency}`, `${city.name} ${t(input.lang, "csvHours")}`)
  }
  const rows = [header]
  for (const line of input.lines) {
    const block = usageBlock(line.item, line.quantity, period)
    const figures = input.cities.map((city) =>
      cityFigures(input.lang, city, line.item, line.quantity, period, input.overrides[city.id], prices, money),
    )
    rows.push([
      labelItem(input.lang, line.item, prices),
      cadenceLabel(input.lang, line.item, prices),
      block ? exclusionMessage(input.lang, block, prices) : String(line.quantity),
      ...figures.flatMap((figure) => [figure.usd, figure.hours]),
    ])
  }
  const block = firstUsageBlock(input.lines, period)
  if (block) {
    rows.push([
      t(input.lang, "comboTotal"),
      "",
      exclusionMessage(input.lang, block),
      ...input.cities.flatMap(() => ["", ""]),
    ])
  } else {
    const totals = input.cities.map((city) => {
      const result = evaluateBasket(city, input.lines, input.overrides[city.id], period, view)
      if (!result.ok) return [exclusionMessage(input.lang, result.reason, prices), ""]
      return [csvNumber(displayAmount(result.totalUsd, money)), csvNumber(result.hours)]
    })
    rows.push([t(input.lang, "comboTotal"), "", "", ...totals.flat()])
  }
  return serialize(rows)
}
