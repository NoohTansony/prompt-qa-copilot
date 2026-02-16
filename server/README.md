# Prompt QA Copilot Server

Backend for:
- Lemon Squeezy webhook verification
- License status lookup
- Pro-gated AI rewrite/refine endpoints

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
- `POST /api/prompt/improve` (Pro only)
- `POST /api/prompt/refine` (Pro only)

## Notes

- Set `LEMON_SQUEEZY_PRO_VARIANT_IDS` as comma-separated variant IDs to define which purchases map to Pro.
- If `LEMON_SQUEEZY_PRO_VARIANT_IDS` is empty, paid events are treated as Pro by default.
- Set `MOCK_AI=true` to test without OpenAI keys.
- Set `OPENAI_API_KEY` and `MOCK_AI=false` for real AI rewrite calls.
