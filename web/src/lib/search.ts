import { labelCountry, type Lang } from "../i18n"

export function cityMatches(
  city: { name: string; country: string },
  query: string,
  lang: Lang,
): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return (
    city.name.toLowerCase().includes(needle) ||
    labelCountry(lang, city.country).toLowerCase().includes(needle)
  )
}
