(function () {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("src/core/promptAnalyzer.js");
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);

  let panel;
  let minBtn;
  let activeTextarea;

  function getMainTextarea() {
    const textareas = Array.from(document.querySelectorAll("textarea"));
    if (!textareas.length) return null;
    const visible = textareas.filter((t) => t.offsetParent !== null);
    return visible[visible.length - 1] || textareas[0];
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
        <div class="pqc-actions">
          <button class="pqc-btn" id="pqc-refresh">Analyze</button>
          <button class="pqc-btn" id="pqc-rewrite">Rewrite</button>
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
    panel.querySelector("#pqc-rewrite").addEventListener("click", rewrite);
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

  function rewrite() {
    activeTextarea = getMainTextarea();
    if (!activeTextarea || !window.PromptAnalyzer) return;

    const rewritten = window.PromptAnalyzer.rewritePrompt(activeTextarea.value, "concise");
    activeTextarea.value = rewritten;
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
