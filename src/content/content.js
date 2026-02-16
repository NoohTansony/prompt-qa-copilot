(function () {
  const WORKER_BASE_URL = "https://prompt-qa-copilot.nooh-tansony.workers.dev";
  const MODE = "concise";

  const Formatter = {
    improve(text) {
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
    },
  };

  let panel;
  let miniBtn;
  let activeInput;
  let improvedText = "";
  let installId = "";

  function getInput() {
    const nodes = Array.from(document.querySelectorAll("textarea, div[contenteditable='true']"));
    if (!nodes.length) return null;
    const visible = nodes.filter((n) => n.offsetParent !== null);
    return visible[visible.length - 1] || nodes[0];
  }

  function readValue(el) {
    if (!el) return "";
    if (el.tagName === "TEXTAREA") return el.value || "";
    return el.innerText || "";
  }

  function writeValue(el, value) {
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

  function ensureInstallId(cb) {
    chrome.storage.local.get(["installId"], (data) => {
      if (data.installId) {
        installId = data.installId;
        cb();
        return;
      }
      const created = `pqc_${crypto.randomUUID()}`;
      chrome.storage.local.set({ installId: created }, () => {
        installId = created;
        cb();
      });
    });
  }

  async function improveViaServer(text) {
    const res = await fetch(`${WORKER_BASE_URL}/api/prompt/improve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: installId, text, mode: MODE }),
    });

    if (!res.ok) throw new Error(`server ${res.status}`);
    const data = await res.json();
    if (!data?.output) throw new Error("empty output");
    return data.output;
  }

  function setStatus(msg) {
    const el = panel?.querySelector("#pqc-status");
    if (el) el.textContent = msg;
  }

  function renderPanel() {
    panel = document.createElement("div");
    panel.className = "pqc-panel";
    panel.innerHTML = `
      <div class="pqc-header">Prompt QA (Minimal)</div>
      <div class="pqc-body">
        <div id="pqc-status" class="pqc-note">Press Improve to generate formatted prompt.</div>
        <div class="pqc-actions">
          <button class="pqc-btn" id="pqc-improve">Improve</button>
          <button class="pqc-btn" id="pqc-replace">Replace</button>
          <button class="pqc-btn" id="pqc-hide">Hide</button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    miniBtn = document.createElement("button");
    miniBtn.className = "pqc-min";
    miniBtn.textContent = "Prompt QA";
    miniBtn.style.display = "none";
    document.body.appendChild(miniBtn);

    panel.querySelector("#pqc-improve").addEventListener("click", async () => {
      activeInput = getInput();
      if (!activeInput) return;

      const text = readValue(activeInput);
      if (!text.trim()) {
        setStatus("Input is empty.");
        return;
      }

      setStatus("Improving...");
      try {
        improvedText = await improveViaServer(text);
        setStatus("Improved prompt ready (server). Click Replace.");
      } catch {
        improvedText = Formatter.improve(text);
        setStatus("Improved prompt ready (local fallback). Click Replace.");
      }
    });

    panel.querySelector("#pqc-replace").addEventListener("click", () => {
      activeInput = getInput();
      if (!activeInput) return;
      if (!improvedText) {
        setStatus("Press Improve first.");
        return;
      }

      writeValue(activeInput, improvedText);
      setStatus("Replaced.");
    });

    panel.querySelector("#pqc-hide").addEventListener("click", () => {
      panel.style.display = "none";
      miniBtn.style.display = "block";
    });

    miniBtn.addEventListener("click", () => {
      panel.style.display = "block";
      miniBtn.style.display = "none";
    });
  }

  function init() {
    if (!document.body) return;
    if (!panel) renderPanel();
  }

  ensureInstallId(() => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  });
})();
