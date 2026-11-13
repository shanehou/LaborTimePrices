#!/usr/bin/env bash
# Upload prices.json to R2. Does not build or deploy the Pages site.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
file="${1:-$root/data/prices.json}"

if [[ ! -f "$file" ]]; then
  echo "Missing $file" >&2
  echo "Copy data/prices.example.json to data/prices.json, edit it, then run this again." >&2
  exit 1
fi

npx wrangler r2 object put "labor-time-prices/prices.json" \
  --file "$file" \
  --content-type "application/json"
