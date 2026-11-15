/**
 * Exact Numbeo item names. The Worker parses Numbeo's HTML with these strings,
 * so they must not be translated here.
 */
export const ITEMS = {
  coffee: "Cappuccino (Regular Size)",
  rentOutside: "1 Bedroom Apartment Outside of City Centre",
  rentCentre: "1 Bedroom Apartment in City Centre",
  utilities: "Basic Utilities for 85 m2 Apartment (Electricity, Heating, Cooling, Water, Garbage)",
  internet: "Broadband Internet (Unlimited Data, 60 Mbps or Higher)",
  transit: "Monthly Public Transport Pass (Regular Price)",
  school: "International Primary School, Annual Tuition per Child",
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
