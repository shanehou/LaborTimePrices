import { useEffect, useMemo, useState } from "react"
import {
  ArrowUpToLineIcon,
  ChevronsUpDownIcon,
  CircleAlertIcon,
  GripVerticalIcon,
  LoaderCircleIcon,
  XIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { apiErrorMessage, formatMessage, labelCountry, t, type Lang } from "@/i18n"
import { ApiError, searchCities, type ApiErrorCode } from "@/lib/api"
import { cityMatches } from "@/lib/search"
import type { CatalogCity, CityLoadStatus } from "@/lib/types"

const SEARCH_DEBOUNCE_MS = 400

type RemoteState =
  | { status: "idle" }
  | { status: "done"; term: string; results: CatalogCity[] }
  | { status: "error"; term: string; code: ApiErrorCode }

type RemoteView = "idle" | "pending" | "done" | "error"

type CitySelectProps = {
  lang: Lang
  catalog: CatalogCity[]
  selected: CatalogCity[]
  statuses: Record<string, CityLoadStatus>
  onAdd: (city: CatalogCity) => void
  onRemove: (cityId: string) => void
  onReorder: (from: number, to: number) => void
}

export function CitySelect({
  lang,
  catalog,
  selected,
  statuses,
  onAdd,
  onRemove,
  onReorder,
}: CitySelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [remote, setRemote] = useState<RemoteState>({ status: "idle" })
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const selectedIds = useMemo(() => new Set(selected.map((city) => city.id)), [selected])
  const localMatches = useMemo(
    () =>
      catalog.filter(
        (city) => !selectedIds.has(city.id) && cityMatches(city, query, lang),
      ),
    [catalog, query, lang, selectedIds],
  )
  const term = query.trim()
  const fallback = term !== "" && localMatches.length === 0
  const remoteView: RemoteView = !fallback
    ? "idle"
    : remote.status === "idle" || remote.term !== term
      ? "pending"
      : remote.status === "done"
        ? "done"
        : "error"

  useEffect(() => {
    if (!fallback) return
    const controller = new AbortController()
    const searchTerm = query.trim()
    const timer = setTimeout(() => {
      searchCities(searchTerm, controller.signal)
        .then((results) => {
          if (!controller.signal.aborted) {
            setRemote({ status: "done", term: searchTerm, results })
          }
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return
          setRemote({
            status: "error",
            term: searchTerm,
            code: error instanceof ApiError ? error.code : "network",
          })
        })
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [fallback, query])

  const networkResults = useMemo(() => {
    if (remote.status !== "done" || remote.term !== term) return []
    const seen = new Set<string>()
    const results: CatalogCity[] = []
    for (const city of remote.results) {
      if (selectedIds.has(city.id) || seen.has(city.id)) continue
      seen.add(city.id)
      results.push(city)
    }
    return results
  }, [remote, term, selectedIds])

  function selectCity(city: CatalogCity) {
    onAdd(city)
  }

  function endDrag() {
    setDraggingIndex(null)
    setDropIndex(null)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-sm font-medium" id="city-select-label">
          {t(lang, "cityLabel")}
        </label>
        <p className="text-sm text-muted-foreground">
          {selected.length === 0
            ? t(lang, "cityNone")
            : formatMessage(t(lang, "cityCount"), { count: selected.length })}
        </p>
      </div>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) {
            setQuery("")
            setRemote({ status: "idle" })
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-labelledby="city-select-label"
            className="h-11 w-full justify-between bg-card px-3"
          >
            <span className="truncate">
              {selected.length === 0
                ? t(lang, "citySearch")
                : selected.map((city) => city.name).join(", ")}
            </span>
            <ChevronsUpDownIcon />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] min-w-72 p-0"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={t(lang, "citySearch")}
              value={query}
              maxLength={64}
              onValueChange={setQuery}
            />
            <CommandList>
              {localMatches.length > 0 && (
                <CommandGroup heading={t(lang, "searchLocalGroup")}>
                  {localMatches.map((city) => {
                    const country = labelCountry(lang, city.country)
                    return (
                      <CommandItem
                        key={city.id}
                        value={`${city.name} ${country}`}
                        onSelect={() => selectCity(city)}
                      >
                        <span className="font-medium">{city.name}</span>
                        <span className="text-muted-foreground">{country}</span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              )}
              {!fallback && localMatches.length === 0 && (
                <CommandEmpty>{t(lang, "cityEmpty")}</CommandEmpty>
              )}
              {fallback && (
                <CommandGroup heading={t(lang, "searchNetworkGroup")}>
                  {remoteView === "pending" && (
                    <div className="px-2 py-3 text-sm text-muted-foreground">
                      {t(lang, "searchLoading")}
                    </div>
                  )}
                  {remoteView === "error" && (
                    <div className="flex flex-col gap-1 px-2 py-3 text-sm text-muted-foreground">
                      <span>{t(lang, "searchFailed")}</span>
                      <span>
                        {apiErrorMessage(
                          lang,
                          remote.status === "error" ? remote.code : "network",
                        )}
                      </span>
                    </div>
                  )}
                  {remoteView === "done" && networkResults.length === 0 && (
                    <div className="px-2 py-3 text-sm text-muted-foreground">
                      {t(lang, "searchEmpty")}
                    </div>
                  )}
                  {remoteView === "done" &&
                    networkResults.map((city) => {
                      const country = labelCountry(lang, city.country)
                      return (
                        <CommandItem
                          key={city.id}
                          value={`${city.name} ${country}`}
                          onSelect={() => selectCity(city)}
                        >
                          <span className="font-medium">{city.name}</span>
                          <span className="text-muted-foreground">{country}</span>
                        </CommandItem>
                      )
                    })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <>
          <ul className="flex flex-wrap gap-2">
            {selected.map((city, index) => {
              const status = statuses[city.id]
              const dragging = draggingIndex === index
              const dropTarget =
                dropIndex === index && draggingIndex !== null && draggingIndex !== index
              return (
                <li
                  key={city.id}
                  data-city-chip={city.id}
                  data-index={index}
                  draggable
                  onDragStart={(event) => {
                    setDraggingIndex(index)
                    setDropIndex(index)
                    event.dataTransfer.effectAllowed = "move"
                    event.dataTransfer.setData("text/plain", String(index))
                  }}
                  onDragOver={(event) => {
                    if (draggingIndex === null) return
                    event.preventDefault()
                    event.dataTransfer.dropEffect = "move"
                    if (dropIndex !== index) setDropIndex(index)
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    if (draggingIndex !== null && draggingIndex !== index) {
                      onReorder(draggingIndex, index)
                    }
                    endDrag()
                  }}
                  onDragEnd={endDrag}
                  className={dragging ? "opacity-40" : ""}
                >
                  <Badge
                    variant={status === "error" ? "destructive" : "secondary"}
                    className={`h-7 gap-1 pr-1 ${dropTarget ? "ring-2 ring-primary" : ""}`}
                  >
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={formatMessage(t(lang, "cityDragHandle"), { city: city.name })}
                      title={t(lang, "cityDragHint")}
                      className="cursor-grab rounded p-0.5 hover:bg-background focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                      onKeyDown={(event) => {
                        if (event.key === "ArrowLeft" && index > 0) {
                          event.preventDefault()
                          onReorder(index, index - 1)
                        } else if (event.key === "ArrowRight" && index < selected.length - 1) {
                          event.preventDefault()
                          onReorder(index, index + 1)
                        }
                      }}
                    >
                      <GripVerticalIcon className="size-3" aria-hidden="true" />
                    </span>
                    <span className="font-medium">{city.name}</span>
                    <span className="opacity-70">{labelCountry(lang, city.country)}</span>
                    {status === "loading" && (
                      <LoaderCircleIcon className="size-3 animate-spin" aria-hidden="true" />
                    )}
                    {status === "error" && (
                      <CircleAlertIcon className="size-3" aria-hidden="true" />
                    )}
                    {(status === "loading" || status === "error") && (
                      <span className="sr-only">
                        {status === "loading"
                          ? t(lang, "cityStatusLoading")
                          : t(lang, "cityStatusError")}
                      </span>
                    )}
                    {index > 0 && (
                      <button
                        type="button"
                        className="rounded-full p-0.5 hover:bg-background"
                        aria-label={formatMessage(t(lang, "cityMakeBaseline"), {
                          city: city.name,
                        })}
                        title={formatMessage(t(lang, "cityMakeBaseline"), { city: city.name })}
                        onClick={() => onReorder(index, 0)}
                      >
                        <ArrowUpToLineIcon />
                      </button>
                    )}
                    <button
                      type="button"
                      className="rounded-full p-0.5 hover:bg-background"
                      aria-label={formatMessage(t(lang, "removeCity"), { city: city.name })}
                      onClick={() => onRemove(city.id)}
                    >
                      <XIcon />
                    </button>
                  </Badge>
                </li>
              )
            })}
          </ul>
          {selected.length > 1 && (
            <p className="text-xs text-muted-foreground">{t(lang, "cityDragHint")}</p>
          )}
        </>
      )}
    </div>
  )
}
