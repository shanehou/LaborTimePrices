import { Badge } from "@/components/ui/badge"
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
import { exclusionMessage, labelCategory, labelCountry, labelItem, t, type Lang } from "@/i18n"
import { formatLaborHours, formatPlain, formatUsd } from "@/lib/format"
import { evaluateBasket, findPrice, groupCatalog, listCatalog, resolveMonthlyHours } from "@/lib/labor"
import type { CityRecord } from "@/lib/types"

export type PriceUnit = "hours" | "usd"

type CompareTableProps = {
  lang: Lang
  cities: CityRecord[]
  overrides: Record<string, number>
  unit: PriceUnit
  onUnit: (unit: PriceUnit) => void
}

export function CompareTable({ lang, cities, overrides, unit, onUnit }: CompareTableProps) {
  const groups = groupCatalog(listCatalog(cities))

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-heading text-2xl">{t(lang, "compareTitle")}</h2>
        <ToggleGroup
          type="single"
          variant="outline"
          value={unit}
          aria-label={t(lang, "compareTitle")}
          onValueChange={(value) => {
            if (value === "hours" || value === "usd") onUnit(value)
          }}
        >
          <ToggleGroupItem value="hours">{t(lang, "unitHours")}</ToggleGroupItem>
          <ToggleGroupItem value="usd">{t(lang, "unitUsd")}</ToggleGroupItem>
        </ToggleGroup>
      </div>
      {cities.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t(lang, "compareEmpty")}</p>
      ) : (
        <div className="rounded-xl bg-card ring-1 ring-foreground/10">
          <Table>
            <TableCaption className="sr-only">{t(lang, "compareTitle")}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 min-w-44 bg-card">
                  {t(lang, "colItem")}
                </TableHead>
                {cities.map((city) => {
                  const resolved = resolveMonthlyHours(city, overrides[city.id])
                  const salary = city.monthly_net_salary
                  const wage =
                    resolved.ok && salary !== null && salary > 0 ? salary / resolved.hours : null
                  return (
                    <TableHead key={city.id} className="min-w-40 align-bottom">
                      <div className="font-medium text-foreground">{city.name}</div>
                      <div className="font-normal text-muted-foreground">
                        {labelCountry(lang, city.country)}
                      </div>
                      {resolved.ok && resolved.source === "visitor" && (
                        <Badge className="mt-1">{t(lang, "hoursVisitor")}</Badge>
                      )}
                      <div className="mt-1 font-normal text-muted-foreground nums">
                        {resolved.ok ? formatPlain(lang, resolved.hours, 2) : "—"}
                        {wage !== null ? ` · ${formatUsd(lang, wage)}` : ""}
                      </div>
                    </TableHead>
                  )
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <CategoryRows
                  key={group.category}
                  lang={lang}
                  category={group.category}
                  items={group.items}
                  cities={cities}
                  overrides={overrides}
                  unit={unit}
                />
              ))}
            </TableBody>
          </Table>
        </div>
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
}: {
  lang: Lang
  category: string
  items: string[]
  cities: CityRecord[]
  overrides: Record<string, number>
  unit: PriceUnit
}) {
  return (
    <>
      <TableRow className="bg-muted/70 hover:bg-muted/70">
        <TableCell colSpan={cities.length + 1} className="font-medium">
          {labelCategory(lang, category)}
        </TableCell>
      </TableRow>
      {items.map((item) => (
        <TableRow key={item}>
          <TableCell className="sticky left-0 z-10 bg-card font-medium">
            {labelItem(lang, item)}
          </TableCell>
          {cities.map((city) => (
            <TableCell key={city.id} data-city={city.id} data-item={item} className="nums">
              <CellValue lang={lang} city={city} item={item} unit={unit} override={overrides[city.id]} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

function CellValue({
  lang,
  city,
  item,
  unit,
  override,
}: {
  lang: Lang
  city: CityRecord
  item: string
  unit: PriceUnit
  override: number | undefined
}) {
  if (unit === "usd") {
    const price = findPrice(city, item)
    if (!price) return <Reason>{exclusionMessage(lang, { code: "missing_item", item })}</Reason>
    if (!(price.price_usd > 0)) {
      return <Reason>{exclusionMessage(lang, { code: "non_positive_price", item })}</Reason>
    }
    return formatUsd(lang, price.price_usd)
  }

  const result = evaluateBasket(city, [{ item, quantity: 1 }], override)
  if (!result.ok) return <Reason>{exclusionMessage(lang, result.reason)}</Reason>
  return <span className="font-heading text-base">{formatLaborHours(lang, result.hours)}</span>
}

function Reason({ children }: { children: string }) {
  return <span className="text-xs text-muted-foreground">{children}</span>
}
