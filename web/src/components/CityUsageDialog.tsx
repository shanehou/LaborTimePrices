import { useEffect, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cadenceOf } from "@/data/cadence"
import { showsImperialArea, type PriceSample } from "@/data/measure"
import { formatMessage, labelItem, t, type Lang } from "@/i18n"
import { resolveFinancing, usageOverrideCityIds, type Usage, type UsageOverrides } from "@/lib/period"
import type { Repayment } from "@/lib/period"
import type { CityRecord } from "@/lib/types"

/** One per-city edit; `null` clears the override for that field. */
export type UsageOverridePatch = {
  area?: number | null
  years?: number | null
  rate?: number | null
  repayment?: Repayment | null
}

function OverrideNumber({
  value,
  placeholder,
  label,
  onValue,
}: {
  value: number | undefined
  placeholder: string
  label: string
  onValue: (value: number | undefined) => void
}) {
  const [text, setText] = useState(value === undefined ? "" : String(value))
  const focused = useRef(false)

  useEffect(() => {
    if (focused.current) return
    setText(value === undefined ? "" : String(value))
  }, [value])

  return (
    <Input
      className="h-8 w-20 text-xs"
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      aria-label={label}
      value={text}
      onFocus={() => {
        focused.current = true
      }}
      onBlur={() => {
        focused.current = false
        setText(value === undefined ? "" : String(value))
      }}
      onChange={(event) => {
        const next = event.target.value
        setText(next)
        if (next.trim() === "") {
          onValue(undefined)
          return
        }
        const parsed = Number(next)
        if (Number.isFinite(parsed) && parsed > 0) onValue(parsed)
      }}
    />
  )
}

export function CityUsageDialog({
  lang,
  item,
  cities,
  usage,
  overrides,
  sharedArea,
  prices,
  onOverride,
}: {
  lang: Lang
  item: string
  cities: CityRecord[]
  usage: Usage
  overrides: UsageOverrides
  /** Effective shared floor area for the line, shown as the placeholder. */
  sharedArea?: number
  prices?: readonly PriceSample[]
  onOverride: (item: string, cityId: string, patch: UsageOverridePatch) => void
}) {
  const cadence = cadenceOf(item)
  const isPurchase = cadence === "asset" || cadence === "assetArea"
  const showArea = cadence === "assetArea"
  const named = labelItem(lang, item, prices)
  const imperialArea = showsImperialArea(lang, item, prices)
  const overridden = usageOverrideCityIds(overrides, item)
  const areaKey = imperialArea ? "usageAreaImperial" : "usageArea"

  if (!isPurchase) return null

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={cities.length === 0}>
          {t(lang, "usagePerCity")}
          {overridden.length > 0 && (
            <Badge variant="default" className="ml-1 text-[10px]">
              {formatMessage(t(lang, "usagePerCityCount"), { count: overridden.length })}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {formatMessage(t(lang, "usagePerCityDialogTitle"), { item: named })}
          </DialogTitle>
          <DialogDescription>{t(lang, "usagePerCityHint")}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-28">{t(lang, "cityLabel")}</TableHead>
                {showArea && <TableHead>{t(lang, areaKey)}</TableHead>}
                <TableHead>{t(lang, "usageYears")}</TableHead>
                <TableHead>{t(lang, "usageRate")}</TableHead>
                <TableHead>{t(lang, "usageRepayment")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cities.map((city) => {
                const perCity = {
                  area: overrides.area[item]?.[city.id],
                  years: overrides.years[item]?.[city.id],
                  rate: overrides.rates[item]?.[city.id],
                }
                const repaymentOverride = overrides.repayments[item]?.[city.id]
                const financing = resolveFinancing(item, usage, city, overrides)
                return (
                  <TableRow key={city.id}>
                    <TableCell className="whitespace-nowrap">
                      <span className="text-sm">{city.name}</span>
                      {financing.rateSource === "city" && (
                        <Badge variant="outline" className="ml-1.5 text-[10px]">
                          {t(lang, "numbeoRateBadge")}
                        </Badge>
                      )}
                    </TableCell>
                    {showArea && (
                      <TableCell>
                        <OverrideNumber
                          value={perCity.area}
                          placeholder={
                            sharedArea !== undefined && Number.isFinite(sharedArea) && sharedArea > 0
                              ? String(sharedArea)
                              : "—"
                          }
                          label={formatMessage(t(lang, imperialArea ? "basketQtyAreaImperial" : "basketQtyArea"), { item: named })}
                          onValue={(value) => onOverride(item, city.id, { area: value ?? null })}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <OverrideNumber
                        value={perCity.years}
                        placeholder={String(financing.years)}
                        label={formatMessage(t(lang, "basketYears"), { item: named })}
                        onValue={(value) => onOverride(item, city.id, { years: value ?? null })}
                      />
                    </TableCell>
                    <TableCell>
                      <OverrideNumber
                        value={perCity.rate}
                        placeholder={
                          financing.rate !== undefined ? String(financing.rate) : "—"
                        }
                        label={formatMessage(t(lang, "basketRate"), { item: named })}
                        onValue={(value) => onOverride(item, city.id, { rate: value ?? null })}
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={repaymentOverride ?? "follow"}
                        onValueChange={(value) => {
                          if (value === "principal" || value === "payment") {
                            onOverride(item, city.id, { repayment: value })
                          } else {
                            onOverride(item, city.id, { repayment: null })
                          }
                        }}
                      >
                        <SelectTrigger
                          className="h-8 w-32 text-xs"
                          aria-label={formatMessage(t(lang, "basketRepayment"), { item: named })}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="follow">{t(lang, "usagePerCityFollow")}</SelectItem>
                          <SelectItem value="principal">{t(lang, "repayPrincipal")}</SelectItem>
                          <SelectItem value="payment">{t(lang, "repayPayment")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  )
}
