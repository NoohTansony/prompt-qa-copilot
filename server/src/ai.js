const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

function ensureApiKey() {
  if (!OPENAI_API_KEY) {
    const err = new Error("OPENAI_API_KEY is not configured");
    err.code = "NO_OPENAI_KEY";
    throw err;
  }
}

async function callOpenAI(systemPrompt, userPrompt) {
  ensureApiKey();

  const body = {
    model: OPENAI_MODEL,
    input: [
      { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
      { role: "user", content: [{ type: "input_text", text: userPrompt }] },
    ],
    temperature: 0.4,
  };

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`OpenAI error ${res.status}: ${text}`);
    err.code = "OPENAI_ERROR";
    throw err;
  }

  const data = await res.json();
  const output = data?.output_text || "";
  return String(output).trim();
}

export async function improveWithAI({ text, mode }) {
  const system = [
    "You are Prompt QA Copilot.",
    "Rewrite user text into a high-quality AI prompt.",
    "Keep intent unchanged.",
    "Return only the rewritten prompt.",
  ].join(" ");

  const user = [
    `Mode: ${mode || "concise"}`,
    "Text:",
    text || "",
  ].join("\n");

  return callOpenAI(system, user);
}

export async function refineWithAI({ text, mode, context = {} }) {
  const system = [
    "You are Prompt QA Copilot.",
    "Refine user text into a highly specific, execution-ready AI prompt.",
    "Use given context fields (goal, tone, constraints, output format).",
    "Return only the refined prompt.",
  ].join(" ");

  const user = [
    `Mode: ${mode || "concise"}`,
    `Goal: ${context.goal || "n/a"}`,
    `Tone: ${context.tone || "n/a"}`,
    `Constraints: ${context.constraints || "n/a"}`,
    `Output format: ${context.outputFormat || "n/a"}`,
    "",
    "Text:",
    text || "",
  ].join("\n");

  return callOpenAI(system, user);
}
