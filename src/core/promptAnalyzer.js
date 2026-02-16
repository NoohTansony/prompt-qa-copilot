function findMissingBlocks(text) {
  const lower = text.toLowerCase();
  const checks = [
    { key: "role", test: /you are|act as|role:/i },
    { key: "goal", test: /goal|objective|task|i need/i },
    { key: "constraints", test: /constraint|must|should|do not|avoid/i },
    { key: "output_format", test: /format|json|table|bullet|markdown|schema/i },
  ];

  return checks.filter((c) => !c.test.test(lower)).map((c) => c.key);
}

function scorePrompt(text) {
  if (!text || !text.trim()) {
    return { score: 0, missing: ["role", "goal", "constraints", "output_format"], notes: ["Prompt is empty."] };
  }

  let score = 40;
  const missing = findMissingBlocks(text);

  score += Math.min(text.length / 20, 20);
  score += (4 - missing.length) * 10;

  if (text.split("\n").length >= 3) score += 5;
  if (/example|for instance|e\.g\./i.test(text)) score += 5;

  score = Math.max(0, Math.min(100, Math.round(score)));

  const notes = [];
  if (missing.includes("role")) notes.push("Add a role (e.g., 'You are a senior...').");
  if (missing.includes("goal")) notes.push("State one clear task goal.");
  if (missing.includes("constraints")) notes.push("Add constraints (tone, length, forbidden actions).");
  if (missing.includes("output_format")) notes.push("Specify output format (bullets, JSON, sections).");

  return { score, missing, notes };
}

function modePrefix(mode = "concise") {
  if (mode === "coder") return "You are a senior software engineer.";
  if (mode === "detailed") return "You are an expert assistant. Think step by step and be explicit.";
  return "You are a helpful assistant.";
}

function rewritePrompt(text, mode = "concise") {
  const trimmed = (text || "").trim();
  if (!trimmed) return "";

  return [
    modePrefix(mode),
    "",
    "Task:",
    trimmed,
    "",
    "Constraints:",
    "- Be accurate and practical.",
    "- Ask clarifying questions only if critical information is missing.",
    mode === "concise" ? "- Keep the response concise." : "- Include actionable details.",
    "",
    "Output format:",
    "- Summary",
    "- Key points",
    "- Next steps",
  ].join("\n");
}

function refinePrompt(text, context = {}, mode = "concise") {
  const trimmed = (text || "").trim();
  if (!trimmed) return "";

  const goal = context.goal || "Complete the user's request accurately.";
  const tone = context.tone || "Clear and professional";
  const constraints = context.constraints || "No hallucinations. Be explicit when uncertain.";
  const outputFormat = context.outputFormat || "Bullet list with concise steps.";

  return [
    modePrefix(mode),
    "",
    "Primary Goal:",
    goal,
    "",
    "User Input:",
    trimmed,
    "",
    "Tone:",
    tone,
    "",
    "Constraints:",
    constraints,
    "",
    "Required Output Format:",
    outputFormat,
    "",
    "Quality bar:",
    "- Be specific and actionable.",
    "- Keep structure tidy and easy to scan.",
    "- Avoid filler.",
  ].join("\n");
}

window.PromptAnalyzer = { scorePrompt, rewritePrompt, refinePrompt };
