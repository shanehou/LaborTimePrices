import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CitySelect } from "@/components/CitySelect"
import { ComboPanel, CUSTOM_TARGET, PRESET_TARGET } from "@/components/ComboPanel"
import { CompareTable, type PriceUnit } from "@/components/CompareTable"
import { HoursEditor } from "@/components/HoursEditor"
import { Ranking } from "@/components/Ranking"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { BASKETS, ITEMS } from "@/data/items"
import { apiErrorMessage, formatMessage, t, type Lang } from "@/i18n"
import { ApiError, fetchCatalog, fetchCity, type ApiErrorCode } from "@/lib/api"
import { formatDate } from "@/lib/format"
import { groupCatalog, listCatalog } from "@/lib/labor"
import { linesForTarget, type CustomBasket } from "@/lib/rankTarget"
import { moveItem } from "@/lib/reorder"
import { readHourOverrides, writeHourOverride, writeLang } from "@/lib/storage"
import type { CatalogCity, CityRecord, CityLoadStatus } from "@/lib/types"

const activeLangClass =
  "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"

type CityLoadState =
  | { status: "loading" }
  | { status: "ready"; city: CityRecord }
  | { status: "error"; code: ApiErrorCode }

type PendingCity = {
  city: CatalogCity
  state: { status: "loading" } | { status: "error"; code: ApiErrorCode }
}

function errorCode(error: unknown): ApiErrorCode {
  return error instanceof ApiError ? error.code : "network"
}

