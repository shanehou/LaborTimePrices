import { useState } from "react"
import { ChevronsUpDownIcon, XIcon } from "lucide-react"
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
import { formatMessage, labelCountry, t, type Lang } from "@/i18n"
import { cityMatches } from "@/lib/search"
import type { CityRecord } from "@/lib/types"

type CitySelectProps = {
  lang: Lang
  cities: CityRecord[]
  selectedIds: string[]
  onToggle: (cityId: string) => void
}

export function CitySelect({ lang, cities, selectedIds, onToggle }: CitySelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const selected = cities.filter((city) => selectedIds.includes(city.id))
  const visible = cities.filter((city) => cityMatches(city, query, lang))

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
            if (!next) setQuery("")
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
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>{t(lang, "cityEmpty")}</CommandEmpty>
              <CommandGroup>
                {visible.map((city) => {
                  const country = labelCountry(lang, city.country)
                  const isSelected = selectedIds.includes(city.id)
                  return (
                    <CommandItem
                      key={city.id}
                      value={`${city.name} ${country}`}
                      data-checked={isSelected ? true : undefined}
                      onSelect={() => onToggle(city.id)}
                    >
                      <span className="font-medium">{city.name}</span>
                      <span className="text-muted-foreground">{country}</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {selected.map((city) => (
            <li key={city.id}>
              <Badge variant="secondary" className="h-7 gap-1 pr-1">
                {city.name}
                <button
                  type="button"
                  className="rounded-full p-0.5 hover:bg-background"
                  aria-label={formatMessage(t(lang, "removeCity"), { city: city.name })}
                  onClick={() => onToggle(city.id)}
                >
                  <XIcon />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
