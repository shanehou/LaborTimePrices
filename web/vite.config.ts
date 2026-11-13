import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import type { Connect } from "vite"
import { defineConfig } from "vitest/config"

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const pricesFile = path.resolve(rootDir, "../data/prices.json")

const servePricesJson: Connect.NextHandleFunction = (req, res, next) => {
  const pathname = req.url?.split("?")[0]
  if (pathname !== "/prices.json") {
    next()
    return
  }
  if (!fs.existsSync(pricesFile)) {
    res.statusCode = 404
    res.setHeader("content-type", "application/json; charset=utf-8")
    res.end(JSON.stringify({ error: "data/prices.json is missing" }))
    return
  }
  res.statusCode = 200
  res.setHeader("content-type", "application/json; charset=utf-8")
  res.setHeader("cache-control", "no-cache")
  fs.createReadStream(pricesFile).pipe(res)
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "serve-prices-json",
      configureServer(server) {
        server.middlewares.use(servePricesJson)
      },
      configurePreviewServer(server) {
        server.middlewares.use(servePricesJson)
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
})
