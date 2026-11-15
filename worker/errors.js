// Error helpers shared by the router and the upstream clients.
// Every JSON error body has the shape { error: { code, message } }.

export class ApiError extends Error {
  constructor(code, message, status = 500) {
    super(message)
    this.name = "ApiError"
    this.code = code
    this.status = status
  }
}

export function errorResponse(code, message, status = 500) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  })
}

export function jsonResponse(data, { status = 200, cacheControl } = {}) {
  const headers = { "content-type": "application/json; charset=utf-8" }
  if (cacheControl) headers["cache-control"] = cacheControl
  return new Response(JSON.stringify(data), { status, headers })
}
