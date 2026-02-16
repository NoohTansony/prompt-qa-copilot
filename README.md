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

## Local test
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** this folder
4. Open ChatGPT (or any page with a textarea)

## Roadmap
- Provider API rewrites (OpenAI / Anthropic)
- Lemon Squeezy licensing
- Team prompt library
