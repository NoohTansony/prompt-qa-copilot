# Monetization Plan (Lemon Squeezy)

## Packaging
- Free extension on Chrome Web Store
- Pro license activated via Lemon Squeezy checkout

## Plans
- Free: 10 rewrites/day, basic score
- Pro ($9/mo): unlimited rewrites, advanced rewrite modes, prompt templates
- Team ($29/mo): shared prompt packs (later)

## Integration outline
1. User clicks Upgrade in extension popup
2. Open Lemon Squeezy checkout URL
3. On webhook `order_created` / `subscription_created`, backend marks license active
4. Extension validates license token with backend

## Required backend endpoints
- `POST /api/license/activate`
- `GET /api/license/status`
- `POST /api/lemonsqueezy/webhook`

## First launch KPIs
- 100 installs
- 10 free->paid conversions
- <2% crash/error rate
