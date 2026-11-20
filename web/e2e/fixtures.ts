import { expect, type Page } from "@playwright/test"
import type { CityRecord } from "../src/lib/types"

export const ITEMS = {
  coffee: "Cappuccino (Regular Size)",
  rent: "1 Bedroom Apartment Outside of City Centre",
  utilities:
    "Basic Utilities for 85 m2 Apartment (Electricity, Heating, Cooling, Water, Garbage)",
  internet: "Broadband Internet (Unlimited Data, 60 Mbps or Higher)",
  transit: "Monthly Public Transport Pass (Regular Price)",
  school: "International Primary School, Annual Tuition per Child",
  car: "Volkswagen Golf 1.5 (or Equivalent New Compact Car)",
  apartment: "Price per Square Meter to Buy Apartment in City Centre",
}

export const FX = {
  base: "USD" as const,
  date: "2026-11-19",
  rates: {
    CNY: 7.2,
    EUR: 0.9,
    GBP: 0.8,
    JPY: 150,
    HKD: 7.8,
    SGD: 1.3,
    AUD: 1.5,
    CAD: 1.4,
    CHF: 0.9,
    KRW: 1400,
  },
}

function prices(values: {
  coffee: number
  rent: number
  utilities: number
  internet: number
  transit: number
  school: number
  car: number
  apartment: number
}) {
  return [
    { category: "Restaurants", item: ITEMS.coffee, price_usd: values.coffee },
    { category: "Rent Per Month", item: ITEMS.rent, price_usd: values.rent },
    { category: "Utilities (Monthly)", item: ITEMS.utilities, price_usd: values.utilities },
    { category: "Utilities (Monthly)", item: ITEMS.internet, price_usd: values.internet },
    { category: "Transportation", item: ITEMS.transit, price_usd: values.transit },
    { category: "Transportation", item: ITEMS.car, price_usd: values.car },
    { category: "Childcare", item: ITEMS.school, price_usd: values.school },
    { category: "Buy Apartment Price", item: ITEMS.apartment, price_usd: values.apartment },
  ]
}

export const SHANGHAI = {
  id: "1",
  name: "Shanghai",
  country: "China",
  monthly_net_salary: 3000,
  monthly_work_hours: 150,
  mortgage_rate: 3.5,
  scraped_at: "2026-11-19T00:00:00Z",
  source_url: "https://www.numbeo.com/cost-of-living/in/Shanghai",
  prices: prices({
    coffee: 5,
    rent: 900,
    utilities: 100,
    internet: 40,
    transit: 40,
    school: 12000,
    car: 30000,
    apartment: 10000,
  }),
}

export const ZURICH = {
  id: "2",
  name: "Zurich",
  country: "Switzerland",
  monthly_net_salary: 6000,
  monthly_work_hours: 160,
  mortgage_rate: 1.5,
  scraped_at: "2026-11-18T00:00:00Z",
  source_url: "https://www.numbeo.com/cost-of-living/in/Zurich",
  prices: prices({
    coffee: 8,
    rent: 2000,
    utilities: 250,
    internet: 60,
    transit: 90,
    school: 30000,
    car: 45000,
    apartment: 20000,
  }),
}

export const LISBON = {
  id: "3",
  name: "Lisbon",
  country: "Portugal",
  monthly_net_salary: null,
  monthly_work_hours: 160,
  scraped_at: "2026-11-17T00:00:00Z",
  source_url: "https://www.numbeo.com/cost-of-living/in/Lisbon",
  prices: prices({
    coffee: 2,
    rent: 700,
    utilities: 90,
    internet: 35,
    transit: 30,
    school: 9000,
    car: 25000,
    apartment: 7000,
  }),
}

export const CAMBRIDGE = {
  id: "9",
  name: "Cambridge",
  country: "United Kingdom",
  monthly_net_salary: 5000,
  monthly_work_hours: 160,
  scraped_at: "2026-11-16T00:00:00Z",
  source_url: "https://www.numbeo.com/cost-of-living/in/Cambridge",
  prices: prices({
    coffee: 7,
    rent: 1500,
    utilities: 180,
    internet: 50,
    transit: 70,
    school: 24000,
    car: 38000,
    apartment: 15000,
  }),
}

