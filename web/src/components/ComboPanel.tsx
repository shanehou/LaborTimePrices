import type { ReactNode } from "react"
import { BasketEditor } from "@/components/BasketEditor"
import { HorizonToggle } from "@/components/HorizonBar"
import { ItemUsage } from "@/components/ItemUsage"
import { Ranking } from "@/components/Ranking"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { BASKETS } from "@/data/items"
import { CUSTOM_TARGET, PRESET_TARGET } from "@/lib/rankTarget"
import { exclusionMessage, labelItem, t, type Lang } from "@/i18n"
import { comboDetail } from "@/lib/combo"
import { describeQuantity } from "@/lib/exportCsv"
import { formatLaborHours, formatUsd } from "@/lib/format"
import { priceUsdFor } from "@/data/measure"
import { findPrice, evaluateBasket, type PriceView } from "@/lib/labor"
import {
  lineSpendUsd,
  quantityFromField,
  setUsageNumber,
  usageBlock,
  type Horizon,
  type PeriodContext,
  type Usage,
} from "@/lib/period"
import type { CustomBasket } from "@/lib/rankTarget"
import type { BasketLine, CityRecord } from "@/lib/types"

export { CUSTOM_TARGET, PRESET_TARGET }

type ComboPanelProps = {
  lang: Lang
  cities: CityRecord[]
  overrides: Record<string, number>
  target: string
  onTarget: (target: string) => void
  lines: BasketLine[]
  custom: CustomBasket
  customName: string
  onCustomName: (name: string) => void
  horizon: Horizon
  onHorizon: (horizon: Horizon) => void
  usage: Usage
  onUsage: (usage: Usage) => void
  onToggle: (item: string, checked: boolean) => void
  onQuantity: (item: string, quantity: string) => void
  onEditFromPreset: () => void
  groups: { category: string; items: string[] }[]
}

