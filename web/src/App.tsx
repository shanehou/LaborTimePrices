import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CitySelect } from "@/components/CitySelect"
import { ComboPanel, CUSTOM_TARGET, PRESET_TARGET } from "@/components/ComboPanel"
import { CompareTable, type PriceUnit } from "@/components/CompareTable"
import { HoursEditor } from "@/components/HoursEditor"
import { Ranking } from "@/components/Ranking"
import { ShareDialog } from "@/components/ShareDialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { BASKETS, ITEMS } from "@/data/items"
import { apiErrorMessage, formatMessage, t, type Lang } from "@/i18n"
import { ApiError, fetchCatalog, fetchCity, type ApiErrorCode } from "@/lib/api"
import { buildComboCsv, buildItemsCsv, comboFilename, itemsFilename } from "@/lib/exportCsv"
import { formatDate } from "@/lib/format"
import { groupCatalog, listCatalog } from "@/lib/labor"
import { emptyUsage, type Horizon, type PeriodContext, type Usage } from "@/lib/period"
import { linesForTarget, type CustomBasket } from "@/lib/rankTarget"
import { moveItem } from "@/lib/reorder"
import { buildShareCard } from "@/lib/shareCard"
import { decodeShare, encodeShare } from "@/lib/share"
import { readHourOverrides, readPeriod, writeHourOverride, writeLang, writePeriod } from "@/lib/storage"
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

function ViewTab({
  selected,
  title,
  hint,
  onSelect,
}: {
  selected: boolean
  title: string
  hint: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={`rounded-lg px-3 py-3 text-left ${
        selected ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-background/70"
      }`}
    >
      <span className="block text-sm font-medium md:text-base">{title}</span>
      <span
        className={`mt-1 block text-xs leading-snug ${
          selected ? "text-primary-foreground/80" : "text-muted-foreground"
        }`}
      >
        {hint}
      </span>
    </button>
  )
}

function readOpenedShare() {
  if (typeof window === "undefined") return null
  return decodeShare(window.location.hash)
}

