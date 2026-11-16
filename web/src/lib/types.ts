export type CityPrice = {
  category: string
  item: string
  price_usd: number
}

export type CatalogCity = {
  id: string
  name: string
  country: string
}

export type CityRecord = CatalogCity & {
  monthly_net_salary: number | null
  monthly_work_hours?: number
  prices: CityPrice[]
  scraped_at?: string
  source_url?: string
}

export type CityLoadStatus = "loading" | "ready" | "error"

export type BasketLine = {
  item: string
  quantity: number
}

export type HoursSource = "visitor" | "city" | "default"

export type ExclusionCode =
  | "missing_salary"
  | "non_positive_salary"
  | "non_positive_hours"
  | "missing_item"
  | "non_positive_price"
  | "non_positive_quantity"
  | "needs_times"
  | "needs_years"
  | "needs_area"

export type Exclusion = {
  code: ExclusionCode
  item?: string
}
