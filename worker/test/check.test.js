// Guard: every JavaScript file in the worker must be syntactically valid.
// Runs the same `node --check` the acceptance criteria ask for.

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const WORKER_ROOT = fileURLToPath(new URL("../", import.meta.url))
const SKIP_DIRECTORIES = new Set(["node_modules", ".wrangler", "dist"])

function findJavaScriptFiles(directory) {
  const files = []
  for (const entry of readdirSync(directory)) {
    if (SKIP_DIRECTORIES.has(entry)) continue
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) {
      files.push(...findJavaScriptFiles(path))
    } else if (entry.endsWith(".js")) {
      files.push(path)
    }
  }
  return files
}

test("every worker JavaScript file passes node --check", () => {
  const files = findJavaScriptFiles(WORKER_ROOT)
  assert.ok(files.length >= 5, `expected several worker JS files, found ${files.length}`)
  for (const file of files) {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" })
  }
})
