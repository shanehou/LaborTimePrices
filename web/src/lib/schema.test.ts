import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { mockPrices } from "../data/mockPrices"
import { validatePricesDataset } from "./schema"

const examplePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../data/prices.example.json",
)

describe("validatePricesDataset", () => {
  it("accepts the example file and matches the in-repo mock", () => {
    const example = JSON.parse(readFileSync(examplePath, "utf8")) as unknown
    const validated = validatePricesDataset(example)
    expect(validated.ok).toBe(true)
    if (!validated.ok) return
    expect(validated.dataset).toEqual(mockPrices)
  })

  it("rejects a payload that is not the city list", () => {
    expect(validatePricesDataset({ cities: "nope" }).ok).toBe(false)
    expect(validatePricesDataset(null).ok).toBe(false)
    expect(validatePricesDataset({ cities: [{ id: "x" }] }).ok).toBe(false)
  })

  it("keeps a non-positive salary so ranking can explain it", () => {
    const validated = validatePricesDataset({
      cities: [
        {
          id: "ghost",
          name: "Ghost",
          country: "Nowhere",
          monthly_net_salary: 0,
          prices: [{ category: "Restaurants", item: "Cappuccino", price_usd: 2 }],
        },
      ],
    })
    expect(validated.ok).toBe(true)
    if (!validated.ok) return
    expect(validated.dataset.cities[0]?.monthly_net_salary).toBe(0)
  })

  it("treats a missing salary as absent rather than zero", () => {
    const validated = validatePricesDataset({
      cities: [
        {
          id: "ghost",
          name: "Ghost",
          country: "Nowhere",
          prices: [{ category: "Restaurants", item: "Cappuccino", price_usd: 2 }],
        },
      ],
    })
    expect(validated.ok).toBe(true)
    if (!validated.ok) return
    expect(validated.dataset.cities[0]?.monthly_net_salary).toBeNull()
  })
})
