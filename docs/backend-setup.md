# Backend Setup (Production-ready checklist)

## 1) Configure server env

In `server/.env`:

```env
PORT=8787
APP_BASE_URL=https://<your-server-domain>
LEMON_SQUEEZY_WEBHOOK_SECRET=<from-lemonsqueezy>
LEMON_SQUEEZY_PRO_VARIANT_IDS=12345,67890
LEMON_SQUEEZY_CHECKOUT_URL=https://<your-checkout-url>
OPENAI_API_KEY=<your-openai-key>
OPENAI_MODEL=gpt-4.1-mini
ADMIN_TOKEN=<long-random-string>
```

## 2) Start server

```bash
cd server
npm install
npm run dev
```

## 3) Register Lemon webhook

Webhook URL:

```text
https://<your-server-domain>/api/lemonsqueezy/webhook
```

## 4) Verify webhook locally

```bash
cd server
LEMON_SQUEEZY_WEBHOOK_SECRET=... npm run test:webhook
```

## 5) Connect extension settings

In extension options:
- Backend base URL: `https://<your-server-domain>`
- Checkout URL: Lemon hosted checkout URL

## 6) Validate Pro activation

1. Trigger order/subscription event with `install_id` in custom data
2. Check:
   - `GET /api/license/status?userId=<install_id>`
3. Confirm extension shows `Plan: PRO · unlimited`
