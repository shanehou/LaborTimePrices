import { useEffect, useRef, useState } from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { ItemUsage } from "@/components/ItemUsage"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  exclusionMessage,
  formatMessage,
  labelCategory,
  labelCountry,
  t,
  type Lang,
} from "@/i18n"
import { deltaTone, formatDeltaPercent, percentDelta } from "@/lib/compare"
import { formatLaborHours, formatMoney, formatPlain } from "@/lib/format"
import { USD_MONEY, type MoneyFormat } from "@/lib/money"
import {
  evaluateBasket,
  groupCatalog,
  listCatalog,
  resolveMonthlyHours,
  type PriceView,
} from "@/lib/labor"
import { emptyUsage, usageBlock, type PeriodContext } from "@/lib/period"

const LISTED_PERIOD: PeriodContext = { horizon: "listed", mode: "single", usage: emptyUsage() }
import type { CityRecord } from "@/lib/types"

export type PriceUnit = "hours" | "usd"

type CompareTableProps = {
  lang: Lang
  cities: CityRecord[]
  overrides: Record<string, number>
  unit: PriceUnit
  onUnit: (unit: PriceUnit) => void
  money?: MoneyFormat
}

const ITEM_COLUMN = "w-72"
const BASELINE_COLUMN = "w-44"
const BASELINE_STICKY = "left-72"
const PERCENT_COLUMN = "w-[4.75rem]"
const VALUE_COLUMN = "w-24"

