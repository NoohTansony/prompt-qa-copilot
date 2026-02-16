# Quickstart

## 1) Run backend
```bash
cd server
cp .env.example .env
npm install
npm run dev
```

## 2) Load extension
- Open `chrome://extensions`
- Enable developer mode
- Load unpacked -> select repo root

## 3) Extension options
- Set Backend base URL: `http://localhost:8787`
- Set Checkout URL (optional): Lemon hosted checkout URL

## 4) Package extension
```bash
bash scripts/package-extension.sh
```
