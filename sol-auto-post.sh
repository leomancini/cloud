#!/bin/bash
# Sol autonomous posting - triggered by cron every 3 hours
# Requires SOL_AUTO_POST_KEY env var to be set

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/.env" 2>/dev/null

if [ -z "$SOL_AUTO_POST_KEY" ]; then
  echo "SOL_AUTO_POST_KEY not set"
  exit 1
fi

BASE_URL="${SOL_BASE_URL:-http://localhost:3127}"

curl -s --max-time 120 -X POST "$BASE_URL/api/sol/auto-post" \
  -H "Content-Type: application/json" \
  -H "X-Sol-Key: $SOL_AUTO_POST_KEY" | head -c 500

echo ""