export function CompareTable({
  lang,
  cities,
  overrides,
  unit,
  onUnit,
  money = USD_MONEY,
}: CompareTableProps) {
  const groups = groupCatalog(listCatalog(cities))
  const baselineCity = cities.length > 1 ? cities[0] : undefined
  const [showValues, setShowValues] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScroll, setCanScroll] = useState({ left: false, right: false })

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const update = () => {
      const left = container.scrollLeft > 2
      const right = container.scrollLeft + container.clientWidth < container.scrollWidth - 2
      setCanScroll((current) =>
        current.left === left && current.right === right ? current : { left, right },
      )
    }
    update()
    container.addEventListener("scroll", update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(container)
    const table = container.querySelector("table")
    if (table) observer.observe(table)
    const frame = requestAnimationFrame(update)
    return () => {
      cancelAnimationFrame(frame)
      container.removeEventListener("scroll", update)
      observer.disconnect()
    }
  }, [cities.length, showValues])

  function scrollBy(direction: -1 | 1) {
    const container = scrollRef.current
    if (!container) return
    container.scrollBy({
      left: direction * Math.max(240, container.clientWidth * 0.8),
      behavior: "smooth",
    })
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg bg-muted/70 px-2 py-1">
          <span className="text-xs text-muted-foreground">{t(lang, "measureLabel")}</span>
          <ToggleGroup
            type="single"
            variant="outline"
            value={unit}
            aria-label={t(lang, "measureLabel")}
            onValueChange={(value) => {
              if (value === "hours" || value === "usd") onUnit(value)
            }}
          >
            <ToggleGroupItem value="hours">{t(lang, "unitHours")}</ToggleGroupItem>
            <ToggleGroupItem value="usd">
              {formatMessage(t(lang, "unitMoney"), { code: money.currency })}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="hidden items-center gap-2 rounded-lg bg-muted/70 px-2 py-1 md:flex">
          <span className="text-xs text-muted-foreground">{t(lang, "compareViewLabel")}</span>
          <ToggleGroup
            type="single"
            variant="outline"
            value={showValues ? "values" : "percent"}
            aria-label={t(lang, "compareViewLabel")}
            onValueChange={(value) => {
              if (value === "percent" || value === "values") setShowValues(value === "values")
            }}
          >
            <ToggleGroupItem value="percent">{t(lang, "compareModePercent")}</ToggleGroupItem>
            <ToggleGroupItem value="values">{t(lang, "compareModeValues")}</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="hidden items-center gap-1 md:flex">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t(lang, "compareScrollLeft")}
              disabled={!canScroll.left}
              onClick={() => scrollBy(-1)}
            >
              <ChevronLeftIcon />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t(lang, "compareScrollRight")}
              disabled={!canScroll.right}
              onClick={() => scrollBy(1)}
            >
              <ChevronRightIcon />
            </Button>
          </div>
      </div>
      {cities.length > 1 && (
        <p className="text-xs text-muted-foreground">{t(lang, "compareBaselineHint")}</p>
      )}
      {cities.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t(lang, "compareEmpty")}</p>
      ) : (
        <>
          <div className="hidden md:block">
            <div className="rounded-xl bg-card ring-1 ring-foreground/10">
              <Table
                containerRef={scrollRef}
                containerClassName="[scrollbar-width:thin]"
                className="w-full table-fixed"
              >
                <TableCaption className="sr-only">{t(lang, "compareTitle")}</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead className={`sticky left-0 z-30 ${ITEM_COLUMN} bg-card`}>
                      {t(lang, "colItem")}
                    </TableHead>
                    {cities.map((city, index) => {
                      const resolved = resolveMonthlyHours(city, overrides[city.id])
                      const salary = city.monthly_net_salary
                      const wage =
                        resolved.ok && salary !== null && salary > 0
                          ? salary / resolved.hours
                          : null
                      const isFirst = index === 0
                      const isBaseline = isFirst && baselineCity !== undefined
                      const widthClass = isFirst
                        ? BASELINE_COLUMN
                        : showValues
                          ? VALUE_COLUMN
                          : PERCENT_COLUMN
                      const stickyClass = isFirst
                        ? `sticky z-20 ${BASELINE_STICKY} ${widthClass} bg-card`
                        : `${widthClass} bg-card`
                      return (
                        <TableHead
                          key={city.id}
                          data-city={city.id}
                          className={`align-bottom ${stickyClass}`}
                        >
                          <div
                            className="truncate text-sm font-medium text-foreground"
                            title={city.name}
                          >
                            {city.name}
                          </div>
                          <div className="truncate text-xs font-normal text-muted-foreground">
                            {labelCountry(lang, city.country)}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            {isBaseline && (
                              <Badge variant="outline" className="text-[10px]">
                                {t(lang, "baselineBadge")}
                              </Badge>
                            )}
                            {resolved.ok && resolved.source === "visitor" && (
                              <Badge className="text-[10px]">{t(lang, "hoursVisitor")}</Badge>
                            )}
                          </div>
                          {(index === 0 || showValues) && (
                            <div
                              className="mt-1 truncate text-[10px] font-normal text-muted-foreground nums"
                              title={`${resolved.ok ? formatPlain(lang, resolved.hours, 2) : "—"}${
                                wage !== null ? ` · ${formatMoney(lang, wage, money)}` : ""
                              }`}
                            >
                              {resolved.ok ? formatPlain(lang, resolved.hours, 2) : "—"}
                              {wage !== null ? ` · ${formatMoney(lang, wage, money)}` : ""}
                            </div>
                          )}
                        </TableHead>
                      )
                    })}
                    <TableHead aria-hidden="true" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((group) => (
                    <CategoryRows
                      key={group.category}
                      lang={lang}
                      money={money}
                      category={group.category}
                      items={group.items}
                      cities={cities}
                      overrides={overrides}
                      unit={unit}
                      period={LISTED_PERIOD}
                      baselineCity={baselineCity}
                      showValues={showValues}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <div className="md:hidden">
            <CompareCards
              lang={lang}
              groups={groups}
              cities={cities}
              overrides={overrides}
              unit={unit}
              period={LISTED_PERIOD}
              baselineCity={baselineCity}
              money={money}
            />
          </div>
        </>
      )}
    </section>
  )
}