export const CATALOG = [
  { id: "1", name: "Shanghai", country: "China" },
  { id: "2", name: "Zurich", country: "Switzerland" },
  { id: "3", name: "Lisbon", country: "Portugal" },
]

const CITY_BY_ID: Record<string, CityRecord> = {
  "1": SHANGHAI,
  "2": ZURICH,
  "3": LISBON,
  "9": CAMBRIDGE,
}

export type MockOptions = {
  /** Fail this many initial catalog requests before succeeding. */
  catalogFailures?: number
  /** Fail this many initial city requests per city id before succeeding. */
  cityFailures?: Record<string, number>
  /** Fail this many initial remote search requests before succeeding. */
  searchFailures?: number
  /** Remote search results. Defaults to Cambridge. */
  searchResults?: { id: string; name: string; country: string }[]
}

export async function mockApi(page: Page, options: MockOptions = {}) {
  let catalogAttempts = 0
  let searchAttempts = 0
  const cityAttempts = new Map<string, number>()

  await page.route("**/api/catalog", async (route) => {
    catalogAttempts += 1
    if (catalogAttempts <= (options.catalogFailures ?? 0)) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "test_failure" } }),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ cities: CATALOG }),
    })
  })

  await page.route("**/api/fx", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(FX),
    })
  })

  await page.route("**/api/search**", async (route) => {
    searchAttempts += 1
    if (searchAttempts <= (options.searchFailures ?? 0)) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "test_failure" } }),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: options.searchResults ?? [
          { id: "9", name: "Cambridge", country: "United Kingdom" },
        ],
      }),
    })
  })

  await page.route("**/api/city/*", async (route) => {
    const id = new URL(route.request().url()).pathname.split("/").pop() ?? ""
    const attempt = (cityAttempts.get(id) ?? 0) + 1
    cityAttempts.set(id, attempt)
    if (attempt <= (options.cityFailures?.[id] ?? 0)) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "test_failure" } }),
      })
      return
    }
    const city = CITY_BY_ID[id]
    if (!city) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "not_found" } }),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ city }),
    })
  })
}

export async function openApp(page: Page, options: MockOptions = {}) {
  await mockApi(page, options)
  await page.goto("/")
  await expect(page.getByRole("combobox", { name: "城市" })).toBeVisible()
}

export async function chooseCity(page: Page, name: string) {
  await page.getByRole("combobox", { name: "城市" }).click()
  const popover = page.locator('[data-slot="popover-content"]')
  await expect(popover).toBeVisible()
  await popover.getByPlaceholder("搜索城市或国家").fill(name)
  const option = popover.getByText(name, { exact: true })
  await expect(option).toBeVisible()
  // cmdk re-renders its list while filtering. A DOM click avoids the
  // stability check racing the popover close.
  await option.evaluate((element) => (element as HTMLElement).click())
}

export async function selectCity(page: Page, name: string) {
  await chooseCity(page, name)
  await expect(page.getByLabel(`${name} 的每月工时`)).toBeVisible()
}

export async function selectCities(page: Page, names: string[]) {
  for (const name of names) await selectCity(page, name)
}

export function rankingSection(page: Page) {
  return page
    .getByRole("heading", { name: "排行", exact: true })
    .locator("xpath=ancestor::section[1]")
}

export function compareCell(page: Page, cityId: string, item: string) {
  return page.locator(`td[data-city="${cityId}"][data-item="${item}"]`)
}

export async function openCombosTab(page: Page) {
  await page.getByRole("tab", { name: /^组合/ }).click()
  await expect(page.getByRole("heading", { name: "组合明细" })).toBeVisible()
}

export async function waitForShareParam(page: Page, name: string, value: string) {
  await expect
    .poll(() =>
      page.evaluate((param) => {
        const hash = localStorage.getItem("ltp.lastHash")
        return hash ? new URLSearchParams(hash).get(param) : null
      }, name),
    )
    .toBe(value)
}
