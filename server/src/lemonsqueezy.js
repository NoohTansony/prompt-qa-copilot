import crypto from "node:crypto";

function normalizeEventName(name = "") {
  return String(name).trim().toLowerCase();
}

function parseProVariantIds() {
  return String(process.env.LEMON_SQUEEZY_PRO_VARIANT_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function verifyLemonSignature(rawBody, signatureHeader, secret) {
  if (!secret) return false;
  if (!signatureHeader) return false;

  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

export function parseWebhookPayload(payload) {
  const eventName = normalizeEventName(payload?.meta?.event_name || payload?.event_name || "unknown");
  const attrs = payload?.data?.attributes || {};

  const custom = attrs?.custom_data || attrs?.first_order_item?.custom_data || {};
  const email =
    attrs?.user_email || attrs?.email || attrs?.customer_email || attrs?.first_order_item?.customer_email || null;

  const variantId = String(
    attrs?.variant_id ||
      attrs?.first_order_item?.variant_id ||
      attrs?.order_item?.variant_id ||
      ""
  ).trim() || null;

  const productId = String(attrs?.product_id || attrs?.first_order_item?.product_id || "").trim() || null;

  const userId =
    custom?.user_id ||
    custom?.userId ||
    custom?.install_id ||
    custom?.installId ||
    email ||
    null;

  return {
    eventName,
    email,
    userId,
    status: attrs?.status || null,
    variantId,
    productId,
    orderId: attrs?.order_id || null,
    testMode: Boolean(payload?.meta?.test_mode),
    raw: payload,
  };
}

function isProVariant(variantId) {
  if (!variantId) return false;
  const proVariantIds = parseProVariantIds();
  if (!proVariantIds.length) return true; // fallback: treat all paid events as pro if not configured
  return proVariantIds.includes(String(variantId));
}

export function mapEventToLicensePatch(parsed) {
  const { eventName, status, variantId } = parsed;

  if (["subscription_created", "subscription_resumed", "order_created"].includes(eventName)) {
    const pro = isProVariant(variantId);
    return {
      isActive: pro,
      plan: pro ? "pro" : "free",
      source: "lemonsqueezy",
      lsStatus: status || "active",
      lsVariantId: variantId || null,
    };
  }

  if (["subscription_cancelled", "subscription_expired", "subscription_paused"].includes(eventName)) {
    return {
      isActive: false,
      plan: "free",
      source: "lemonsqueezy",
      lsStatus: status || "inactive",
      lsVariantId: variantId || null,
    };
  }

  if (eventName === "subscription_updated") {
    const statusActive = ["active", "on_trial", "past_due"].includes(String(status || "").toLowerCase());
    const pro = statusActive && isProVariant(variantId);
    return {
      isActive: pro,
      plan: pro ? "pro" : "free",
      source: "lemonsqueezy",
      lsStatus: status || null,
      lsVariantId: variantId || null,
    };
  }

  return null;
}