export function ComboPanel({
  lang,
  cities,
  overrides,
  target,
  onTarget,
  lines,
  custom,
  customName,
  onCustomName,
  horizon,
  onHorizon,
  usage,
  onUsage,
  onToggle,
  onQuantity,
  onEditFromPreset,
  groups,
}: ComboPanelProps) {
  const isCustom = target === CUSTOM_TARGET
  const period: PeriodContext = { horizon, mode: "combo", usage }
  const view: PriceView = { lang, prices: cities.flatMap((city) => city.prices) }
  const rows = comboDetail(lines, cities, view)
  const checked = Object.entries(custom).filter(([, state]) => state.checked)

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3">
          <HorizonToggle lang={lang} horizon={horizon} onHorizon={onHorizon} />
        </div>
        <p className="text-sm text-muted-foreground">{t(lang, "comboPickerLabel")}</p>
        <div className="grid gap-3 md:grid-cols-2">
          <ComboCard
            title={t(lang, "presetLiving")}
            selected={!isCustom}
            onSelect={() => onTarget(PRESET_TARGET)}
          >
            <ul className="flex flex-col gap-1">
              {BASKETS[0].lines.map((line) => (
                <li key={line.item} className="text-sm text-muted-foreground">
                    {labelItem(lang, line.item, view.prices)} × {line.quantity}
                </li>
              ))}
            </ul>
            {!isCustom && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={onEditFromPreset}
              >
                {t(lang, "comboEditFromPreset")}
              </Button>
            )}
          </ComboCard>
          <ComboCard
            title={customName.trim() || t(lang, "basketCustom")}
            selected={isCustom}
            onSelect={() => onTarget(CUSTOM_TARGET)}
          >
            <Input
              value={customName}
              placeholder={t(lang, "basketCustom")}
              aria-label={t(lang, "customNameLabel")}
              onFocus={() => onTarget(CUSTOM_TARGET)}
              onChange={(event) => onCustomName(event.target.value.slice(0, 40))}
            />
            {checked.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {checked.map(([item, state]) => (
                  <li key={item} className="text-sm text-muted-foreground">
                    {labelItem(lang, item, view.prices)} ·{" "}
                    {describeQuantity(
                      lang,
                      item,
                      quantityFromField(state.quantity),
                      horizon,
                      usage.years[item],
                      view.prices,
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t(lang, "comboEmpty")}</p>
            )}
          </ComboCard>
        </div>
      </div>

      {isCustom && (
        <BasketEditor
          lang={lang}
          groups={groups}
          prices={view.prices}
          hasCities={cities.length > 0}
          custom={custom}
          horizon={horizon}
          usage={usage}
          onToggle={onToggle}
          onQuantity={onQuantity}
          onYears={(item, years) => onUsage(setUsageNumber(usage, "years", item, years))}
        />
      )}

      <div className="flex flex-col gap-3">
        <h3 className="font-heading text-xl">{t(lang, "comboDetailTitle")}</h3>
        {cities.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t(lang, "comboPickCities")}</p>
        ) : lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t(lang, "comboEmpty")}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-56">{t(lang, "colItem")}</TableHead>
                  <TableHead className="min-w-36">
                    {t(lang, horizon === "listed" ? "comboQty" : "csvUsage")}
                  </TableHead>
                  {cities.map((city) => (
                    <TableHead key={city.id} className="text-right whitespace-nowrap">
                      {city.name}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const blocked = usageBlock(row.item, row.quantity, period)
                  return (
                    <TableRow key={row.item}>
                      <TableCell className="whitespace-normal">
                        <ItemUsage
                          lang={lang}
                          item={row.item}
                          horizon={horizon}
                          mode="combo"
                          usage={usage}
                          quantity={row.quantity}
                          prices={view.prices}
                        />
                      </TableCell>
                      <TableCell className="nums whitespace-normal">
                        {describeQuantity(lang, row.item, row.quantity, horizon, usage.years[row.item], view.prices)}
                      </TableCell>
                      {cities.map((city) => {
                        const price = findPrice(city, row.item)
                        const usd = price ? priceUsdFor(lang, price, view.prices) : 0
                        const spent =
                          blocked || !price
                            ? null
                            : lineSpendUsd(usd, row.item, row.quantity, period)
                        return (
                          <TableCell key={city.id} className="text-right nums">
                            {spent && spent.ok ? formatUsd(lang, spent.usd) : "—"}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  )
                })}
                <TableRow className="bg-muted/70 hover:bg-muted/70">
                  <TableCell className="font-medium">{t(lang, "comboTotal")}</TableCell>
                  <TableCell />
                  {cities.map((city) => {
                    const result = evaluateBasket(city, lines, overrides[city.id], period, view)
                    return (
                      <TableCell key={city.id} className="text-right nums">
                        {result.ok ? (
                          <>
                            <span className="block font-medium">
                              {formatLaborHours(lang, result.hours)}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {formatUsd(lang, result.totalUsd)}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {exclusionMessage(lang, result.reason, view.prices)}
                          </span>
                        )}
                      </TableCell>
                    )
                  })}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Ranking
        lang={lang}
        cities={cities}
        lines={lines}
        overrides={overrides}
        period={period}
        customEmpty={isCustom && lines.length === 0}
      />
    </section>
  )
}

function ComboCard({
  title,
  selected,
  onSelect,
  children,
}: {
  title: string
  selected: boolean
  onSelect: () => void
  children: ReactNode
}) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-lg p-4 ring-1 ${
        selected ? "bg-primary/5 ring-primary" : "bg-card ring-foreground/10"
      }`}
    >
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className="flex items-center gap-2 text-left font-medium"
      >
        <span
          aria-hidden="true"
          className={`inline-block size-3 shrink-0 rounded-full border ${
            selected ? "border-primary bg-primary" : "border-foreground/30"
          }`}
        />
        {title}
      </button>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}
