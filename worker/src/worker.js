const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "content-type,x-admin-token",
};

function withCors(resp) {
  const h = new Headers(resp.headers);
  Object.entries(corsHeaders).forEach(([k, v]) => h.set(k, v));
  return new Response(resp.body, { status: resp.status, headers: h });
}

function normalizeEventName(name = "") {
  return String(name).trim().toLowerCase();
}

function parseProVariantIds(env) {
  return String(env.LEMON_SQUEEZY_PRO_VARIANT_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isProVariant(env, variantId) {
  if (!variantId) return false;
  const ids = parseProVariantIds(env);
  if (!ids.length) return true;
  return ids.includes(String(variantId));
}

async function sha256HmacHex(secret, raw) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, raw);
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyLemonSignature(rawBody, signature, secret) {
  if (!secret || !signature) return false;
  const digest = await sha256HmacHex(secret, rawBody);
  return digest === String(signature).trim();
}

function parseWebhookPayload(payload) {
  const eventName = normalizeEventName(payload?.meta?.event_name || payload?.event_name || "unknown");
  const attrs = payload?.data?.attributes || {};
  const custom = attrs?.custom_data || attrs?.first_order_item?.custom_data || {};

  const email =
    attrs?.user_email || attrs?.email || attrs?.customer_email || attrs?.first_order_item?.customer_email || null;

  const variantId = String(
    attrs?.variant_id || attrs?.first_order_item?.variant_id || attrs?.order_item?.variant_id || ""
  ).trim() || null;

  const userId =
    custom?.user_id || custom?.userId || custom?.install_id || custom?.installId || email || null;

  return {
    eventName,
    userId,
    email,
    status: attrs?.status || null,
    variantId,
  };
}

function mapEventToLicensePatch(env, parsed) {
  const { eventName, status, variantId } = parsed;

  if (["subscription_created", "subscription_resumed", "order_created"].includes(eventName)) {
    const pro = isProVariant(env, variantId);
    return { isActive: pro, plan: pro ? "pro" : "free", source: "lemonsqueezy", lsStatus: status || "active", lsVariantId: variantId };
  }

  if (["subscription_cancelled", "subscription_expired", "subscription_paused"].includes(eventName)) {
    return { isActive: false, plan: "free", source: "lemonsqueezy", lsStatus: status || "inactive", lsVariantId: variantId };
  }

  if (eventName === "subscription_updated") {
    const statusActive = ["active", "on_trial", "past_due"].includes(String(status || "").toLowerCase());
    const pro = statusActive && isProVariant(env, variantId);
    return { isActive: pro, plan: pro ? "pro" : "free", source: "lemonsqueezy", lsStatus: status || null, lsVariantId: variantId };
  }

  return null;
}

async function getLicense(env, userId) {
  const raw = await env.LICENSES_KV.get(`license:${userId}`);
  if (!raw) return { userId, plan: "free", isActive: false, source: "none" };
  return JSON.parse(raw);
}

async function putLicense(env, userId, patch = {}) {
  const prev = await getLicense(env, userId);
  const next = { ...prev, ...patch, userId, updatedAt: new Date().toISOString() };
  await env.LICENSES_KV.put(`license:${userId}`, JSON.stringify(next));
  return next;
}

async function addEvent(env, event) {
  const key = `event:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  await env.LICENSES_KV.put(key, JSON.stringify({ ...event, receivedAt: new Date().toISOString() }), {
    expirationTtl: 60 * 60 * 24 * 30,
  });
}

function localFallbackPrompt(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";
  return [
    "You are a practical assistant.",
    "",
    "Task:",
    raw,
    "",
    "Rules:",
    "- Be accurate and concise.",
    "- If critical info is missing, ask only necessary questions.",
    "",
    "Output format:",
    "1) Short answer",
    "2) Actionable steps",
  ].join("\n");
}

async function callOpenAI(env, systemPrompt, userPrompt) {
  if (String(env.MOCK_AI || "false").toLowerCase() === "true") {
    return `[MOCK] ${userPrompt.slice(0, 600)}`;
  }

  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

  const headers = {
    Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    "Content-Type": "application/json",
  };

  // Try Responses API first
  const responsesBody = {
    model: env.OPENAI_MODEL || "gpt-4.1-mini",
    input: [
      { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
      { role: "user", content: [{ type: "input_text", text: userPrompt }] },
    ],
    temperature: 0.4,
  };

  let res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers,
    body: JSON.stringify(responsesBody),
  });

  if (res.ok) {
    const data = await res.json();
    return String(data?.output_text || "").trim();
  }

  const firstError = await res.text();

  // Fallback to Chat Completions API
  const chatBody = {
    model: env.OPENAI_MODEL || "gpt-4.1-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.4,
  };

  res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify(chatBody),
  });

  if (res.ok) {
    const data = await res.json();
    return String(data?.choices?.[0]?.message?.content || "").trim();
  }

  const secondError = await res.text();
  throw new Error(`OpenAI responses failed: ${firstError} | chat.completions failed: ${secondError}`);
}

function requireAdmin(request, env) {
  return !!env.ADMIN_TOKEN && request.headers.get("x-admin-token") === env.ADMIN_TOKEN;
}

async function handle(request, env) {
  const { pathname, searchParams } = new URL(request.url);

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  if (pathname === "/health") return json({ ok: true, service: "prompt-qa-copilot-worker", time: new Date().toISOString() });

  if (pathname === "/api/diag" && request.method === "GET") {
    return json({
      ok: true,
      cf: request.cf ? {
        colo: request.cf.colo,
        country: request.cf.country,
        regionCode: request.cf.regionCode,
        city: request.cf.city,
        asn: request.cf.asn,
      } : null,
      mockAi: String(env.MOCK_AI || "false"),
      requirePro: String(env.REQUIRE_PRO || "false"),
      model: env.OPENAI_MODEL || null,
    });
  }

  if (pathname === "/api/license/status" && request.method === "GET") {
    const userId = String(searchParams.get("userId") || "").trim();
    if (!userId) return json({ ok: false, error: "userId is required" }, 400);

    const license = await getLicense(env, userId);
    return json({ ok: true, userId, license, upgradeUrl: env.LEMON_SQUEEZY_CHECKOUT_URL || null });
  }

  if (pathname === "/api/license/activate" && request.method === "POST") {
    if (!requireAdmin(request, env)) return json({ ok: false, error: "unauthorized" }, 401);
    const body = await request.json().catch(() => ({}));
    const userId = String(body.userId || "").trim();
    if (!userId) return json({ ok: false, error: "userId is required" }, 400);

    const next = await putLicense(env, userId, {
      plan: body.plan || "pro",
      isActive: body.isActive !== false,
      source: body.source || "manual",
    });
    return json({ ok: true, license: next });
  }

  if (pathname === "/api/admin/openai-probe" && request.method === "GET") {
    if (!requireAdmin(request, env)) return json({ ok: false, error: "unauthorized" }, 401);
    try {
      const output = await callOpenAI(env, "Return exactly: OK", "Ping");
      return json({ ok: true, output, source: "openai" });
    } catch (err) {
      return json({ ok: false, error: err.message || "probe_failed" }, 500);
    }
  }

  if (pathname === "/api/lemonsqueezy/webhook" && request.method === "POST") {
    const rawBody = await request.arrayBuffer();
    const signature = request.headers.get("x-signature");

    const verified = await verifyLemonSignature(rawBody, signature, env.LEMON_SQUEEZY_WEBHOOK_SECRET || "");
    if (!verified) return json({ ok: false, error: "invalid signature" }, 401);

    const payload = JSON.parse(new TextDecoder().decode(rawBody));
    const parsed = parseWebhookPayload(payload);
    await addEvent(env, { type: "lemonsqueezy", eventName: parsed.eventName, userId: parsed.userId, email: parsed.email, variantId: parsed.variantId });

    if (!parsed.userId) return json({ ok: true, ignored: true, reason: "no user identifier in payload" }, 202);

    const patch = mapEventToLicensePatch(env, parsed);
    if (!patch) return json({ ok: true, ignored: true, reason: "event not mapped" }, 202);

    const next = await putLicense(env, parsed.userId, patch);
    return json({ ok: true, updated: true, license: next, event: parsed.eventName });
  }

  if (pathname === "/api/prompt/improve" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const userId = String(body.userId || "").trim();
    const text = String(body.text || "");
    const mode = String(body.mode || "concise");
    if (!userId) return json({ ok: false, error: "userId is required" }, 400);
    if (!text.trim()) return json({ ok: false, error: "text is required" }, 400);

    const requirePro = String(env.REQUIRE_PRO || "false").toLowerCase() === "true";
    if (requirePro) {
      const license = await getLicense(env, userId);
      if (!license.isActive) return json({ ok: false, error: "pro license required", license }, 402);
    }

    try {
      const output = await callOpenAI(
        env,
        "You are Prompt QA Copilot. Rewrite user text into a high-quality AI prompt. Keep intent unchanged. Return only the rewritten prompt.",
        `Mode: ${mode}\nText:\n${text}`
      );
      return json({ ok: true, output, model: env.OPENAI_MODEL || "gpt-4.1-mini", source: "openai" });
    } catch (err) {
      const output = localFallbackPrompt(text);
      return json({ ok: true, output, source: "local-fallback", warning: err.message || "openai_failed" });
    }
  }

  if (pathname === "/api/prompt/refine" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const userId = String(body.userId || "").trim();
    const text = String(body.text || "");
    const mode = String(body.mode || "concise");
    const ctx = body.context || {};
    if (!userId) return json({ ok: false, error: "userId is required" }, 400);
    if (!text.trim()) return json({ ok: false, error: "text is required" }, 400);

    const requirePro = String(env.REQUIRE_PRO || "false").toLowerCase() === "true";
    if (requirePro) {
      const license = await getLicense(env, userId);
      if (!license.isActive) return json({ ok: false, error: "pro license required", license }, 402);
    }

    try {
      const output = await callOpenAI(
        env,
        "You are Prompt QA Copilot. Refine user text into a highly specific, execution-ready AI prompt. Use context fields and return only the refined prompt.",
        `Mode: ${mode}\nGoal: ${ctx.goal || "n/a"}\nTone: ${ctx.tone || "n/a"}\nConstraints: ${ctx.constraints || "n/a"}\nOutput format: ${ctx.outputFormat || "n/a"}\n\nText:\n${text}`
      );
      return json({ ok: true, output, model: env.OPENAI_MODEL || "gpt-4.1-mini", source: "openai" });
    } catch (err) {
      const output = localFallbackPrompt(text);
      return json({ ok: true, output, source: "local-fallback", warning: err.message || "openai_failed" });
    }
  }

  return json({ ok: false, error: "not found" }, 404);
}

export default {
  async fetch(request, env) {
    try {
      return withCors(await handle(request, env));
    } catch (err) {
      return withCors(json({ ok: false, error: err.message || "internal error" }, 500));
    }
  },
};
