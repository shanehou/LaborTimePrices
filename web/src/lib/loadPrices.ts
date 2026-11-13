import { mockPrices } from "../data/mockPrices"
import type { LoadReason } from "../i18n"
import { validatePricesDataset } from "./schema"
import type { PriceDataset } from "./types"

export type DataOrigin = "prices.json" | "mock"

export type LoadedPrices = {
  dataset: PriceDataset
  origin: DataOrigin
  reason?: LoadReason
  detail?: string
}

function mockResult(reason: LoadReason, detail?: string): LoadedPrices {
  return {
    dataset: structuredClone(mockPrices),
    origin: "mock",
    reason,
    detail,
  }
}

export async function loadPrices(
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 8000,
): Promise<LoadedPrices> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl("/prices.json", {
      signal: controller.signal,
      cache: "no-store",
    })
    if (response.status === 404) return mockResult("missing")
    if (!response.ok) return mockResult("http", String(response.status))

    const text = await response.text()
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      return mockResult("invalid_json")
    }
    const validated = validatePricesDataset(json)
    if (!validated.ok) return mockResult("invalid_schema")
    return { dataset: validated.dataset, origin: "prices.json" }
  } catch (error) {
    const name = error instanceof Error ? error.name : ""
    if (name === "AbortError" || name === "TimeoutError") return mockResult("timeout")
    return mockResult("network")
  } finally {
    clearTimeout(timer)
  }
}
