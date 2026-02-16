(function () {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("src/core/promptAnalyzer.js");
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);

  const DAILY_FREE_LIMIT = 20;
  const HISTORY_KEY = "promptHistory";
  const MAX_HISTORY = 30;

  let panel;
  let minBtn;
  let activeInput;
  let lastRewritten = "";
  let settings = {
    rewriteMode: "concise",
    checkoutUrl: "",
    backendBaseUrl: "",
    enabledChatgpt: true,
    enabledClaude: true,
    enabledGemini: true,
    enabledOther: true,
  };
  let installId = "";
  let license = { isActive: false, plan: "free" };

  function hostType() {
    const host = location.hostname;
    if (host.includes("chatgpt.com") || host.includes("chat.openai.com")) return "chatgpt";
    if (host.includes("claude.ai")) return "claude";
    if (host.includes("gemini.google.com")) return "gemini";
    return "other";
  }

  function isHostEnabled() {
    const type = hostType();
    if (type === "chatgpt") return !!settings.enabledChatgpt;
    if (type === "claude") return !!settings.enabledClaude;
    if (type === "gemini") return !!settings.enabledGemini;
    return !!settings.enabledOther;
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function usageKey() {
    return `usage:${todayKey()}`;
  }

  function getPrimarySelector() {
    const type = hostType();
    if (type === "chatgpt") return "textarea#prompt-textarea, textarea[data-id='root'], textarea";
    if (type === "claude") return "div[contenteditable='true'], textarea";
    if (type === "gemini") return "textarea, div[contenteditable='true']";
    return "textarea, div[contenteditable='true']";
  }

  function getMainInput() {
    const nodes = Array.from(document.querySelectorAll(getPrimarySelector()));
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
    return panel?.querySelector("#pqc-mode")?.value || settings.rewriteMode || "concise";
  }

  function refineContextFromPanel() {
    return {
      goal: panel.querySelector("#pqc-goal")?.value?.trim() || "Produce a practical, useful answer.",
      tone: panel.querySelector("#pqc-tone")?.value?.trim() || "Clear and professional.",
      constraints: panel.querySelector("#pqc-constraints")?.value?.trim() || "Be concise, avoid assumptions.",
      outputFormat: panel.querySelector("#pqc-format")?.value?.trim() || "Bullet list with short steps.",
    };
  }

  function saveHistoryItem(item) {
    chrome.storage.local.get([HISTORY_KEY], (data) => {
      const history = Array.isArray(data[HISTORY_KEY]) ? data[HISTORY_KEY] : [];
      history.unshift({ ...item, ts: Date.now() });
      chrome.storage.local.set({ [HISTORY_KEY]: history.slice(0, MAX_HISTORY) }, refreshHistoryList);
    });
  }

  function refreshHistoryList() {
    if (!panel) return;
    const select = panel.querySelector("#pqc-history");
    if (!select) return;

    chrome.storage.local.get([HISTORY_KEY], (data) => {
      const history = Array.isArray(data[HISTORY_KEY]) ? data[HISTORY_KEY] : [];
      select.innerHTML = '<option value="">Recent rewrites...</option>';
      history.forEach((h, idx) => {
        const option = document.createElement("option");
        option.value = String(idx);
        const label = `${new Date(h.ts).toLocaleTimeString()} · ${h.type}/${h.mode} · ${h.input.slice(0, 36).replace(/\n/g, " ")}`;
        option.textContent = label;
        select.appendChild(option);
      });
    });
  }

  function applyHistorySelection() {
    activeInput = getMainInput();
    if (!activeInput) return;
    const select = panel.querySelector("#pqc-history");
    if (!select || !select.value) return;

    chrome.storage.local.get([HISTORY_KEY], (data) => {
      const history = Array.isArray(data[HISTORY_KEY]) ? data[HISTORY_KEY] : [];
      const idx = Number(select.value);
      const item = history[idx];
      if (!item?.output) return;
      lastRewritten = item.output;
      setInputValue(activeInput, item.output);
      analyze();
    });
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

        <div class="pqc-row">
          <select id="pqc-history" class="pqc-select">
            <option value="">Recent rewrites...</option>
          </select>
          <button class="pqc-btn" id="pqc-apply-history">Apply</button>
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
          <button class="pqc-btn" id="pqc-upgrade">Upgrade</button>
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

    panel.querySelector("#pqc-mode").value = settings.rewriteMode || "concise";

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
    panel.querySelector("#pqc-apply-history").addEventListener("click", applyHistorySelection);
    panel.querySelector("#pqc-upgrade").addEventListener("click", openUpgrade);

    updateUsageDisplay();
    refreshHistoryList();
  }

  function openUpgrade() {
    const url = (settings.checkoutUrl || "").trim();
    if (!url) {
      panel.querySelector("#pqc-notes").innerHTML =
        '<div class="pqc-note">• No checkout URL set. Add Lemon Squeezy checkout URL in Options.</div>';
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function getOrCreateInstallId(cb) {
    chrome.storage.local.get(["installId"], (data) => {
      if (data.installId) {
        installId = data.installId;
        cb(installId);
        return;
      }
      const created = `pqc_${crypto.randomUUID()}`;
      chrome.storage.local.set({ installId: created }, () => {
        installId = created;
        cb(created);
      });
    });
  }

  function refreshLicenseStatus() {
    const base = (settings.backendBaseUrl || "").trim();
    if (!base || !installId) return;

    fetch(`${base.replace(/\/$/, "")}/api/license/status?userId=${encodeURIComponent(installId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("license status failed"))))
      .then((data) => {
        if (data?.license) {
          license = {
            isActive: !!data.license.isActive,
            plan: data.license.plan || (data.license.isActive ? "pro" : "free"),
          };
          updateUsageDisplay();
        }
      })
      .catch(() => {
        // silent - fallback to free mode
      });
  }

  function analyze() {
    activeInput = getMainInput();
    if (!activeInput || !window.PromptAnalyzer) return;

    const result = window.PromptAnalyzer.scorePrompt(readInputValue(activeInput));
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
    if (license.isActive || license.plan === "pro") {
      onAllowed();
      return;
    }

    const key = usageKey();
    chrome.storage.local.get([key], (data) => {
      const used = Number(data[key] || 0);
      if (used >= DAILY_FREE_LIMIT) {
        const hasCheckout = !!(settings.checkoutUrl || "").trim();
        panel.querySelector("#pqc-notes").innerHTML = `<div class="pqc-note">• Daily free limit reached (${DAILY_FREE_LIMIT}). ${
          hasCheckout ? "Use Upgrade to continue." : "Set checkout URL in Options to connect billing."
        }</div>`;
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

      if (license.isActive || license.plan === "pro") {
        el.innerHTML = `Plan: <span class="pqc-usage-strong">PRO</span> · unlimited`;
        return;
      }

      el.innerHTML = `Plan: Free · Daily usage: <span class="pqc-usage-strong">${used}/${DAILY_FREE_LIMIT}</span> · left ${left}`;
    });
  }

  function improve() {
    activeInput = getMainInput();
    if (!activeInput || !window.PromptAnalyzer) return;

    const input = readInputValue(activeInput);
    incrementUsageAndCheckLimit(() => {
      const mode = getMode();
      lastRewritten = window.PromptAnalyzer.rewritePrompt(input, mode);
      saveHistoryItem({ type: "improve", mode, input, output: lastRewritten });
      analyze();
    });
  }

  function refine() {
    activeInput = getMainInput();
    if (!activeInput || !window.PromptAnalyzer) return;

    const input = readInputValue(activeInput);
    const context = refineContextFromPanel();
    incrementUsageAndCheckLimit(() => {
      const mode = getMode();
      lastRewritten = window.PromptAnalyzer.refinePrompt(input, context, mode);
      saveHistoryItem({ type: "refine", mode, input, output: lastRewritten });
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
    activeInput = getMainInput();
    if (!activeInput) return;

    if (!lastRewritten) {
      improve();
      return;
    }

    setInputValue(activeInput, lastRewritten);
    analyze();
  }

  function loadSettings(cb) {
    chrome.storage.sync.get(
      ["rewriteMode", "checkoutUrl", "backendBaseUrl", "enabledChatgpt", "enabledClaude", "enabledGemini", "enabledOther"],
      (data) => {
        settings = {
          rewriteMode: data.rewriteMode || "concise",
          checkoutUrl: data.checkoutUrl || "",
          backendBaseUrl: data.backendBaseUrl || "",
          enabledChatgpt: data.enabledChatgpt !== false,
          enabledClaude: data.enabledClaude !== false,
          enabledGemini: data.enabledGemini !== false,
          enabledOther: data.enabledOther !== false,
        };
        cb();
      }
    );
  }

  const init = () => {
    if (!document.body || !isHostEnabled()) return;
    if (!panel) createPanel();
    analyze();
  };

  loadSettings(() => {
    getOrCreateInstallId(() => {
      refreshLicenseStatus();

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

      setInterval(refreshLicenseStatus, 60000);
    });
  });
})();