export default function App({ startupLang }: { startupLang: Lang }) {
  const [openedShare] = useState(readOpenedShare)
  const [lang, setLang] = useState<Lang>(openedShare?.lang ?? startupLang)
  const [cityCatalog, setCityCatalog] = useState<CatalogCity[] | null>(null)
  const [catalogError, setCatalogError] = useState<ApiErrorCode | null>(null)
  const [catalogAttempt, setCatalogAttempt] = useState(0)
  const [selected, setSelected] = useState<CatalogCity[]>(() =>
    (openedShare?.cities ?? []).map((city) => ({ id: city.id, name: city.name, country: "" })),
  )
  const [cityStates, setCityStates] = useState<Record<string, CityLoadState>>(() => {
    if (!openedShare) return {}
    return Object.fromEntries(
      openedShare.cities.map((city) => [city.id, { status: "loading" as const }]),
    )
  })
  const [overrides, setOverrides] = useState(() => {
    const base = readHourOverrides()
    if (!openedShare) return base
    let next = base
    for (const [cityId, hours] of Object.entries(openedShare.hours)) {
      next = writeHourOverride(cityId, hours)
    }
    return next
  })
  const [unit, setUnit] = useState<PriceUnit>(openedShare?.unit ?? "hours")
  const [tab, setTab] = useState<"items" | "combos">(openedShare?.tab ?? "items")
  const [horizon, setHorizon] = useState<Horizon>(
    openedShare?.horizon ?? readPeriod().horizon,
  )
  const [usage, setUsage] = useState<Usage>(openedShare ? openedShare.usage : readPeriod().usage)
  const [itemTarget, setItemTarget] = useState(openedShare?.itemTarget ?? `item:${ITEMS.coffee}`)
  const [comboTarget, setComboTarget] = useState<string>(openedShare?.comboTarget ?? PRESET_TARGET)
  const [custom, setCustom] = useState<CustomBasket>(openedShare?.custom ?? {})
  const [customName, setCustomName] = useState(openedShare?.customName ?? "")
  const [shareOpen, setShareOpen] = useState(false)
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
    writePeriod({ horizon, usage })
  }, [horizon, usage])

  useEffect(() => {
    const inflight = controllers.current
    return () => {
      for (const controller of inflight.values()) controller.abort()
      inflight.clear()
    }
  }, [])

  const requestCity = useCallback((city: CatalogCity) => {
    controllers.current.get(city.id)?.abort()
    const controller = new AbortController()
    controllers.current.set(city.id, controller)
    fetchCity(city.id, controller.signal)
      .then((record) => {
        if (!controller.signal.aborted) {
          setCityStates((current) => ({
            ...current,
            [city.id]: { status: "ready", city: record },
          }))
          setSelected((current) =>
            current.map((entry) =>
              entry.id === record.id
                ? { id: record.id, name: record.name, country: record.country }
                : entry,
            ),
          )
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

  const loadCity = useCallback(
    (city: CatalogCity) => {
      setCityStates((current) => ({ ...current, [city.id]: { status: "loading" } }))
      requestCity(city)
    },
    [requestCity],
  )

  useEffect(() => {
    if (!openedShare) return
    if (openedShare.lang) writeLang(openedShare.lang)
    for (const city of openedShare.cities) {
      requestCity({ id: city.id, name: city.name, country: "" })
    }
  }, [openedShare, requestCity])

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

  const visibleCities = useMemo(() => {
    if (!cityCatalog) return selected
    return selected.map((city) => cityCatalog.find((entry) => entry.id === city.id) ?? city)
  }, [selected, cityCatalog])

  const readyCities = useMemo(() => {
    const cities: CityRecord[] = []
    for (const city of visibleCities) {
      const state = cityStates[city.id]
      if (state && state.status === "ready") cities.push(state.city)
    }
    return cities
  }, [visibleCities, cityStates])

  const statuses = useMemo(() => {
    const next: Record<string, CityLoadStatus> = {}
    for (const [cityId, state] of Object.entries(cityStates)) {
      next[cityId] = state.status
    }
    return next
  }, [cityStates])

  const pending = useMemo(() => {
    const rows: PendingCity[] = []
    for (const city of visibleCities) {
      const state = cityStates[city.id]
      if (!state || state.status === "ready") continue
      rows.push({ city, state })
    }
    return rows
  }, [visibleCities, cityStates])

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
  const itemPeriod: PeriodContext = { horizon: "listed", mode: "single", usage: emptyUsage() }
  const activeLines = tab === "items" ? itemLines : comboLines
  const shareHorizon = tab === "items" ? "listed" : horizon

  const shareHash = useMemo(
    () =>
      encodeShare({
        cities: visibleCities.map((city) => ({ id: city.id, name: city.name })),
        hours: overrides,
        lang,
        tab,
        unit,
        horizon,
        itemTarget: effectiveItemTarget,
        comboTarget,
        custom,
        customName,
        usage,
      }),
    [
      visibleCities,
      overrides,
      lang,
      tab,
      unit,
      horizon,
      effectiveItemTarget,
      comboTarget,
      custom,
      customName,
      usage,
    ],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = `#${shareHash}`
      if (window.location.hash === next) return
      window.history.replaceState(null, "", next)
    }, 400)
    return () => window.clearTimeout(timer)
  }, [shareHash])

  const shareModel = useMemo(
    () =>
      buildShareCard({
        lang,
        tab,
        horizon: shareHorizon,
        cities: readyCities,
        overrides,
        comboTarget,
        customName,
        lines: activeLines,
        usage,
      }),
    [lang, tab, shareHorizon, readyCities, overrides, comboTarget, customName, activeLines, usage],
  )

  const shareCsv = useMemo(
    () =>
      tab === "items"
        ? buildItemsCsv({
            lang,
            cities: readyCities,
            items,
            overrides,
            horizon: "listed",
            usage: emptyUsage(),
          })
        : buildComboCsv({
            lang,
            cities: readyCities,
            lines: comboLines,
            overrides,
            horizon,
            usage,
          }),
    [tab, lang, readyCities, items, comboLines, overrides, horizon, usage],
  )

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
                  selected={visibleCities}
                  statuses={statuses}
                  onAdd={addCity}
                  onRemove={removeCity}
                  onReorder={reorderCity}
                />
                {visibleCities.length === 0 ? (
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
            <section
              className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10"
              data-view={tab}
            >
              <div className="flex flex-col gap-3 border-b border-border bg-secondary/60 p-3 md:flex-row md:items-stretch">
                <div
                  role="tablist"
                  aria-label={t(lang, "viewLabel")}
                  className="grid flex-1 grid-cols-2 gap-1"
                >
                  <ViewTab
                    selected={tab === "items"}
                    title={t(lang, "tabItems")}
                    hint={t(lang, "tabItemsHint")}
                    onSelect={() => setTab("items")}
                  />
                  <ViewTab
                    selected={tab === "combos"}
                    title={t(lang, "tabCombos")}
                    hint={t(lang, "tabCombosHint")}
                    onSelect={() => setTab("combos")}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="bg-card md:self-center"
                  onClick={() => setShareOpen(true)}
                >
                  {t(lang, "share")}
                </Button>
              </div>
              <div role="tabpanel" className="flex flex-col gap-8 p-4 md:p-6">
                {tab === "items" ? (
                  <>
                    <CompareTable
                      lang={lang}
                      cities={readyCities}
                      overrides={overrides}
                      unit={unit}
                      onUnit={setUnit}
                    />
                    <Ranking
                      lang={lang}
                      target={effectiveItemTarget}
                      onTarget={setItemTarget}
                      cities={readyCities}
                      lines={itemLines}
                      customEmpty={false}
                      overrides={overrides}
                      period={itemPeriod}
                      items={items}
                    />
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
                    customName={customName}
                    onCustomName={setCustomName}
                    horizon={horizon}
                    onHorizon={setHorizon}
                    usage={usage}
                    onUsage={setUsage}
                    onToggle={(item, checked) =>
                      setCustom((current) => {
                        const existing = current[item]?.quantity
                        const quantity = existing !== undefined && existing.trim() !== "" ? existing : "1"
                        return {
                          ...current,
                          [item]: { checked, quantity },
                        }
                      })
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
              </div>
            </section>
            <ShareDialog
              lang={lang}
              open={shareOpen}
              onOpenChange={setShareOpen}
              model={shareModel}
              csv={shareCsv}
              filename={tab === "items" ? itemsFilename(horizon) : comboFilename(horizon)}
              shareHash={shareHash}
            />
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
