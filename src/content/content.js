(function () {
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

    panel.querySelector("#pqc-improve").addEventListener("click", () => {
      activeInput = getInput();
      if (!activeInput) return;

      improvedText = Formatter.improve(readValue(activeInput));
      if (!improvedText) {
        panel.querySelector("#pqc-status").textContent = "Input is empty.";
        return;
      }

      panel.querySelector("#pqc-status").textContent = "Improved prompt ready. Click Replace.";
    });

    panel.querySelector("#pqc-replace").addEventListener("click", () => {
      activeInput = getInput();
      if (!activeInput) return;
      if (!improvedText) {
        panel.querySelector("#pqc-status").textContent = "Press Improve first.";
        return;
      }

      writeValue(activeInput, improvedText);
      panel.querySelector("#pqc-status").textContent = "Replaced.";
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