function CategoryRows({
  lang,
  category,
  items,
  cities,
  overrides,
  unit,
  period,
  baselineCity,
  showValues,
  money,
}: {
  lang: Lang
  category: string
  items: string[]
  cities: CityRecord[]
  overrides: Record<string, number>
  unit: PriceUnit
  period: PeriodContext
  baselineCity: CityRecord | undefined
  showValues: boolean
  money: MoneyFormat
}) {
  const view: PriceView = { lang, prices: cities.flatMap((city) => city.prices) }
  return (
    <>
      <TableRow className="bg-muted/70 hover:bg-muted/70">
        <TableCell colSpan={cities.length + 2} className="font-medium">
          {labelCategory(lang, category)}
        </TableCell>
      </TableRow>
      {items.map((item) => {
        const blocked = usageBlock(item, 1, period)
        const baselineValue = blocked
          ? null
          : baselineValueFor(baselineCity, item, unit, overrides, period, view)
        return (
          <TableRow key={item}>
            <TableCell
              className={`sticky left-0 z-20 ${ITEM_COLUMN} bg-card align-top whitespace-normal leading-snug`}
            >
              <ItemUsage
                lang={lang}
                item={item}
                horizon="listed"
                mode="single"
                usage={period.usage}
                prices={view.prices}
              />
            </TableCell>
            {cities.map((city, index) => {
              const isBaseline = city.id === baselineCity?.id
              const isFirst = index === 0
              const stickyClass = isFirst
                ? `sticky z-10 ${BASELINE_STICKY} ${BASELINE_COLUMN} bg-card`
                : ""
              return (
                <TableCell
                  key={city.id}
                  data-city={city.id}
                  data-item={item}
                  className={`align-top whitespace-normal nums ${stickyClass}`}
                >
                  {blocked ? (
                    <span>—</span>
                  ) : (
                    <CellValue
                      lang={lang}
                      city={city}
                      item={item}
                      unit={unit}
                      period={period}
                      override={overrides[city.id]}
                      baselineValue={baselineValue}
                      baselineName={baselineCity?.name}
                      isBaseline={isBaseline}
                      showValues={showValues}
                      view={view}
                      money={money}
                    />
                  )}
                </TableCell>
              )
            })}
            <TableCell aria-hidden="true" />
          </TableRow>
        )
      })}
    </>
  )
}

function baselineValueFor(
  city: CityRecord | undefined,
  item: string,
  unit: PriceUnit,
  overrides: Record<string, number>,
  period: PeriodContext,
  view: PriceView,
): number | null {
  if (!city) return null
  const result = evaluateBasket(city, [{ item, quantity: 1 }], overrides[city.id], period, view)
  if (!result.ok) return null
  return unit === "usd" ? result.totalUsd : result.hours
}

type CellModel =
  | { kind: "value"; text: string; delta: number | null }
  | { kind: "reason"; text: string }

function cellModel({
  lang,
  city,
  item,
  unit,
  period,
  override,
  baselineValue,
  isBaseline,
  view,
  money,
}: {
  lang: Lang
  city: CityRecord
  item: string
  unit: PriceUnit
  period: PeriodContext
  override: number | undefined
  baselineValue: number | null
  isBaseline: boolean
  view: PriceView
  money: MoneyFormat
}): CellModel {
  const result = evaluateBasket(city, [{ item, quantity: 1 }], override, period, view)
  if (!result.ok) return { kind: "reason", text: exclusionMessage(lang, result.reason, view.prices) }
  const value = unit === "usd" ? result.totalUsd : result.hours
  const delta = !isBaseline && baselineValue !== null ? percentDelta(value, baselineValue) : null
  const text = unit === "usd" ? formatMoney(lang, result.totalUsd, money) : formatLaborHours(lang, result.hours)
  return { kind: "value", text, delta }
}

function CellValue({
  lang,
  city,
  item,
  unit,
  period,
  override,
  baselineValue,
  baselineName,
  isBaseline,
  showValues,
  view,
  money,
}: {
  lang: Lang
  city: CityRecord
  item: string
  unit: PriceUnit
  period: PeriodContext
  override: number | undefined
  baselineValue: number | null
  baselineName: string | undefined
  isBaseline: boolean
  showValues: boolean
  view: PriceView
  money: MoneyFormat
}) {
  const model = cellModel({
    lang,
    city,
    item,
    unit,
    period,
    override,
    baselineValue,
    isBaseline,
    view,
    money,
  })
  if (model.kind === "reason") return <Reason>{model.text}</Reason>
  const showAbsolute = isBaseline || showValues || model.delta === null
  return (
    <div className="flex flex-col gap-0.5">
      {showAbsolute && <span className="font-medium">{model.text}</span>}
      {model.delta !== null && baselineName && (
        <Delta
          lang={lang}
          ratio={model.delta}
          baselineName={baselineName}
          className={showAbsolute ? "mt-0.5" : ""}
        />
      )}
    </div>
  )
}

