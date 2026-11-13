import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DEFAULT_MONTHLY_HOURS, resolveMonthlyHours } from "@/lib/labor"
import { formatMessage, exclusionMessage, t, type Lang } from "@/i18n"
import { formatPlain } from "@/lib/format"
import type { CityRecord } from "@/lib/types"

type HoursEditorProps = {
  lang: Lang
  cities: CityRecord[]
  overrides: Record<string, number>
  onChange: (cityId: string, hours: number | null) => void
}

export function HoursEditor({ lang, cities, overrides, onChange }: HoursEditorProps) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="font-heading text-2xl">{t(lang, "hoursTitle")}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t(lang, "hoursHint")}</p>
      </div>
      {cities.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t(lang, "cityNone")}</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {cities.map((city) => (
            <HoursField
              key={city.id}
              lang={lang}
              city={city}
              override={overrides[city.id]}
              onChange={onChange}
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

function HoursField({
  lang,
  city,
  override,
  onChange,
}: {
  lang: Lang
  city: CityRecord
  override: number | undefined
  onChange: (cityId: string, hours: number | null) => void
}) {
  const resolved = resolveMonthlyHours(city, override)
  const shown = displayedHours(city, override)
  const [draft, setDraft] = useState(() => String(shown))
  const [focused, setFocused] = useState(false)
  const draftValue = focused ? draft : String(shown)

  function commit(raw: string) {
    const trimmed = raw.trim()
    if (trimmed === "") {
      onChange(city.id, null)
      return
    }
    const value = Number(trimmed)
    if (!Number.isFinite(value) || value <= 0) return
    const baseline = clearableBaseline(city)
    if (baseline !== null && Math.abs(value - baseline) < 1e-9) {
      onChange(city.id, null)
      return
    }
    onChange(city.id, value)
  }

  let sourceLabel = t(lang, "hoursDefault")
  if (!resolved.ok) sourceLabel = exclusionMessage(lang, resolved.reason)
  else if (resolved.source === "visitor") sourceLabel = t(lang, "hoursVisitor")
  else if (resolved.source === "city") sourceLabel = t(lang, "hoursCity")

  return (
    <li className="rounded-xl bg-background/70 p-3 ring-1 ring-foreground/10">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{city.name}</p>
          <p className="text-xs text-muted-foreground nums">
            {resolved.ok ? formatPlain(lang, resolved.hours, 2) : "—"}
          </p>
        </div>
        <Badge variant={resolved.ok && resolved.source === "visitor" ? "default" : "outline"}>
          {sourceLabel}
        </Badge>
      </div>
      <div className="flex gap-2">
        <Input
          type="number"
          min={0.1}
          step={0.1}
          inputMode="decimal"
          value={draftValue}
          aria-label={formatMessage(t(lang, "hoursInput"), { city: city.name })}
          onFocus={() => {
            setDraft(String(shown))
            setFocused(true)
          }}
          onBlur={() => {
            setFocused(false)
            commit(draft)
          }}
          onChange={(event) => {
            setDraft(event.target.value)
            commit(event.target.value)
          }}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            onChange(city.id, null)
            setDraft(String(displayedHours(city, undefined)))
            setFocused(false)
          }}
        >
          {t(lang, "hoursReset")}
        </Button>
      </div>
    </li>
  )
}
