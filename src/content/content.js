(function () {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("src/core/promptAnalyzer.js");
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);

  let panel;
  let minBtn;
  let activeTextarea;
  let lastRewritten = "";

  function getMainTextarea() {
    const textareas = Array.from(document.querySelectorAll("textarea"));
    if (!textareas.length) return null;
    const visible = textareas.filter((t) => t.offsetParent !== null);
    return visible[visible.length - 1] || textareas[0];
  }

  function getMode() {
    return panel?.querySelector("#pqc-mode")?.value || "concise";
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

        <div class="pqc-actions">
          <button class="pqc-btn" id="pqc-refresh">Analyze</button>
          <button class="pqc-btn" id="pqc-improve">Improve</button>
          <button class="pqc-btn" id="pqc-refine">Refine</button>
          <button class="pqc-btn" id="pqc-copy">Copy</button>
          <button class="pqc-btn" id="pqc-replace">Replace</button>
          <button class="pqc-btn" id="pqc-hide">Hide</button>
        </div>
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
  }

  function analyze() {
    activeTextarea = getMainTextarea();
    if (!activeTextarea || !window.PromptAnalyzer) return;

    const result = window.PromptAnalyzer.scorePrompt(activeTextarea.value);
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

  function improve() {
    activeTextarea = getMainTextarea();
    if (!activeTextarea || !window.PromptAnalyzer) return;

    lastRewritten = window.PromptAnalyzer.rewritePrompt(activeTextarea.value, getMode());
    analyze();
  }

  function askRefineContext() {
    const goal = window.prompt("Refine: What is the primary goal?", "Produce a practical, useful answer.");
    if (goal === null) return null;
    const tone = window.prompt("Refine: Desired tone?", "Clear and professional.");
    if (tone === null) return null;
    const constraints = window.prompt("Refine: Any constraints?", "Be concise, avoid assumptions.");
    if (constraints === null) return null;
    const outputFormat = window.prompt("Refine: Output format?", "Bullet list with short steps.");
    if (outputFormat === null) return null;

    return { goal, tone, constraints, outputFormat };
  }

  function refine() {
    activeTextarea = getMainTextarea();
    if (!activeTextarea || !window.PromptAnalyzer) return;

    const context = askRefineContext();
    if (!context) return;

    lastRewritten = window.PromptAnalyzer.refinePrompt(activeTextarea.value, context, getMode());
    analyze();
  }

  async function copyRewritten() {
    if (!lastRewritten) {
      improve();
    }
    if (!lastRewritten) return;

    try {
      await navigator.clipboard.writeText(lastRewritten);
      panel.querySelector("#pqc-notes").innerHTML = '<div class="pqc-note">• Rewritten prompt copied.</div>';
    } catch {
      panel.querySelector("#pqc-notes").innerHTML = '<div class="pqc-note">• Copy failed. Clipboard permission may be blocked.</div>';
    }
  }

  function replaceWithRewritten() {
    activeTextarea = getMainTextarea();
    if (!activeTextarea) return;

    if (!lastRewritten) {
      improve();
    }
    if (!lastRewritten) return;

    activeTextarea.value = lastRewritten;
    activeTextarea.dispatchEvent(new Event("input", { bubbles: true }));
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
    if (panel && panel.style.display !== "none") analyze();
  }, 4000);
})();
