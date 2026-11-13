import { ITEMS } from "./items"
import type { PriceDataset } from "../lib/types"

export const mockPrices: PriceDataset = {
  cities: [
    {
      id: "shanghai",
      name: "Shanghai",
      country: "China",
      monthly_net_salary: 1850,
      prices: [
        { category: "Restaurants", item: ITEMS.coffee, price_usd: 3.8 },
        { category: "Housing", item: ITEMS.rentOutside, price_usd: 850 },
        { category: "Housing", item: ITEMS.rentCentre, price_usd: 1600 },
        { category: "Utilities", item: ITEMS.utilities, price_usd: 70 },
        { category: "Utilities", item: ITEMS.internet, price_usd: 15 },
        { category: "Transport", item: ITEMS.transit, price_usd: 28 },
        { category: "Education", item: ITEMS.school, price_usd: 32000 },
      ],
    },
    {
      id: "lisbon",
      name: "Lisbon",
      country: "Portugal",
      monthly_net_salary: 1450,
      prices: [
        { category: "Restaurants", item: ITEMS.coffee, price_usd: 1.9 },
        { category: "Housing", item: ITEMS.rentOutside, price_usd: 1000 },
        { category: "Housing", item: ITEMS.rentCentre, price_usd: 1400 },
        { category: "Utilities", item: ITEMS.utilities, price_usd: 130 },
        { category: "Utilities", item: ITEMS.internet, price_usd: 35 },
        { category: "Transport", item: ITEMS.transit, price_usd: 40 },
        { category: "Education", item: ITEMS.school, price_usd: 14000 },
      ],
    },
    {
      id: "zurich",
      name: "Zurich",
      country: "Switzerland",
      monthly_net_salary: 6400,
      monthly_work_hours: 162,
      prices: [
        { category: "Restaurants", item: ITEMS.coffee, price_usd: 6.4 },
        { category: "Housing", item: ITEMS.rentOutside, price_usd: 2300 },
        { category: "Housing", item: ITEMS.rentCentre, price_usd: 3100 },
        { category: "Utilities", item: ITEMS.utilities, price_usd: 260 },
        { category: "Utilities", item: ITEMS.internet, price_usd: 55 },
        { category: "Transport", item: ITEMS.transit, price_usd: 87 },
        { category: "Education", item: ITEMS.school, price_usd: 28000 },
      ],
    },
    {
      id: "new-york",
      name: "New York",
      country: "United States",
      monthly_net_salary: 4900,
      prices: [
        { category: "Restaurants", item: ITEMS.coffee, price_usd: 5.5 },
        { category: "Housing", item: ITEMS.rentOutside, price_usd: 2800 },
        { category: "Housing", item: ITEMS.rentCentre, price_usd: 4200 },
        { category: "Utilities", item: ITEMS.utilities, price_usd: 190 },
        { category: "Utilities", item: ITEMS.internet, price_usd: 70 },
        { category: "Transport", item: ITEMS.transit, price_usd: 132 },
        { category: "Education", item: ITEMS.school, price_usd: 45000 },
      ],
    },
  ],
}
