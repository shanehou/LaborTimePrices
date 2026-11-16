import { useEffect, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cadenceOf } from "@/data/cadence"
import { exclusionMessage, formatMessage, labelItem, t, type Lang } from "@/i18n"
import { cadenceLabel } from "@/lib/exportCsv"
import {
  horizonFactor,
  usageBlock,
  type Horizon,
  type PeriodContext,
  type PeriodMode,
  type Usage,
} from "@/lib/period"

function UsageNumber({
  value,
  label,
  onValue,
}: {
  value: number | undefined
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
      className="h-7 w-20 text-xs"
      inputMode="decimal"
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

export function ItemUsage({
  lang,
  item,
  horizon,
  mode,
  usage,
  quantity = 1,
  onTimes,
  onYears,
  onArea,
}: {
  lang: Lang
  item: string
  horizon: Horizon
  mode: PeriodMode
  usage: Usage
  quantity?: number
  onTimes?: (item: string, value: number | undefined) => void
  onYears?: (item: string, value: number | undefined) => void
  onArea?: (item: string, value: number | undefined) => void
}) {
  const cadence = cadenceOf(item)
  const period: PeriodContext = { horizon, mode, usage }
  const block = usageBlock(item, quantity, period)
  const factor = horizonFactor(cadence, horizon)
  const named = labelItem(lang, item)
  const showTimes = horizon !== "listed" && cadence === "unit" && mode === "single" && onTimes
  const showArea = horizon !== "listed" && cadence === "assetArea" && mode === "single" && onArea
  const showYears =
    horizon !== "listed" && (cadence === "asset" || cadence === "assetArea") && onYears

  return (
    <div className="flex flex-col gap-1.5">
      <span className="leading-snug">{named}</span>
      <div className="flex flex-wrap items-center gap-1">
        <Badge variant="outline" className="text-[10px]">
          {cadenceLabel(lang, item)}
        </Badge>
        {factor === "x12" && (
          <span className="text-[10px] text-muted-foreground">{t(lang, "factorTimes12")}</span>
        )}
        {factor === "div12" && (
          <span className="text-[10px] text-muted-foreground">{t(lang, "factorDiv12")}</span>
        )}
      </div>
      {showTimes && (
        <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          {t(lang, "usageTimes")}
          <UsageNumber
            value={usage.times[item]}
            label={formatMessage(t(lang, "basketQtyTimes"), { item: named })}
            onValue={(value) => onTimes?.(item, value)}
          />
        </label>
      )}
      {showArea && (
        <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          {t(lang, "usageArea")}
          <UsageNumber
            value={usage.area[item]}
            label={formatMessage(t(lang, "basketQtyArea"), { item: named })}
            onValue={(value) => onArea?.(item, value)}
          />
        </label>
      )}
      {showYears && (
        <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          {t(lang, "usageYears")}
          <UsageNumber
            value={usage.years[item]}
            label={formatMessage(t(lang, "basketYears"), { item: named })}
            onValue={(value) => onYears?.(item, value)}
          />
        </label>
      )}
      {block && <p className="text-xs text-muted-foreground">{exclusionMessage(lang, block)}</p>}
    </div>
  )
}
