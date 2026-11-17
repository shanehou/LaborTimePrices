/**
 * Exact Numbeo item names. The Worker parses Numbeo's HTML with these strings,
 * so they must not be translated here.
 *
 * NUMBEO_ITEMS is the metric English wording of the current cost-of-living
 * page, in the order Numbeo lists the rows. It is the source of truth for the
 * Chinese labels in i18n/zh.ts. When a city payload contains both the metric
 * and imperial names, the metric row is kept. When it contains only one,
 * English shows that original name and price, and Chinese uses the metric
 * label (scaling mass, distance and area prices). See data/measure.ts.
 *
 * Order is the share-link item index. Append new names; do not reorder or
 * insert, or previously copied links will point at the wrong items.
 */
export const NUMBEO_ITEMS = [
  // Restaurants
  "Meal at an Inexpensive Restaurant",
  "Meal for Two at a Mid-Range Restaurant (Three Courses, Without Drinks)",
  "Combo Meal at McDonald's (or Equivalent Fast-Food Meal)",
  "Domestic Draft Beer (0.5 Liter)",
  "Imported Beer (0.33 Liter Bottle)",
  "Cappuccino (Regular Size)",
  "Soft Drink (Coca-Cola or Pepsi, 0.33 Liter Bottle)",
  "Bottled Water (0.33 Liter)",

  // Markets
  "Milk (Regular, 1 Liter)",
  "Fresh White Bread (500 g Loaf)",
  "White Rice (1 kg)",
  "Eggs (12, Large Size)",
  "Local Cheese (1 kg)",
  "Chicken Fillets (1 kg)",
  "Beef Round or Equivalent Back Leg Red Meat (1 kg)",
  "Apples (1 kg)",
  "Bananas (1 kg)",
  "Oranges (1 kg)",
  "Tomatoes (1 kg)",
  "Potatoes (1 kg)",
  "Onions (1 kg)",
  "Lettuce (1 Head)",
  "Bottled Water (1.5 Liter)",
  "Bottle of Wine (Mid-Range)",
  "Domestic Beer (0.5 Liter Bottle)",
  "Cigarettes (Pack of 20, Marlboro)",

  // Transportation
  "One-Way Ticket (Local Transport)",
  "Monthly Public Transport Pass (Regular Price)",
  "Taxi Start (Standard Tariff)",
  "Taxi 1 km (Standard Tariff)",
  "Taxi 1 Hour Waiting (Standard Tariff)",
  "Gasoline (1 Liter)",
  "Volkswagen Golf 1.5 (or Equivalent New Compact Car)",
  "Toyota Corolla Sedan 1.6 (or Equivalent New Mid-Size Car)",

  // Utilities (Monthly)
  "Basic Utilities for 85 m2 Apartment (Electricity, Heating, Cooling, Water, Garbage)",
  "Mobile Phone Plan (Monthly, with Calls and 10GB+ Data)",
  "Broadband Internet (Unlimited Data, 60 Mbps or Higher)",

  // Sports And Leisure
  "Monthly Fitness Club Membership",
  "Tennis Court Rental (1 Hour, Weekend)",
  "Swimming Pool (Indoor, Adult Admission, Single Visit)",
  "Cinema Ticket (International Release)",
  "Netflix Premium or Equivalent (4K Video Streaming, Ad-Free, Monthly)",

  // Childcare
  "Private Full-Day Preschool or Kindergarten, Monthly Fee per Child",
  "International Primary School, Annual Tuition per Child",

  // Clothing And Shoes
  "Jeans (Levi's 501 or Similar)",
  "Summer Dress in a Chain Store (e.g. Zara or H&M)",
  "Nike Running Shoes (Mid-Range)",
  "Men's Leather Business Shoes",

  // Personal Care and Household Services
  "Men's Haircut (Standard Barbershop)",
  "Women's Haircut (Wash and Basic Cut)",
  "Household Cleaning Service (Per Hour)",

  // Rent Per Month
  "1 Bedroom Apartment in City Centre",
  "1 Bedroom Apartment Outside of City Centre",
  "3 Bedroom Apartment in City Centre",
  "3 Bedroom Apartment Outside of City Centre",

  // Buy Apartment Price
  "Price per Square Meter to Buy Apartment in City Centre",
  "Price per Square Meter to Buy Apartment Outside of Centre",
] as const

export type NumbeoItem = (typeof NUMBEO_ITEMS)[number]

/** Items the built-in combo and ranking presets refer to. */
export const ITEMS = {
  coffee: "Cappuccino (Regular Size)",
  rentOutside: "1 Bedroom Apartment Outside of City Centre",
  rentCentre: "1 Bedroom Apartment in City Centre",
  utilities: "Basic Utilities for 85 m2 Apartment (Electricity, Heating, Cooling, Water, Garbage)",
  internet: "Broadband Internet (Unlimited Data, 60 Mbps or Higher)",
  transit: "Monthly Public Transport Pass (Regular Price)",
  school: "International Primary School, Annual Tuition per Child",
} as const satisfies Record<string, NumbeoItem>

export const BASKETS = [
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
