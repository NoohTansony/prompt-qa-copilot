# Cloudflare Worker Deployment

## 1) Login
```bash
cd worker
npx wrangler login
```

## 2) Create KV namespace
```bash
npx wrangler kv namespace create LICENSES_KV
npx wrangler kv namespace create LICENSES_KV --preview
```

Copy IDs into `wrangler.toml`.

## 3) Set secrets
```bash
npx wrangler secret put LEMON_SQUEEZY_WEBHOOK_SECRET
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put ADMIN_TOKEN
```

Optional vars in `wrangler.toml`:
- `LEMON_SQUEEZY_PRO_VARIANT_IDS`
- `LEMON_SQUEEZY_CHECKOUT_URL`
- `OPENAI_MODEL`
- `MOCK_AI` (set "true" for testing)

## 4) Deploy
```bash
npx wrangler deploy
```

## 5) Endpoints
- `GET /health`
- `GET /api/license/status?userId=...`
- `POST /api/license/activate` (x-admin-token)
- `POST /api/lemonsqueezy/webhook`
- `POST /api/prompt/improve`
- `POST /api/prompt/refine`
