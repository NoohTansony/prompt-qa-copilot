# Prompt QA Copilot (Chrome Extension)

Prompt-focused writing assistant for AI chats.

## MVP goals
- Score prompts for clarity and structure
- One-click rewrite suggestions
- Detect missing prompt blocks (role, goal, constraints, output format)
- Lightweight panel inside AI chat textareas

## Tech
- Manifest V3
- Vanilla JS + CSS
- Content script UI injection
- Node.js backend (Express) for Lemon Squeezy + license status

## Local test
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** this folder
4. Open ChatGPT (or any page with a textarea)

## Backend (license + webhooks)
```bash
cd server
cp .env.example .env
npm install
npm run dev
```

Then set `Backend base URL` in extension options (e.g., `http://localhost:8787`).

## Roadmap
- Anthropic provider option
- Team prompt library
- Better site-specific prompt adapters

## Repo structure
- `src/` Chrome extension source
- `server/` Lemon Squeezy + license + AI proxy backend
- `docs/` setup and product docs
