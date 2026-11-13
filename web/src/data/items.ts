export const ITEMS = {
  coffee: "Cappuccino",
  rentOutside: "1 Bedroom Apartment Outside Centre",
  rentCentre: "1 Bedroom Apartment in City Centre",
  utilities: "Basic Utilities",
  internet: "Internet",
  transit: "Monthly Public Transport Pass",
  school: "International School, Yearly",
} as const

export const BASKETS = [
  {
    id: "rent-outside",
    lines: [{ item: ITEMS.rentOutside, quantity: 1 }],
  },
  {
    id: "rent-centre",
    lines: [{ item: ITEMS.rentCentre, quantity: 1 }],
  },
  {
    id: "monthly-living",
    lines: [
      { item: ITEMS.rentOutside, quantity: 1 },
      { item: ITEMS.utilities, quantity: 1 },
      { item: ITEMS.internet, quantity: 1 },
      { item: ITEMS.transit, quantity: 1 },
    ],
  },
] as const

export type BasketId = (typeof BASKETS)[number]["id"]