function CompareCards({
  lang,
  groups,
  cities,
  overrides,
  unit,
  period,
  baselineCity,
  money,
}: {
  lang: Lang
  groups: { category: string; items: string[] }[]
  cities: CityRecord[]
  overrides: Record<string, number>
  unit: PriceUnit
  period: PeriodContext
  baselineCity: CityRecord | undefined
  money: MoneyFormat
}) {
  const view: PriceView = { lang, prices: cities.flatMap((city) => city.prices) }
  return (
    <div className="flex flex-col gap-5" data-compare-cards>
      {baselineCity && (
        <p className="text-xs text-muted-foreground">
          {formatMessage(t(lang, "compareBaselineName"), { city: baselineCity.name })}
        </p>
      )}
      {groups.map((group) => (
        <section key={group.category} className="flex flex-col gap-2">
          <h3 className="text-xs tracking-wide text-muted-foreground uppercase">
            {labelCategory(lang, group.category)}
          </h3>
          <ul className="flex flex-col gap-2">
            {group.items.map((item) => {
              const blocked = usageBlock(item, 1, period)
              const baselineValue = blocked
                ? null
                : baselineValueFor(baselineCity, item, unit, overrides, period, view)
              return (
                <li key={item} className="rounded-xl bg-card p-3 ring-1 ring-foreground/10">
                  <ItemUsage
                    lang={lang}
                    item={item}
                    horizon="listed"
                    mode="single"
                    usage={period.usage}
                    prices={view.prices}
                  />
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {cities.map((city) => {
                      const isBaseline = city.id === baselineCity?.id
                      const model = blocked
                        ? null
                        : cellModel({
                            lang,
                            city,
                            item,
                            unit,
                            period,
                            override: overrides[city.id],
                            baselineValue,
                            isBaseline,
                            view,
                            money,
                          })
                      return (
                        <li
                          key={city.id}
                          data-city={city.id}
                          data-item={item}
                          className="flex items-start justify-between gap-3 text-sm"
                        >
                          <span
                            className={`min-w-0 truncate ${isBaseline ? "font-medium" : ""}`}
                            data-baseline={isBaseline ? "true" : undefined}
                          >
                            {city.name}
                          </span>
                          <span className="flex shrink-0 items-center gap-1.5">
                            {model === null ? (
                              <span>—</span>
                            ) : model.kind === "reason" ? (
                              <span className="text-xs text-muted-foreground">{model.text}</span>
                            ) : (
                              <>
                                <span className="nums">{model.text}</span>
                                {model.delta !== null && baselineCity && (
                                  <Delta
                                    lang={lang}
                                    ratio={model.delta}
                                    baselineName={baselineCity.name}
                                  />
                                )}
                              </>
                            )}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

function Delta({
  lang,
  ratio,
  baselineName,
  className = "",
}: {
  lang: Lang
  ratio: number
  baselineName: string
  className?: string
}) {
  const tone = deltaTone(lang, ratio)
  const toneClass =
    tone === "red"
      ? "text-red-700"
      : tone === "green"
        ? "text-green-700"
        : "text-muted-foreground"
  return (
    <span
      className={`text-xs font-medium nums ${toneClass} ${className}`}
      data-delta={Math.round(ratio * 1000) / 10}
      data-tone={tone}
      title={formatMessage(t(lang, "compareRelativeTo"), { city: baselineName })}
    >
      {formatDeltaPercent(lang, ratio)}
    </span>
  )
}

function Reason({ children }: { children: string }) {
  return <span className="text-xs text-muted-foreground">{children}</span>
}
