import crypto from "node:crypto";

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
  const eventName = payload?.meta?.event_name || payload?.event_name || "unknown";
  const attrs = payload?.data?.attributes || {};
  const custom = attrs?.custom_data || {};

  const email = attrs?.user_email || attrs?.email || attrs?.customer_email || null;
  const userId = custom?.user_id || custom?.userId || email || null;

  return {
    eventName,
    email,
    userId,
    status: attrs?.status || null,
    testMode: Boolean(payload?.meta?.test_mode),
    raw: payload,
  };
}

export function mapEventToLicensePatch(parsed) {
  const { eventName, status } = parsed;

  if (["subscription_created", "subscription_resumed", "order_created"].includes(eventName)) {
    return { isActive: true, plan: "pro", source: "lemonsqueezy", lsStatus: status || "active" };
  }

  if (["subscription_cancelled", "subscription_expired", "subscription_paused"].includes(eventName)) {
    return { isActive: false, plan: "free", source: "lemonsqueezy", lsStatus: status || "inactive" };
  }

  if (["subscription_updated"].includes(eventName)) {
    const isActive = ["active", "on_trial", "past_due"].includes(status);
    return { isActive, plan: isActive ? "pro" : "free", source: "lemonsqueezy", lsStatus: status || null };
  }

  return null;
}
