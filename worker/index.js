// Reads the R2 object "prices.json" for GET /prices.json.
// This worker does not call Numbeo or any other price site.

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname !== "/prices.json") {
      return new Response("Not found", { status: 404 })
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", {
        status: 405,
        headers: { allow: "GET, HEAD" },
      })
    }

    const object = await env.PRICES.get("prices.json")
    if (!object) {
      return new Response(JSON.stringify({ error: "prices.json not found" }), {
        status: 404,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "public, max-age=60",
        },
      })
    }

    const headers = new Headers()
    headers.set(
      "content-type",
      object.httpMetadata?.contentType || "application/json; charset=utf-8",
    )
    headers.set("cache-control", "public, max-age=300")
    if (object.httpEtag) headers.set("etag", object.httpEtag)

    return new Response(request.method === "HEAD" ? null : object.body, { status: 200, headers })
  },
}
