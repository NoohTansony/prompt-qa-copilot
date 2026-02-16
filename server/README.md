# Prompt QA Copilot Server

Minimal backend for:
- Lemon Squeezy webhook verification
- License status lookup
- Optional AI rewrite proxy endpoints

## Run

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

## Endpoints

- `GET /health`
- `GET /api/license/status?userId=<id>`
- `POST /api/license/activate` (admin token protected)
- `POST /api/lemonsqueezy/webhook` (signature verified)
- `POST /api/prompt/improve` (stub)
- `POST /api/prompt/refine` (stub)
