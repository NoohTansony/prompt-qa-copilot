export function ensureString(value, fallback = "") {
  if (typeof value === "string") return value;
  if (value == null) return fallback;
  return String(value);
}

export function parseImprovePayload(body = {}) {
  return {
    userId: ensureString(body.userId).trim(),
    text: ensureString(body.text),
    mode: ensureString(body.mode || "concise") || "concise",
  };
}

export function parseRefinePayload(body = {}) {
  const context = body.context || {};
  return {
    userId: ensureString(body.userId).trim(),
    text: ensureString(body.text),
    mode: ensureString(body.mode || "concise") || "concise",
    context: {
      goal: ensureString(context.goal),
      tone: ensureString(context.tone),
      constraints: ensureString(context.constraints),
      outputFormat: ensureString(context.outputFormat),
    },
  };
}
