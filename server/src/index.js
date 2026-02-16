import "dotenv/config";
import express from "express";
import cors from "cors";

import { addEvent, getLicense, upsertLicense } from "./store.js";
import { mapEventToLicensePatch, parseWebhookPayload, verifyLemonSignature } from "./lemonsqueezy.js";

const app = express();
const PORT = Number(process.env.PORT || 8787);
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

app.use(cors());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "prompt-qa-copilot-server", time: new Date().toISOString() });
});

app.get("/api/license/status", (req, res) => {
  const userId = String(req.query.userId || "").trim();
  if (!userId) return res.status(400).json({ ok: false, error: "userId is required" });

  const license = getLicense(userId);
  res.json({ ok: true, userId, license, upgradeUrl: null });
});

app.post("/api/license/activate", express.json(), (req, res) => {
  if (!ADMIN_TOKEN || req.headers["x-admin-token"] !== ADMIN_TOKEN) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const { userId, plan = "pro", isActive = true, source = "manual" } = req.body || {};
  if (!userId) return res.status(400).json({ ok: false, error: "userId is required" });

  const next = upsertLicense(String(userId), { plan, isActive, source });
  return res.json({ ok: true, license: next });
});

app.post(
  "/api/lemonsqueezy/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    const signature = req.headers["x-signature"];
    const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET || "";
    const rawBody = req.body;

    if (!Buffer.isBuffer(rawBody)) {
      return res.status(400).json({ ok: false, error: "raw body is required" });
    }

    const verified = verifyLemonSignature(rawBody, String(signature || ""), secret);
    if (!verified) return res.status(401).json({ ok: false, error: "invalid signature" });

    let payload;
    try {
      payload = JSON.parse(rawBody.toString("utf-8"));
    } catch {
      return res.status(400).json({ ok: false, error: "invalid json payload" });
    }

    const parsed = parseWebhookPayload(payload);
    addEvent({ type: "lemonsqueezy", eventName: parsed.eventName, userId: parsed.userId, email: parsed.email });

    if (!parsed.userId) {
      return res.status(202).json({ ok: true, ignored: true, reason: "no user identifier in payload" });
    }

    const patch = mapEventToLicensePatch(parsed);
    if (!patch) {
      return res.status(202).json({ ok: true, ignored: true, reason: "event not mapped" });
    }

    const next = upsertLicense(String(parsed.userId), patch);
    return res.json({ ok: true, updated: true, license: next, event: parsed.eventName });
  }
);

app.post("/api/prompt/improve", express.json(), (req, res) => {
  const { text = "", mode = "concise" } = req.body || {};
  const out = [
    "[server-stub] Improve",
    `mode=${mode}`,
    "",
    String(text).trim(),
  ].join("\n");
  res.json({ ok: true, output: out });
});

app.post("/api/prompt/refine", express.json(), (req, res) => {
  const { text = "", context = {}, mode = "concise" } = req.body || {};
  const out = [
    "[server-stub] Refine",
    `mode=${mode}`,
    `goal=${context.goal || "n/a"}`,
    `tone=${context.tone || "n/a"}`,
    "",
    String(text).trim(),
  ].join("\n");
  res.json({ ok: true, output: out });
});

app.listen(PORT, () => {
  console.log(`[prompt-qa-copilot-server] listening on ${APP_BASE_URL}`);
});
