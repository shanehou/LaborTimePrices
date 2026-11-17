import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { t, type Lang } from "@/i18n"
import type { Horizon } from "@/lib/period"

export function HorizonToggle({
  lang,
  horizon,
  onHorizon,
}: {
  lang: Lang
  horizon: Horizon
  onHorizon: (horizon: Horizon) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">{t(lang, "horizonLabel")}</span>
        <ToggleGroup
          type="single"
          variant="outline"
          value={horizon}
          aria-label={t(lang, "horizonLabel")}
          onValueChange={(value) => {
            if (value === "listed" || value === "month" || value === "year") onHorizon(value)
          }}
        >
          <ToggleGroupItem value="listed">{t(lang, "horizonListed")}</ToggleGroupItem>
          <ToggleGroupItem value="month">{t(lang, "horizonMonth")}</ToggleGroupItem>
          <ToggleGroupItem value="year">{t(lang, "horizonYear")}</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
        {t(lang, "horizonHint")}
      </p>
    </div>
  )
}
