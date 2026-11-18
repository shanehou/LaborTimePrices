import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DEFAULT_MONTHLY_HOURS, resolveMonthlyHours, resolveMonthlyNetSalary } from "@/lib/labor"
import { formatMessage, exclusionMessage, t, type Lang } from "@/i18n"
import { formatMoney, formatPlain } from "@/lib/format"
import { USD_MONEY, type MoneyFormat } from "@/lib/money"
import type { CityRecord } from "@/lib/types"

type CitySettingsEditorProps = {
  lang: Lang
  cities: CityRecord[]
  hoursOverrides: Record<string, number>
  /** Per-city net salaries in USD. */
  salaryOverrides: Record<string, number>
  onHoursChange: (cityId: string, hours: number | null) => void
  onSalaryChange: (cityId: string, salaryUsd: number | null) => void
  money?: MoneyFormat
}

export function CitySettingsEditor({
  lang,
  cities,
  hoursOverrides,
  salaryOverrides,
  onHoursChange,
  onSalaryChange,
  money = USD_MONEY,
}: CitySettingsEditorProps) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="font-heading text-2xl">{t(lang, "citySettingsTitle")}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {t(lang, "citySettingsHint")}
        </p>
      </div>
      {cities.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t(lang, "cityNone")}</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {cities.map((city) => (
            <CitySettingsField
              key={city.id}
              lang={lang}
              city={city}
              hoursOverride={hoursOverrides[city.id]}
              salaryOverride={salaryOverrides[city.id]}
              onHoursChange={onHoursChange}
              onSalaryChange={onSalaryChange}
              money={money}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function clearableBaseline(city: CityRecord): number | null {
  if (
    city.monthly_work_hours !== undefined &&
    Number.isFinite(city.monthly_work_hours) &&
    city.monthly_work_hours > 0
  ) {
    return city.monthly_work_hours
  }
  if (city.monthly_work_hours === undefined) return DEFAULT_MONTHLY_HOURS
  return null
}

function displayedHours(city: CityRecord, override: number | undefined): number {
  if (override !== undefined) return override
  if (city.monthly_work_hours !== undefined) return city.monthly_work_hours
  return DEFAULT_MONTHLY_HOURS
}

/** Stored salaries are USD; the input reads and writes the display currency. */
function displayRate(money: MoneyFormat): number {
  return Number.isFinite(money.rate) && money.rate > 0 ? money.rate : 1
}

function CitySettingsField({
  lang,
  city,
  hoursOverride,
  salaryOverride,
  onHoursChange,
  onSalaryChange,
  money,
}: {
  lang: Lang
  city: CityRecord
  hoursOverride: number | undefined
  salaryOverride: number | undefined
  onHoursChange: (cityId: string, hours: number | null) => void
  onSalaryChange: (cityId: string, salaryUsd: number | null) => void
  money: MoneyFormat
}) {
  const resolvedHours = resolveMonthlyHours(city, hoursOverride)
  const resolvedSalary = resolveMonthlyNetSalary(city, salaryOverride)
  const shownHours = displayedHours(city, hoursOverride)
  const rate = displayRate(money)
  const shownSalaryUsd = resolvedSalary.ok ? resolvedSalary.salary : null
  const shownSalary =
    shownSalaryUsd === null ? null : Math.round(shownSalaryUsd * rate * 100) / 100

  const [hoursDraft, setHoursDraft] = useState(() => String(shownHours))
  const [hoursFocused, setHoursFocused] = useState(false)
  const [salaryDraft, setSalaryDraft] = useState(() => (shownSalary === null ? "" : String(shownSalary)))
  const [salaryFocused, setSalaryFocused] = useState(false)

  const hoursValue = hoursFocused ? hoursDraft : String(shownHours)
  const salaryValue = salaryFocused ? salaryDraft : shownSalary === null ? "" : String(shownSalary)

  function commitHours(raw: string) {
    const trimmed = raw.trim()
    if (trimmed === "") {
      onHoursChange(city.id, null)
      return
    }
    const value = Number(trimmed)
    if (!Number.isFinite(value) || value <= 0) return
    const baseline = clearableBaseline(city)
    if (baseline !== null && Math.abs(value - baseline) < 1e-9) {
      onHoursChange(city.id, null)
      return
    }
    onHoursChange(city.id, value)
  }

  function commitSalary(raw: string) {
    const trimmed = raw.trim()
    if (trimmed === "") {
      onSalaryChange(city.id, null)
      return
    }
    const value = Number(trimmed)
    if (!Number.isFinite(value) || value <= 0) return
    let usd = value / rate
    usd = Math.round(usd * 100) / 100
    const baseline = city.monthly_net_salary
    // Round-tripping through the display rate can leave noise; matching the
    // Numbeo baseline within 0.5% counts as "back to the default".
    if (baseline !== null && baseline > 0 && Math.abs(usd - baseline) / baseline < 0.005) {
      onSalaryChange(city.id, null)
      return
    }
    onSalaryChange(city.id, usd)
  }

  let hoursLabel = t(lang, "hoursDefault")
  if (!resolvedHours.ok) hoursLabel = exclusionMessage(lang, resolvedHours.reason)
  else if (resolvedHours.source === "visitor") hoursLabel = t(lang, "hoursVisitor")
  else if (resolvedHours.source === "city") hoursLabel = t(lang, "hoursCity")

  let salaryLabel = t(lang, "salaryNumbeo")
  if (!resolvedSalary.ok) salaryLabel = exclusionMessage(lang, resolvedSalary.reason)
  else if (resolvedSalary.source === "visitor") salaryLabel = t(lang, "salaryVisitor")

  const wage =
    resolvedHours.ok && shownSalaryUsd !== null ? shownSalaryUsd / resolvedHours.hours : null

  return (
    <li className="rounded-xl bg-background/70 p-3 ring-1 ring-foreground/10">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{city.name}</p>
          <p className="text-xs text-muted-foreground nums">
            {resolvedHours.ok && wage !== null
              ? `${formatPlain(lang, resolvedHours.hours, 2)} · ${formatMoney(lang, wage, money)}`
              : "—"}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              {t(lang, "hoursLabel")}
              <Badge
                variant={resolvedHours.ok && resolvedHours.source === "visitor" ? "default" : "outline"}
                className="text-[10px]"
              >
                {hoursLabel}
              </Badge>
            </span>
            <Input
              type="number"
              min={0.1}
              step={0.1}
              inputMode="decimal"
              value={hoursValue}
              aria-label={formatMessage(t(lang, "hoursInput"), { city: city.name })}
              onFocus={() => {
                setHoursDraft(String(shownHours))
                setHoursFocused(true)
              }}
              onBlur={() => {
                setHoursFocused(false)
                commitHours(hoursDraft)
              }}
              onChange={(event) => {
                setHoursDraft(event.target.value)
                commitHours(event.target.value)
              }}
            />
          </label>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onHoursChange(city.id, null)
              setHoursDraft(String(displayedHours(city, undefined)))
              setHoursFocused(false)
            }}
          >
            {t(lang, "hoursReset")}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              {t(lang, "salaryLabel")}
              <Badge
                variant={resolvedSalary.ok && resolvedSalary.source === "visitor" ? "default" : "outline"}
                className="text-[10px]"
              >
                {salaryLabel}
              </Badge>
            </span>
            <Input
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={salaryValue}
              aria-label={formatMessage(t(lang, "salaryInput"), { city: city.name })}
              onFocus={() => {
                setSalaryDraft(shownSalary === null ? "" : String(shownSalary))
                setSalaryFocused(true)
              }}
              onBlur={() => {
                setSalaryFocused(false)
                commitSalary(salaryDraft)
              }}
              onChange={(event) => {
                setSalaryDraft(event.target.value)
                commitSalary(event.target.value)
              }}
            />
          </label>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onSalaryChange(city.id, null)
              const baseline = city.monthly_net_salary
              setSalaryDraft(
                baseline === null || !(baseline > 0)
                  ? ""
                  : String(Math.round(baseline * rate * 100) / 100),
              )
              setSalaryFocused(false)
            }}
          >
            {t(lang, "hoursReset")}
          </Button>
        </div>
      </div>
    </li>
  )
}
