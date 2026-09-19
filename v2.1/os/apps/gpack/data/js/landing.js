// ============================================================================
// landing.js
// Логика главной страницы: печатающийся заголовок и подключение Firebase
// (аналитика инициализируется через сам факт импорта firebase-init.js).
// ============================================================================

import "./firebase-init.js";

function typeHeadline() {
  const el = document.getElementById("typedHeadline");
  if (!el) return;
  const full = el.dataset.text || el.textContent.trim();
  el.textContent = "";

  const cursor = document.createElement("span");
  cursor.className = "typed-cursor";
  cursor.textContent = "\u00A0";

  let i = 0;
  const speed = 55;

  function step() {
    if (i <= full.length) {
      el.textContent = full.slice(0, i);
      el.appendChild(cursor);
      i += 1;
      window.setTimeout(step, speed);
    }
  }
  step();
}

document.addEventListener("DOMContentLoaded", typeHeadline);
