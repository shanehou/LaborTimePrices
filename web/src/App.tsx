import { useEffect, useMemo, useState } from "react"
import { BasketEditor } from "@/components/BasketEditor"
import { CitySelect } from "@/components/CitySelect"
import { CompareTable, type PriceUnit } from "@/components/CompareTable"
import { HoursEditor } from "@/components/HoursEditor"
import { Ranking, type RankScope } from "@/components/Ranking"
import { Card, CardContent } from "@/components/ui/card"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { mockPrices } from "@/data/mockPrices"
import { ITEMS } from "@/data/items"
import {
  formatMessage,
  loadReasonMessage,
  t,
  type Lang,
} from "@/i18n"
import { groupCatalog, listCatalog } from "@/lib/labor"
import { loadPrices, type LoadedPrices } from "@/lib/loadPrices"
import { linesForTarget, type CustomBasket } from "@/lib/rankTarget"
import { readHourOverrides, writeHourOverride, writeLang } from "@/lib/storage"

const activeLangClass =
  "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"

export default function App({ startupLang }: { startupLang: Lang }) {
  const [lang, setLang] = useState<Lang>(startupLang)
  const [loaded, setLoaded] = useState<LoadedPrices | null>(null)
  const [selected, setSelected] = useState<string[] | null>(null)
  const [overrides, setOverrides] = useState(readHourOverrides)
  const [unit, setUnit] = useState<PriceUnit>("hours")
  const [scope, setScope] = useState<RankScope>("selected")
  const [target, setTarget] = useState(`item:${ITEMS.coffee}`)
  const [custom, setCustom] = useState<CustomBasket>({})

  useEffect(() => {
    const controller = new AbortController()
    loadPrices()
      .then((result) => {
        if (!controller.signal.aborted) setLoaded(result)
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoaded({
            dataset: structuredClone(mockPrices),
            origin: "mock",
            reason: "network",
          })
        }
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-Hans" : "en"
    document.title = t(lang, "docTitle")
  }, [lang])

  const cities = loaded?.dataset.cities ?? []
  const selectedIds = selected ?? cities.map((city) => city.id)
  const selectedCities = cities.filter((city) => selectedIds.includes(city.id))
  const catalog = useMemo(() => listCatalog(cities), [cities])
  const groups = useMemo(() => groupCatalog(catalog), [catalog])
  const lines = linesForTarget(target, custom)
  const pool = scope === "all" ? cities : selectedCities

  function toggleCity(cityId: string) {
    setSelected((current) => {
      const base = current ?? cities.map((city) => city.id)
      return base.includes(cityId) ? base.filter((id) => id !== cityId) : [...base, cityId]
    })
  }

  function chooseLang(next: string) {
    if (next !== "zh" && next !== "en") return
    writeLang(next)
    setLang(next)
  }

  return (
    <div className="min-h-svh">
      <header className="masthead">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 md:px-6 md:py-16">
          <div className="flex items-start justify-between gap-4">
            <p className="text-xs tracking-[0.22em] uppercase opacity-75">{t(lang, "brandKicker")}</p>
            <ToggleGroup
              type="single"
              variant="outline"
              value={lang}
              aria-label={t(lang, "langLabel")}
              className="shrink-0 bg-[oklch(0.96_0.015_90)] text-[oklch(0.28_0.03_50)]"
              onValueChange={chooseLang}
            >
              <ToggleGroupItem value="zh" className={activeLangClass}>
                {t(lang, "langZh")}
              </ToggleGroupItem>
              <ToggleGroupItem value="en" className={activeLangClass}>
                {t(lang, "langEn")}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="max-w-3xl">
            <h1 className="font-heading text-5xl leading-[0.95] whitespace-pre-line md:text-7xl">
              {t(lang, "brandTitle")}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-[oklch(0.9_0.02_90)] md:text-lg">
              {t(lang, "brandLead")}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 md:px-6">
        {!loaded ? (
          <p>{t(lang, "loading")}</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {formatMessage(t(lang, "datasetCount"), { count: cities.length })}
            </p>
            <Card>
              <CardContent className="flex flex-col gap-6">
                <CitySelect
                  lang={lang}
                  cities={cities}
                  selectedIds={selectedIds}
                  onToggle={toggleCity}
                />
                <HoursEditor
                  lang={lang}
                  cities={selectedCities}
                  overrides={overrides}
                  onChange={(cityId, hours) => setOverrides(writeHourOverride(cityId, hours))}
                />
              </CardContent>
            </Card>
            <CompareTable
              lang={lang}
              cities={selectedCities}
              overrides={overrides}
              unit={unit}
              onUnit={setUnit}
            />
            <Card>
              <CardContent>
                <Ranking
                  lang={lang}
                  target={target}
                  onTarget={setTarget}
                  scope={scope}
                  onScope={setScope}
                  pool={pool}
                  lines={lines}
                  customEmpty={target === "basket:custom" && lines.length === 0}
                  overrides={overrides}
                  items={catalog.map((entry) => entry.item)}
                />
              </CardContent>
            </Card>
            <BasketEditor
              lang={lang}
              groups={groups}
              custom={custom}
              onToggle={(item, checked) =>
                setCustom((current) => ({
                  ...current,
                  [item]: { checked, quantity: current[item]?.quantity ?? "1" },
                }))
              }
              onQuantity={(item, quantity) =>
                setCustom((current) => ({
                  ...current,
                  [item]: { checked: current[item]?.checked ?? false, quantity },
                }))
              }
            />
          </>
        )}
      </main>

      <footer className="border-t border-border/80 px-4 py-6 text-sm text-muted-foreground md:px-6">
        <div className="mx-auto max-w-6xl">
          {!loaded
            ? t(lang, "loading")
            : loaded.origin === "prices.json"
              ? t(lang, "footerLive")
              : formatMessage(t(lang, "footerMock"), {
                  reason: loaded.reason
                    ? loadReasonMessage(lang, loaded.reason, loaded.detail)
                    : t(lang, "loading"),
                })}
        </div>
      </footer>
    </div>
  )
}
