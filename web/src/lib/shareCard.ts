import {
  exclusionMessage,
  formatMessage,
  labelItem,
  t,
  type Lang,
} from "../i18n"
import { describeQuantity, usageText } from "./exportCsv"
import { formatLaborHours, formatMoney } from "./format"
import { USD_MONEY, type MoneyFormat } from "./money"
import { evaluateBasket, type PriceView } from "./labor"
import { firstUsageBlock, type Horizon, type PeriodContext, type Usage } from "./period"
import { CUSTOM_TARGET } from "./rankTarget"
import type { BasketLine, CityRecord } from "./types"

export type ShareCardCity = {
  name: string
  primary: string | null
  secondary: string | null
  reason: string | null
}

export type ShareCardLine = {
  label: string
  detail: string
}

export type ShareCardModel = {
  kicker: string
  title: string
  subtitle: string
  note: string | null
  lines: ShareCardLine[]
  more: string | null
  cities: ShareCardCity[]
  blocked: string | null
  empty: string | null
  footerSource: string
  footerSite: string
  footerNote: string
}

const MAX_LINES = 12

function horizonName(lang: Lang, horizon: Horizon): string {
  if (horizon === "month") return t(lang, "horizonMonth")
  if (horizon === "year") return t(lang, "horizonYear")
  return t(lang, "horizonListed")
}

function cityRow(
  lang: Lang,
  city: CityRecord,
  lines: BasketLine[],
  override: number | undefined,
  period: PeriodContext,
  view: PriceView,
  money: MoneyFormat,
): ShareCardCity {
  const result = evaluateBasket(city, lines, override, period, view)
  if (!result.ok) {
    return {
      name: city.name,
      primary: null,
      secondary: null,
      reason: exclusionMessage(lang, result.reason, view.prices),
    }
  }
  return {
    name: city.name,
    primary: formatLaborHours(lang, result.hours),
    secondary: formatMoney(lang, result.totalUsd, money),
    reason: null,
  }
}

export function buildShareCard(input: {
  lang: Lang
  tab: "items" | "combos"
  horizon: Horizon
  cities: CityRecord[]
  overrides: Record<string, number>
  comboTarget: string
  customName: string
  lines: BasketLine[]
  usage: Usage
  money?: MoneyFormat
}): ShareCardModel {
  const money = input.money ?? USD_MONEY
  const mode = input.tab === "items" ? "single" : "combo"
  const period: PeriodContext = { horizon: input.horizon, mode, usage: input.usage }
  const view: PriceView = { lang: input.lang, prices: input.cities.flatMap((city) => city.prices) }
  const block = firstUsageBlock(input.lines, period)
  const note = input.horizon === "listed" ? null : t(input.lang, "amortNote")
  const footer = {
    footerSource: t(input.lang, "footerNumbeoLink"),
    footerSite: t(input.lang, "shareCardSite"),
    footerNote: t(input.lang, "footerDisclaimer"),
  }
  const subtitle = horizonName(input.lang, input.horizon)

  if (input.tab === "items") {
    const item = input.lines[0]?.item
    const title = item ? labelItem(input.lang, item, view.prices) : t(input.lang, "tabItems")
    const detail =
      item && !block
        ? usageText(input.lang, item, input.lines[0]?.quantity ?? 1, period, view.prices)
        : ""
    return {
      kicker: t(input.lang, "docTitle"),
      title,
      subtitle,
      note,
      lines: detail ? [{ label: t(input.lang, "csvUsage"), detail }] : [],
      more: null,
      cities:
        block || input.cities.length === 0
          ? []
          : input.cities.map((city) =>
              cityRow(input.lang, city, input.lines, input.overrides[city.id], period, view, money),
            ),
      blocked: block ? exclusionMessage(input.lang, block) : null,
      empty: input.cities.length === 0 ? t(input.lang, "shareCardEmpty") : null,
      ...footer,
    }
  }

  const title =
    input.comboTarget === CUSTOM_TARGET
      ? input.customName.trim() || t(input.lang, "basketCustom")
      : t(input.lang, "presetLiving")
  const shown = input.lines.slice(0, MAX_LINES)
  const hidden = input.lines.length - shown.length
  return {
    kicker: t(input.lang, "docTitle"),
    title,
    subtitle,
    note,
    lines: shown.map((line) => ({
      label: labelItem(input.lang, line.item, view.prices),
      detail: describeQuantity(
        input.lang,
        line.item,
        line.quantity,
        input.horizon,
        input.usage.years[line.item],
        view.prices,
      ),
    })),
    more: hidden > 0 ? formatMessage(t(input.lang, "shareCardMore"), { count: hidden }) : null,
    cities:
      block || input.cities.length === 0 || input.lines.length === 0
        ? []
        : input.cities.map((city) =>
            cityRow(input.lang, city, input.lines, input.overrides[city.id], period, view, money),
          ),
    blocked: block
      ? exclusionMessage(input.lang, block)
      : input.lines.length === 0
        ? t(input.lang, "comboEmpty")
        : null,
    empty: input.cities.length === 0 ? t(input.lang, "shareCardEmpty") : null,
    ...footer,
  }
}
