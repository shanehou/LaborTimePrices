export type CityPrice = {
  category: string
  item: string
  price_usd: number
}

export type CityRecord = {
  id: string
  name: string
  country: string
  monthly_net_salary: number | null
  monthly_work_hours?: number
  prices: CityPrice[]
}

export type PriceDataset = {
  cities: CityRecord[]
}

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

export type Exclusion = {
  code: ExclusionCode
  item?: string
}
