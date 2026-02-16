const modeEl = document.getElementById("mode");
const apiKeyEl = document.getElementById("apiKey");
const statusEl = document.getElementById("status");

chrome.storage.sync.get(["rewriteMode", "openaiApiKey"], (data) => {
  modeEl.value = data.rewriteMode || "concise";
  apiKeyEl.value = data.openaiApiKey || "";
});

document.getElementById("save").addEventListener("click", () => {
  chrome.storage.sync.set(
    {
      rewriteMode: modeEl.value,
      openaiApiKey: apiKeyEl.value.trim(),
    },
    () => {
      statusEl.textContent = "Saved.";
      statusEl.className = "ok";
      setTimeout(() => (statusEl.textContent = ""), 1200);
    }
  );
});
