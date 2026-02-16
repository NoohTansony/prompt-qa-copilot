const modeEl = document.getElementById("mode");
const checkoutUrlEl = document.getElementById("checkoutUrl");
const apiKeyEl = document.getElementById("apiKey");
const statusEl = document.getElementById("status");

const enabledChatgptEl = document.getElementById("enabledChatgpt");
const enabledClaudeEl = document.getElementById("enabledClaude");
const enabledGeminiEl = document.getElementById("enabledGemini");
const enabledOtherEl = document.getElementById("enabledOther");

chrome.storage.sync.get(
  [
    "rewriteMode",
    "openaiApiKey",
    "checkoutUrl",
    "enabledChatgpt",
    "enabledClaude",
    "enabledGemini",
    "enabledOther",
  ],
  (data) => {
    modeEl.value = data.rewriteMode || "concise";
    apiKeyEl.value = data.openaiApiKey || "";
    checkoutUrlEl.value = data.checkoutUrl || "";

    enabledChatgptEl.checked = data.enabledChatgpt !== false;
    enabledClaudeEl.checked = data.enabledClaude !== false;
    enabledGeminiEl.checked = data.enabledGemini !== false;
    enabledOtherEl.checked = data.enabledOther !== false;
  }
);

document.getElementById("save").addEventListener("click", () => {
  chrome.storage.sync.set(
    {
      rewriteMode: modeEl.value,
      openaiApiKey: apiKeyEl.value.trim(),
      checkoutUrl: checkoutUrlEl.value.trim(),
      enabledChatgpt: enabledChatgptEl.checked,
      enabledClaude: enabledClaudeEl.checked,
      enabledGemini: enabledGeminiEl.checked,
      enabledOther: enabledOtherEl.checked,
    },
    () => {
      statusEl.textContent = "Saved.";
      statusEl.className = "ok";
      setTimeout(() => (statusEl.textContent = ""), 1200);
    }
  );
});
