(function () {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("src/core/promptAnalyzer.js");
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);

  const DAILY_FREE_LIMIT = 20;

  let panel;
  let minBtn;
  let activeTextarea;
  let lastRewritten = "";

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function usageKey() {
    return `usage:${todayKey()}`;
  }

  function getPrimarySelector() {
    const host = location.hostname;
    if (host.includes("chatgpt.com") || host.includes("chat.openai.com")) {
      return "textarea#prompt-textarea, textarea[data-id='root']";
    }
    if (host.includes("claude.ai")) {
      return "div[contenteditable='true'], textarea";
    }
    if (host.includes("gemini.google.com")) {
      return "textarea, div[contenteditable='true']";
    }
    return "textarea, div[contenteditable='true']";
  }

  function getMainInput() {
    const selector = getPrimarySelector();
    const nodes = Array.from(document.querySelectorAll(selector));
    if (!nodes.length) return null;
    const visible = nodes.filter((n) => n.offsetParent !== null);
    return visible[visible.length - 1] || nodes[0];
  }

  function readInputValue(el) {
    if (!el) return "";
    if (el.tagName === "TEXTAREA") return el.value || "";
    return el.innerText || "";
  }

  function setInputValue(el, value) {
    if (!el) return;
    if (el.tagName === "TEXTAREA") {
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }

    el.focus();
    document.execCommand("selectAll", false);
    document.execCommand("insertText", false, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function getMode() {
    return panel?.querySelector("#pqc-mode")?.value || "concise";
  }

  function refineContextFromPanel() {
    return {
      goal: panel.querySelector("#pqc-goal")?.value?.trim() || "Produce a practical, useful answer.",
      tone: panel.querySelector("#pqc-tone")?.value?.trim() || "Clear and professional.",
      constraints: panel.querySelector("#pqc-constraints")?.value?.trim() || "Be concise, avoid assumptions.",
      outputFormat: panel.querySelector("#pqc-format")?.value?.trim() || "Bullet list with short steps.",
    };
  }

  function createPanel() {
    panel = document.createElement("div");
    panel.className = "pqc-panel";
    panel.innerHTML = `
      <div class="pqc-header">Prompt QA Copilot</div>
      <div class="pqc-body">
        <div>Score</div>
        <div class="pqc-score" id="pqc-score">--</div>
        <div id="pqc-notes"></div>

        <div class="pqc-row">
          <span>Mode</span>
          <select id="pqc-mode" class="pqc-select">
            <option value="concise">Concise</option>
            <option value="detailed">Detailed</option>
            <option value="coder">Coder</option>
          </select>
        </div>

        <div class="pqc-refine">
          <label class="pqc-label" for="pqc-goal">Refine goal</label>
          <input id="pqc-goal" class="pqc-input" placeholder="e.g. Get a crisp launch plan" />

          <label class="pqc-label" for="pqc-tone">Tone</label>
          <input id="pqc-tone" class="pqc-input" value="Clear and professional" />

          <label class="pqc-label" for="pqc-constraints">Constraints</label>
          <textarea id="pqc-constraints" class="pqc-textarea">Be concise, avoid assumptions.</textarea>

          <label class="pqc-label" for="pqc-format">Output format</label>
          <input id="pqc-format" class="pqc-input" value="Bullet list with short steps." />
        </div>

        <div class="pqc-actions">
          <button class="pqc-btn" id="pqc-refresh">Analyze</button>
          <button class="pqc-btn" id="pqc-improve">Improve</button>
          <button class="pqc-btn" id="pqc-refine">Refine</button>
          <button class="pqc-btn" id="pqc-copy">Copy</button>
          <button class="pqc-btn" id="pqc-replace">Replace</button>
          <button class="pqc-btn" id="pqc-hide">Hide</button>
        </div>

        <div class="pqc-usage" id="pqc-usage">Daily free usage: --</div>
      </div>
    `;
    document.body.appendChild(panel);

    minBtn = document.createElement("button");
    minBtn.className = "pqc-min";
    minBtn.textContent = "Prompt QA";
    minBtn.style.display = "none";
    document.body.appendChild(minBtn);

    minBtn.addEventListener("click", () => {
      panel.style.display = "block";
      minBtn.style.display = "none";
    });

    panel.querySelector("#pqc-hide").addEventListener("click", () => {
      panel.style.display = "none";
      minBtn.style.display = "block";
    });

    panel.querySelector("#pqc-refresh").addEventListener("click", analyze);
    panel.querySelector("#pqc-improve").addEventListener("click", improve);
    panel.querySelector("#pqc-refine").addEventListener("click", refine);
    panel.querySelector("#pqc-copy").addEventListener("click", copyRewritten);
    panel.querySelector("#pqc-replace").addEventListener("click", replaceWithRewritten);
    panel.querySelector("#pqc-mode").addEventListener("change", analyze);

    updateUsageDisplay();
  }

  function analyze() {
    activeTextarea = getMainInput();
    if (!activeTextarea || !window.PromptAnalyzer) return;

    const result = window.PromptAnalyzer.scorePrompt(readInputValue(activeTextarea));
    panel.querySelector("#pqc-score").textContent = `${result.score}/100`;

    const notesEl = panel.querySelector("#pqc-notes");
    notesEl.innerHTML = "";
    (result.notes.length ? result.notes : ["Looks good. Try adding one example for better output."]).forEach((n) => {
      const div = document.createElement("div");
      div.className = "pqc-note";
      div.textContent = `• ${n}`;
      notesEl.appendChild(div);
    });
  }

  function incrementUsageAndCheckLimit(onAllowed) {
    const key = usageKey();
    chrome.storage.local.get([key], (data) => {
      const used = Number(data[key] || 0);
      if (used >= DAILY_FREE_LIMIT) {
        panel.querySelector("#pqc-notes").innerHTML =
          `<div class="pqc-note">• Daily free limit reached (${DAILY_FREE_LIMIT}). Upgrade hook can be connected next.</div>`;
        updateUsageDisplay();
        return;
      }

      const next = used + 1;
      chrome.storage.local.set({ [key]: next }, () => {
        updateUsageDisplay();
        onAllowed();
      });
    });
  }

  function updateUsageDisplay() {
    const key = usageKey();
    chrome.storage.local.get([key], (data) => {
      const used = Number(data[key] || 0);
      const left = Math.max(0, DAILY_FREE_LIMIT - used);
      const el = panel?.querySelector("#pqc-usage");
      if (!el) return;
      el.innerHTML = `Daily free usage: <span class="pqc-usage-strong">${used}/${DAILY_FREE_LIMIT}</span> · left ${left}`;
    });
  }

  function improve() {
    activeTextarea = getMainInput();
    if (!activeTextarea || !window.PromptAnalyzer) return;

    incrementUsageAndCheckLimit(() => {
      lastRewritten = window.PromptAnalyzer.rewritePrompt(readInputValue(activeTextarea), getMode());
      analyze();
    });
  }

  function refine() {
    activeTextarea = getMainInput();
    if (!activeTextarea || !window.PromptAnalyzer) return;

    incrementUsageAndCheckLimit(() => {
      lastRewritten = window.PromptAnalyzer.refinePrompt(
        readInputValue(activeTextarea),
        refineContextFromPanel(),
        getMode()
      );
      analyze();
    });
  }

  async function copyRewritten() {
    if (!lastRewritten) {
      improve();
      return;
    }

    try {
      await navigator.clipboard.writeText(lastRewritten);
      panel.querySelector("#pqc-notes").innerHTML = '<div class="pqc-note">• Rewritten prompt copied.</div>';
    } catch {
      panel.querySelector("#pqc-notes").innerHTML = '<div class="pqc-note">• Copy failed. Clipboard permission may be blocked.</div>';
    }
  }

  function replaceWithRewritten() {
    activeTextarea = getMainInput();
    if (!activeTextarea) return;

    if (!lastRewritten) {
      improve();
      return;
    }

    setInputValue(activeTextarea, lastRewritten);
    analyze();
  }

  const init = () => {
    if (!document.body) return;
    if (!panel) createPanel();
    analyze();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  setInterval(() => {
    if (panel && panel.style.display !== "none") {
      analyze();
      updateUsageDisplay();
    }
  }, 5000);
})();
