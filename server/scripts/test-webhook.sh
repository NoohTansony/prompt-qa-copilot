#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8787}"
SECRET="${LEMON_SQUEEZY_WEBHOOK_SECRET:-}"

if [[ -z "$SECRET" ]]; then
  echo "Set LEMON_SQUEEZY_WEBHOOK_SECRET first"
  exit 1
fi

BODY='{"meta":{"event_name":"order_created"},"data":{"attributes":{"email":"test@example.com","custom_data":{"install_id":"pqc_test"},"variant_id":"12345","status":"paid"}}}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -hex | sed 's/^.* //')

curl -sS -X POST "$BASE_URL/api/lemonsqueezy/webhook" \
  -H 'content-type: application/json' \
  -H "x-signature: $SIG" \
  --data "$BODY" | jq .

echo
echo "License status:"
curl -sS "$BASE_URL/api/license/status?userId=pqc_test" | jq .