export default function App({ startupLang }: { startupLang: Lang }) {
  const [lang, setLang] = useState<Lang>(startupLang)
  const [cityCatalog, setCityCatalog] = useState<CatalogCity[] | null>(null)
  const [catalogError, setCatalogError] = useState<ApiErrorCode | null>(null)
  const [catalogAttempt, setCatalogAttempt] = useState(0)
  const [selected, setSelected] = useState<CatalogCity[]>([])
  const [cityStates, setCityStates] = useState<Record<string, CityLoadState>>({})
  const [overrides, setOverrides] = useState(readHourOverrides)
  const [unit, setUnit] = useState<PriceUnit>("hours")
  const [tab, setTab] = useState<"items" | "combos">("items")
  const [itemTarget, setItemTarget] = useState(`item:${ITEMS.coffee}`)
  const [comboTarget, setComboTarget] = useState<string>(PRESET_TARGET)
  const [custom, setCustom] = useState<CustomBasket>({})
  const controllers = useRef(new Map<string, AbortController>())

  useEffect(() => {
    const controller = new AbortController()
    fetchCatalog(controller.signal)
      .then((cities) => {
        if (!controller.signal.aborted) setCityCatalog(cities)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setCatalogError(errorCode(error))
      })
    return () => controller.abort()
  }, [catalogAttempt])

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-Hans" : "en"
    document.title = t(lang, "docTitle")
  }, [lang])

  useEffect(() => {
    const inflight = controllers.current
    return () => {
      for (const controller of inflight.values()) controller.abort()
      inflight.clear()
    }
  }, [])

  const loadCity = useCallback((city: CatalogCity) => {
    controllers.current.get(city.id)?.abort()
    const controller = new AbortController()
    controllers.current.set(city.id, controller)
    setCityStates((current) => ({ ...current, [city.id]: { status: "loading" } }))
    fetchCity(city.id, controller.signal)
      .then((record) => {
        if (!controller.signal.aborted) {
          setCityStates((current) => ({
            ...current,
            [city.id]: { status: "ready", city: record },
          }))
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setCityStates((current) => ({
          ...current,
          [city.id]: { status: "error", code: errorCode(error) },
        }))
      })
      .finally(() => {
        if (controllers.current.get(city.id) === controller) {
          controllers.current.delete(city.id)
        }
      })
  }, [])

  function addCity(city: CatalogCity) {
    setSelected((current) =>
      current.some((entry) => entry.id === city.id) ? current : [...current, city],
    )
    loadCity(city)
  }

  function removeCity(cityId: string) {
    controllers.current.get(cityId)?.abort()
    controllers.current.delete(cityId)
    setSelected((current) => current.filter((city) => city.id !== cityId))
    setCityStates((current) => {
      if (!(cityId in current)) return current
      const next = { ...current }
      delete next[cityId]
      return next
    })
  }

  function reorderCity(from: number, to: number) {
    setSelected((current) => moveItem(current, from, to))
  }

  const readyCities = useMemo(() => {
    const cities: CityRecord[] = []
    for (const city of selected) {
      const state = cityStates[city.id]
      if (state && state.status === "ready") cities.push(state.city)
    }
    return cities
  }, [selected, cityStates])

  const statuses = useMemo(() => {
    const next: Record<string, CityLoadStatus> = {}
    for (const [cityId, state] of Object.entries(cityStates)) {
      next[cityId] = state.status
    }
    return next
  }, [cityStates])

  const pending = useMemo(() => {
    const rows: PendingCity[] = []
    for (const city of selected) {
      const state = cityStates[city.id]
      if (!state || state.status === "ready") continue
      rows.push({ city, state })
    }
    return rows
  }, [selected, cityStates])

  const catalogEntries = useMemo(() => listCatalog(readyCities), [readyCities])
  const groups = useMemo(() => groupCatalog(catalogEntries), [catalogEntries])
  const items = useMemo(() => catalogEntries.map((entry) => entry.item), [catalogEntries])

  const effectiveItemTarget = useMemo(() => {
    if (items.length === 0 || !itemTarget.startsWith("item:")) return itemTarget
    const item = itemTarget.slice("item:".length)
    return items.includes(item) ? itemTarget : `item:${items[0]}`
  }, [items, itemTarget])

  const latestScrapedAt = useMemo(() => {
    let latest: string | null = null
    let latestTime = Number.NEGATIVE_INFINITY
    for (const city of readyCities) {
      if (!city.scraped_at) continue
      const time = Date.parse(city.scraped_at)
      if (Number.isFinite(time) && time > latestTime) {
        latestTime = time
        latest = city.scraped_at
      }
    }
    return latest
  }, [readyCities])

  const itemLines = linesForTarget(effectiveItemTarget, custom)
  const comboLines = linesForTarget(comboTarget, custom)

  function editFromPreset() {
    setCustom(
      Object.fromEntries(
        BASKETS[0].lines.map((line) => [
          line.item,
          { checked: true, quantity: String(line.quantity) },
        ]),
      ),
    )
    setComboTarget(CUSTOM_TARGET)
  }

  function retryCatalog() {
    setCityCatalog(null)
    setCatalogError(null)
    setCatalogAttempt((attempt) => attempt + 1)
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
            <p className="text-xs tracking-[0.22em] uppercase opacity-75">
              {t(lang, "brandKicker")}
            </p>
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
        {cityCatalog === null ? (
          catalogError === null ? (
            <p className="text-sm text-muted-foreground">{t(lang, "catalogLoading")}</p>
          ) : (
            <Card>
              <CardContent className="flex flex-wrap items-center gap-3">
                <p className="text-sm font-medium">{t(lang, "catalogFailed")}</p>
                <p className="text-sm text-muted-foreground">
                  {apiErrorMessage(lang, catalogError)}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={retryCatalog}
                >
                  {t(lang, "catalogRetry")}
                </Button>
              </CardContent>
            </Card>
          )
        ) : (
          <>
            <Card>
              <CardContent className="flex flex-col gap-6">
                <CitySelect
                  lang={lang}
                  catalog={cityCatalog}
                  selected={selected}
                  statuses={statuses}
                  onAdd={addCity}
                  onRemove={removeCity}
                  onReorder={reorderCity}
                />
                {selected.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t(lang, "emptySelectionHint")}
                  </p>
                ) : pending.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {pending.map(({ city, state }) =>
                      state.status === "loading" ? (
                        <p key={city.id} className="text-sm text-muted-foreground">
                          {formatMessage(t(lang, "cityLoading"), { city: city.name })}
                        </p>
                      ) : (
                        <div
                          key={city.id}
                          className="flex flex-wrap items-center gap-2 text-sm"
                        >
                          <span>{formatMessage(t(lang, "cityFailed"), { city: city.name })}</span>
                          <span className="text-muted-foreground">
                            {apiErrorMessage(lang, state.code)}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => loadCity(city)}
                          >
                            {t(lang, "retry")}
                          </Button>
                        </div>
                      ),
                    )}
                  </div>
                ) : null}
                <HoursEditor
                  lang={lang}
                  cities={readyCities}
                  overrides={overrides}
                  onChange={(cityId, hours) =>
                    setOverrides(writeHourOverride(cityId, hours))
                  }
                />
              </CardContent>
            </Card>
            <ToggleGroup
              type="single"
              variant="outline"
              value={tab}
              aria-label={t(lang, "viewLabel")}
              onValueChange={(value) => {
                if (value === "items" || value === "combos") setTab(value)
              }}
              className="self-start"
            >
              <ToggleGroupItem value="items" className={activeLangClass}>
                {t(lang, "tabItems")}
              </ToggleGroupItem>
              <ToggleGroupItem value="combos" className={activeLangClass}>
                {t(lang, "tabCombos")}
              </ToggleGroupItem>
            </ToggleGroup>
            {tab === "items" ? (
              <>
                <CompareTable
                  lang={lang}
                  cities={readyCities}
                  overrides={overrides}
                  unit={unit}
                  onUnit={setUnit}
                />
                <Card>
                  <CardContent>
                    <Ranking
                      lang={lang}
                      target={effectiveItemTarget}
                      onTarget={setItemTarget}
                      cities={readyCities}
                      lines={itemLines}
                      customEmpty={false}
                      overrides={overrides}
                      items={items}
                    />
                  </CardContent>
                </Card>
              </>
            ) : (
              <ComboPanel
                lang={lang}
                cities={readyCities}
                overrides={overrides}
                target={comboTarget}
                onTarget={setComboTarget}
                lines={comboLines}
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
                onEditFromPreset={editFromPreset}
                groups={groups}
              />
            )}
          </>
        )}
      </main>

      <footer className="border-t border-border/80 px-4 py-6 text-sm text-muted-foreground md:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-2">
          <p>
            <a
              href="https://www.numbeo.com/cost-of-living/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-foreground"
            >
              {t(lang, "footerNumbeoLink")}
            </a>
          </p>
          <p>{t(lang, "footerOnDemand")}</p>
          {latestScrapedAt && (
            <p>
              {formatMessage(t(lang, "footerScraped"), {
                date: formatDate(lang, latestScrapedAt),
              })}
            </p>
          )}
          <p>{t(lang, "footerDisclaimer")}</p>
        </div>
      </footer>
    </div>
  )
}
