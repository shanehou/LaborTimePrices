import type { ReactNode } from "react"
import { BasketEditor } from "@/components/BasketEditor"
import { Ranking } from "@/components/Ranking"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { BASKETS } from "@/data/items"
import { labelItem, t, type Lang } from "@/i18n"
import { comboDetail } from "@/lib/combo"
import { formatLaborHours, formatPlain, formatUsd } from "@/lib/format"
import { evaluateBasket } from "@/lib/labor"
import type { CustomBasket } from "@/lib/rankTarget"
import type { BasketLine, CityRecord } from "@/lib/types"

export const PRESET_TARGET = `basket:${BASKETS[0].id}`
export const CUSTOM_TARGET = "basket:custom"

type ComboPanelProps = {
  lang: Lang
  cities: CityRecord[]
  overrides: Record<string, number>
  target: string
  onTarget: (target: string) => void
  lines: BasketLine[]
  custom: CustomBasket
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
  onToggle,
  onQuantity,
  onEditFromPreset,
  groups,
}: ComboPanelProps) {
  const isCustom = target === CUSTOM_TARGET
  const rows = comboDetail(lines, cities)
  const checked = Object.entries(custom).filter(([, state]) => state.checked)

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-2xl">{t(lang, "comboTitle")}</h2>
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
                  {labelItem(lang, line.item)} × {line.quantity}
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
            title={t(lang, "basketCustom")}
            selected={isCustom}
            onSelect={() => onTarget(CUSTOM_TARGET)}
          >
            {checked.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {checked.map(([item, state]) => (
                  <li key={item} className="text-sm text-muted-foreground">
                    {labelItem(lang, item)} × {state.quantity}
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
          hasCities={cities.length > 0}
          custom={custom}
          onToggle={onToggle}
          onQuantity={onQuantity}
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
                  <TableHead className="w-20">{t(lang, "comboQty")}</TableHead>
                  {cities.map((city) => (
                    <TableHead key={city.id} className="text-right whitespace-nowrap">
                      {city.name}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.item}>
                    <TableCell className="font-medium whitespace-normal">
                      {labelItem(lang, row.item)}
                    </TableCell>
                    <TableCell className="nums">{formatPlain(lang, row.quantity, 2)}</TableCell>
                    {cities.map((city) => {
                      const value = row.byCity[city.id]
                      return (
                        <TableCell key={city.id} className="text-right nums">
                          {value === null ? "—" : formatUsd(lang, value)}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
                <TableRow className="bg-muted/70 hover:bg-muted/70">
                  <TableCell className="font-medium">{t(lang, "comboTotal")}</TableCell>
                  <TableCell />
                  {cities.map((city) => {
                    const result = evaluateBasket(city, lines, overrides[city.id])
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
                          "—"
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
