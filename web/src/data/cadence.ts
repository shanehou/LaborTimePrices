import type { NumbeoItem } from "./items"

/**
 * How a Numbeo line is billed. Share links store item indexes from NUMBEO_ITEMS,
 * so this map must cover every name there. New items belong at the end of that
 * list; reordering it changes old links.
 */
export type Cadence = "monthly" | "yearly" | "unit" | "asset" | "assetArea"

export const ITEM_CADENCE = {
  "Meal at an Inexpensive Restaurant": "unit",
  "Meal for Two at a Mid-Range Restaurant (Three Courses, Without Drinks)": "unit",
  "Combo Meal at McDonald's (or Equivalent Fast-Food Meal)": "unit",
  "Domestic Draft Beer (0.5 Liter)": "unit",
  "Imported Beer (0.33 Liter Bottle)": "unit",
  "Cappuccino (Regular Size)": "unit",
  "Soft Drink (Coca-Cola or Pepsi, 0.33 Liter Bottle)": "unit",
  "Bottled Water (0.33 Liter)": "unit",

  "Milk (Regular, 1 Liter)": "unit",
  "Fresh White Bread (500 g Loaf)": "unit",
  "White Rice (1 kg)": "unit",
  "Eggs (12, Large Size)": "unit",
  "Local Cheese (1 kg)": "unit",
  "Chicken Fillets (1 kg)": "unit",
  "Beef Round or Equivalent Back Leg Red Meat (1 kg)": "unit",
  "Apples (1 kg)": "unit",
  "Bananas (1 kg)": "unit",
  "Oranges (1 kg)": "unit",
  "Tomatoes (1 kg)": "unit",
  "Potatoes (1 kg)": "unit",
  "Onions (1 kg)": "unit",
  "Lettuce (1 Head)": "unit",
  "Bottled Water (1.5 Liter)": "unit",
  "Bottle of Wine (Mid-Range)": "unit",
  "Domestic Beer (0.5 Liter Bottle)": "unit",
  "Cigarettes (Pack of 20, Marlboro)": "unit",

  "One-Way Ticket (Local Transport)": "unit",
  "Monthly Public Transport Pass (Regular Price)": "monthly",
  "Taxi Start (Standard Tariff)": "unit",
  "Taxi 1 km (Standard Tariff)": "unit",
  "Taxi 1 Hour Waiting (Standard Tariff)": "unit",
  "Gasoline (1 Liter)": "unit",
  "Volkswagen Golf 1.5 (or Equivalent New Compact Car)": "asset",
  "Toyota Corolla Sedan 1.6 (or Equivalent New Mid-Size Car)": "asset",

  "Basic Utilities for 85 m2 Apartment (Electricity, Heating, Cooling, Water, Garbage)":
    "monthly",
  "Mobile Phone Plan (Monthly, with Calls and 10GB+ Data)": "monthly",
  "Broadband Internet (Unlimited Data, 60 Mbps or Higher)": "monthly",

  "Monthly Fitness Club Membership": "monthly",
  "Tennis Court Rental (1 Hour, Weekend)": "unit",
  "Swimming Pool (Indoor, Adult Admission, Single Visit)": "unit",
  "Cinema Ticket (International Release)": "unit",
  "Netflix Premium or Equivalent (4K Video Streaming, Ad-Free, Monthly)": "monthly",

  "Private Full-Day Preschool or Kindergarten, Monthly Fee per Child": "monthly",
  "International Primary School, Annual Tuition per Child": "yearly",

  "Jeans (Levi's 501 or Similar)": "unit",
  "Summer Dress in a Chain Store (e.g. Zara or H&M)": "unit",
  "Nike Running Shoes (Mid-Range)": "unit",
  "Men's Leather Business Shoes": "unit",

  "Men's Haircut (Standard Barbershop)": "unit",
  "Women's Haircut (Wash and Basic Cut)": "unit",
  "Household Cleaning Service (Per Hour)": "unit",

  "1 Bedroom Apartment in City Centre": "monthly",
  "1 Bedroom Apartment Outside of City Centre": "monthly",
  "3 Bedroom Apartment in City Centre": "monthly",
  "3 Bedroom Apartment Outside of City Centre": "monthly",

  "Price per Square Meter to Buy Apartment in City Centre": "assetArea",
  "Price per Square Meter to Buy Apartment Outside of Centre": "assetArea",
} satisfies Record<NumbeoItem, Cadence>

export function cadenceOf(item: string): Cadence {
  if (Object.prototype.hasOwnProperty.call(ITEM_CADENCE, item)) {
    return ITEM_CADENCE[item as NumbeoItem]
  }
  return "unit"
}
