import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { cadenceOf } from "@/data/cadence"
import { showsImperialArea, type PriceSample } from "@/data/measure"
import { formatMessage, labelCategory, labelItem, t, type Lang } from "@/i18n"
import type { MessageKey } from "@/i18n/en"
import { DEFAULT_PURCHASE_YEARS, type Horizon, type Usage } from "@/lib/period"
import type { CustomBasket } from "@/lib/rankTarget"

function quantityKey(item: string, horizon: Horizon, imperialArea: boolean): MessageKey {
  if (horizon === "listed") return "basketQty"
  switch (cadenceOf(item)) {
    case "unit":
      return "basketQtyTimes"
    case "asset":
      return "basketQtyCount"
    case "assetArea":
      return imperialArea ? "basketQtyAreaImperial" : "basketQtyArea"
    default:
      return "basketQtyBills"
  }
}

function quantityCaption(item: string, horizon: Horizon, imperialArea: boolean): MessageKey {
  if (horizon === "listed") return "comboQty"
  switch (cadenceOf(item)) {
    case "unit":
      return "usageTimes"
    case "asset":
      return "fieldPieces"
    case "assetArea":
      return imperialArea ? "usageAreaImperial" : "usageArea"
    default:
      return "fieldBills"
  }
}

type BasketEditorProps = {
  lang: Lang
  groups: { category: string; items: string[] }[]
  prices?: readonly PriceSample[]
  hasCities: boolean
  custom: CustomBasket
  horizon: Horizon
  usage: Usage
  onToggle: (item: string, checked: boolean) => void
  onQuantity: (item: string, quantity: string) => void
  onYears: (item: string, years: number | undefined) => void
}

export function BasketEditor({
  lang,
  groups,
  prices,
  hasCities,
  custom,
  horizon,
  usage,
  onToggle,
  onQuantity,
  onYears,
}: BasketEditorProps) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-heading text-2xl">{t(lang, "basketTitle")}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {t(lang, horizon === "listed" ? "basketHint" : "basketHintHorizon")}
        </p>
      </div>
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t(lang, hasCities ? "basketNoItems" : "basketPickCities")}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {groups.map((group) => (
            <li key={group.category}>
              <p className="mb-2 text-xs tracking-wide text-muted-foreground uppercase">
                {labelCategory(lang, group.category)}
              </p>
              <ul className="grid gap-2 md:grid-cols-2">
                {group.items.map((item) => {
                  const state = custom[item] ?? { checked: false, quantity: "1" }
                  const inputId = `qty-${item}`
                  const cadence = cadenceOf(item)
                  const imperialArea = showsImperialArea(lang, item, prices)
                  const showYears =
                    horizon !== "listed" && (cadence === "asset" || cadence === "assetArea")
                  const named = labelItem(lang, item, prices)
                  return (
                    <li
                      key={item}
                      className="flex flex-wrap items-center gap-3 rounded-lg bg-card px-3 py-2 ring-1 ring-foreground/10"
                    >
                      <Checkbox
                        id={`check-${item}`}
                        checked={state.checked}
                        onCheckedChange={(checked) => onToggle(item, checked === true)}
                      />
                      <label htmlFor={`check-${item}`} className="min-w-0 flex-1 text-sm">
                        {named}
                      </label>
                      {state.checked && (
                        <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                          {t(lang, quantityCaption(item, horizon, imperialArea))}
                          <Input
                            id={inputId}
                            className="w-24"
                            type="number"
                            min={0}
                            step={1}
                            inputMode="decimal"
                            value={state.quantity}
                            aria-label={formatMessage(t(lang, quantityKey(item, horizon, imperialArea)), {
                              item: named,
                            })}
                            onChange={(event) => onQuantity(item, event.target.value)}
                          />
                        </label>
                      )}
                      {showYears && state.checked && (
                        <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                          {t(lang, "usageYears")}
                          <Input
                            className="w-24"
                            type="number"
                            min={0}
                            step={1}
                            inputMode="decimal"
                            value={usage.years[item] ?? DEFAULT_PURCHASE_YEARS}
                            aria-label={formatMessage(t(lang, "basketYears"), { item: named })}
                            onChange={(event) => {
                              const next = event.target.value
                              if (next.trim() === "") {
                                onYears(item, undefined)
                                return
                              }
                              const parsed = Number(next)
                              if (Number.isFinite(parsed) && parsed > 0) onYears(item, parsed)
                            }}
                          />
                        </label>
                      )}
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
