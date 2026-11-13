import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { formatMessage, labelCategory, labelItem, t, type Lang } from "@/i18n"
import type { CustomBasket } from "@/lib/rankTarget"

type BasketEditorProps = {
  lang: Lang
  groups: { category: string; items: string[] }[]
  custom: CustomBasket
  onToggle: (item: string, checked: boolean) => void
  onQuantity: (item: string, quantity: string) => void
}

export function BasketEditor({ lang, groups, custom, onToggle, onQuantity }: BasketEditorProps) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-heading text-2xl">{t(lang, "basketTitle")}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t(lang, "basketHint")}</p>
      </div>
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
                return (
                  <li
                    key={item}
                    className="flex items-center gap-3 rounded-lg bg-card px-3 py-2 ring-1 ring-foreground/10"
                  >
                    <Checkbox
                      id={`check-${item}`}
                      checked={state.checked}
                      onCheckedChange={(checked) => onToggle(item, checked === true)}
                    />
                    <label htmlFor={`check-${item}`} className="min-w-0 flex-1 text-sm">
                      {labelItem(lang, item)}
                    </label>
                    <Input
                      id={inputId}
                      className="w-20"
                      type="number"
                      min={0.1}
                      step={1}
                      inputMode="decimal"
                      value={state.quantity}
                      disabled={!state.checked}
                      aria-label={formatMessage(t(lang, "basketQty"), {
                        item: labelItem(lang, item),
                      })}
                      onChange={(event) => onQuantity(item, event.target.value)}
                    />
                  </li>
                )
              })}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  )
}
