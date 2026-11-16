import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  exclusionMessage,
  labelCountry,
  labelItem,
  t,
  type Lang,
} from "@/i18n"
import { formatLaborHours, formatPlain, formatUsd } from "@/lib/format"
import { rankCities } from "@/lib/labor"
import { firstUsageBlock, type PeriodContext } from "@/lib/period"
import type { BasketLine, CityRecord } from "@/lib/types"

type RankingProps = {
  lang: Lang
  cities: CityRecord[]
  lines: BasketLine[]
  overrides: Record<string, number>
  period: PeriodContext
  customEmpty: boolean
  // Passed only by the item-comparison tab, where the visitor picks one item.
  target?: string
  onTarget?: (target: string) => void
  items?: string[]
}

export function Ranking({
  lang,
  cities,
  lines,
  overrides,
  period,
  customEmpty,
  target,
  onTarget,
  items,
}: RankingProps) {
  const pickerItems = items ?? []
  const showPicker = target !== undefined && onTarget !== undefined
  const block = firstUsageBlock(lines, period)
  const result =
    block || customEmpty || lines.length === 0
      ? null
      : rankCities(cities, lines, overrides, period)

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-heading text-2xl">{t(lang, "rankTitle")}</h2>
      </div>
      {showPicker && (
        <div className="max-w-xl">
          <Label htmlFor="rank-target" className="mb-2 block">
            {t(lang, "rankTargetLabel")}
          </Label>
          <Select
            value={pickerItems.length > 0 ? (target ?? "") : ""}
            onValueChange={(value) => onTarget?.(value)}
            disabled={pickerItems.length === 0}
          >
            <SelectTrigger id="rank-target" className="w-full bg-card">
              <SelectValue placeholder={t(lang, "rankTargetLabel")} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>{t(lang, "rankGroupItems")}</SelectLabel>
                {pickerItems.map((item) => (
                  <SelectItem key={item} value={`item:${item}`}>
                    {labelItem(lang, item)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      )}
      {block ? (
        <p className="text-sm text-muted-foreground">{exclusionMessage(lang, block)}</p>
      ) : cities.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t(lang, "rankEmptySelection")}</p>
      ) : customEmpty ? (
        <p className="text-sm text-muted-foreground">{t(lang, "basketEmpty")}</p>
      ) : result && result.ranked.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t(lang, "rankNone")}</p>
      ) : (
        result && (
          <ol className="flex flex-col">
            {result.ranked.map((row, index) => (
              <li
                key={row.city.id}
                data-city={row.city.id}
                data-rank={index + 1}
                className="grid grid-cols-[3rem_1fr_auto] items-center gap-3 border-b border-border/80 py-3"
              >
                <span className="font-heading text-3xl text-primary nums">
                  {formatPlain(lang, index + 1, 0)}
                </span>
                <div>
                  <p className="text-lg">{row.city.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {labelCountry(lang, row.city.country)}
                  </p>
                  {row.source === "visitor" && (
                    <Badge className="mt-1">{t(lang, "hoursVisitor")}</Badge>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-heading text-xl nums">{formatLaborHours(lang, row.hours)}</p>
                  <p className="text-sm text-muted-foreground nums">{formatUsd(lang, row.totalUsd)}</p>
                </div>
              </li>
            ))}
          </ol>
        )
      )}
      {result && result.excluded.length > 0 && (
        <div>
          <h3 className="text-sm font-medium">{t(lang, "rankExcluded")}</h3>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
            {result.excluded.map((row) => (
              <li key={row.city.id}>
                {row.city.name}: {exclusionMessage(lang, row.reason)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
