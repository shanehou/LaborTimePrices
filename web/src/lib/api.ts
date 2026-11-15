import { validateCatalogCity, validateCityRecord } from "./schema"
import type { CatalogCity, CityRecord } from "./types"

const API_BASE = "/api"

/** One request may wait this long before it is aborted. */
export const REQUEST_TIMEOUT_MS = 15_000

export type ApiErrorCode =
  | "timeout"
  | "network"
  | "http"
  | "rate_limited"
  | "upstream"
  | "invalid"
  | "bad_response"

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status?: number

  constructor(code: ApiErrorCode, message: string, status?: number) {
    super(message)
    this.name = "ApiError"
    this.code = code
    this.status = status
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) as unknown }
  } catch {
    return { ok: false }
  }
}

function serverErrorCode(body: unknown): string | undefined {
  if (!isRecord(body)) return undefined
  const error = body.error
  if (!isRecord(error)) return undefined
  return typeof error.code === "string" ? error.code : undefined
}

function httpError(status: number, body: unknown): ApiError {
  const detail = serverErrorCode(body)
  const suffix = detail ? ` (${detail})` : ""
  if (status === 429) {
    return new ApiError("rate_limited", `Too many requests${suffix}.`, status)
  }
  if (status === 502) {
    return new ApiError("upstream", `The price source is unavailable${suffix}.`, status)
  }
  return new ApiError("http", `The server returned HTTP ${status}${suffix}.`, status)
}

function requestError(
  error: unknown,
  timedOut: boolean,
  callerSignal: AbortSignal | undefined,
): ApiError {
  if (timedOut) return new ApiError("timeout", "The request timed out.")
  const name = error instanceof Error ? error.name : ""
  if (name === "AbortError" || name === "TimeoutError" || callerSignal?.aborted) {
    return new ApiError("timeout", "The request was aborted.")
  }
  return new ApiError("network", "The network request failed.")
}

async function requestJson(path: string, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, REQUEST_TIMEOUT_MS)
  const abortFromCaller = () => controller.abort()
  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener("abort", abortFromCaller, { once: true })
  }

  try {
    const response = await fetch(path, {
      signal: controller.signal,
      headers: { accept: "application/json" },
      cache: "no-store",
    })

    let text: string
    try {
      text = await response.text()
    } catch (error) {
      if (controller.signal.aborted) throw requestError(error, timedOut, signal)
      throw new ApiError("bad_response", "The server response could not be read.", response.status)
    }

    const parsed = parseJson(text)
    if (!response.ok) throw httpError(response.status, parsed.ok ? parsed.value : undefined)
    if (!parsed.ok) {
      throw new ApiError("invalid", "The server response was not valid JSON.", response.status)
    }
    return parsed.value
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw requestError(error, timedOut, signal)
  } finally {
    clearTimeout(timer)
    if (signal) signal.removeEventListener("abort", abortFromCaller)
  }
}

function invalid(message: string): ApiError {
  return new ApiError("invalid", message)
}

function encodeSegment(value: string): string {
  try {
    return encodeURIComponent(value)
  } catch {
    throw invalid("The request contained an invalid value.")
  }
}

export async function fetchCatalog(signal?: AbortSignal): Promise<CatalogCity[]> {
  const body = await requestJson(`${API_BASE}/catalog`, signal)
  if (!isRecord(body) || !Array.isArray(body.cities)) {
    throw invalid("The city catalog was not in the expected format.")
  }
  const cities: CatalogCity[] = []
  for (const entry of body.cities) {
    const city = validateCatalogCity(entry)
    if (!city) throw invalid("The city catalog was not in the expected format.")
    cities.push(city)
  }
  return cities
}

export async function fetchCity(id: string, signal?: AbortSignal): Promise<CityRecord> {
  const body = await requestJson(`${API_BASE}/city/${encodeSegment(id)}`, signal)
  if (!isRecord(body)) throw invalid("The city response was not in the expected format.")
  const validated = validateCityRecord(body.city)
  if (!validated.ok) throw invalid("The city response was not in the expected format.")
  return validated.city
}

export async function searchCities(
  query: string,
  signal?: AbortSignal,
): Promise<CatalogCity[]> {
  const body = await requestJson(`${API_BASE}/search?q=${encodeSegment(query)}`, signal)
  if (!isRecord(body) || !Array.isArray(body.results)) {
    throw invalid("The search response was not in the expected format.")
  }
  const cities: CatalogCity[] = []
  const seen = new Set<string>()
  for (const entry of body.results) {
    const city = validateCatalogCity(entry)
    if (!city) throw invalid("The search response was not in the expected format.")
    if (seen.has(city.id)) continue
    seen.add(city.id)
    cities.push(city)
  }
  return cities
}
