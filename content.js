// === CONFIG ===
const MIN_ARPU = 0.05; // $0.05 por player
const MAX_ARPU = 0.15; // $0.15 por player

// === FUNÇÃO DE CÁLCULO ===
function estimateIncome(players) {
  if (!players || isNaN(players)) return null;
  const low = Math.round(players * MIN_ARPU);
  const high = Math.round(players * MAX_ARPU);
  return `$${low.toLocaleString()} - $${high.toLocaleString()}`;
}

// === PARSE PLAYERS ===
function parsePlayers(text) {
  if (!text) return null;
  let s = String(text).replace(/\+/g, "").replace(/\u00A0/g, " ").trim().toUpperCase();
  s = s.replace(/[^0-9.,KMB\s]/g, "").replace(/\s+/g, "");
  if (!s) return null;

  const suffix = s.slice(-1);
  let multiplier = 1;
  let numericPart = s;

  if (suffix === "K") multiplier = 1e3;
  else if (suffix === "M") multiplier = 1e6;
  else if (suffix === "B") multiplier = 1e9;

  if (["K","M","B"].includes(suffix)) numericPart = s.slice(0, -1);
  numericPart = numericPart.replace(/,/g, ".");
  const num = parseFloat(numericPart);
  return isNaN(num) ? null : Math.round(num * multiplier);
}

// === INSERÇÃO DE ESTIMATIVA ===
function insertEstimateCard(element, players) {
  if (!element || element.querySelector(".income-estimate")) return;

  const wrapper = document.createElement("div");
  wrapper.className = "info-label income-estimate";
  wrapper.style.display = "flex";
  wrapper.style.alignItems = "center";
  wrapper.style.gap = "6px";

  const icon = document.createElement("img");
  icon.src = chrome.runtime.getURL("icons/money.png");
  icon.alt = "money";
  icon.width = 14;
  icon.height = 14;

  const text = document.createElement("span");
  text.textContent = estimateIncome(players) || "No estimated value...";

  wrapper.appendChild(icon);
  wrapper.appendChild(text);
  element.appendChild(wrapper);
}

function insertEstimateDetail(titleContainer, players) {
  if (!titleContainer || titleContainer.querySelector(".estimate-detail")) return;

  const wrapper = document.createElement("div");
  wrapper.className = "info-label estimate-detail";

  const icon = document.createElement("img");
  icon.src = chrome.runtime.getURL("icons/money.png");
  icon.alt = "money";
  icon.width = 18;
  icon.height = 18;
  icon.style.display = "inline-block";
  icon.style.marginRight = "8px";

  const text = document.createElement("span");
  text.className = "estimate-detail";
  text.textContent = estimateIncome(players) || "No estimated value...";

  wrapper.appendChild(icon);
  wrapper.appendChild(text);

  const cardName = titleContainer.parentElement.querySelector(".game-card-name");
  if (cardName) cardName.style.paddingBottom = "50px";

  titleContainer.appendChild(wrapper);
}

// === SCAN HOMEPAGE / CARDS ===
function scanHomepageCards() {
  document.querySelectorAll(".list-item.game-card").forEach(card => {
    const playersEl = card.querySelector(".playing-counts-label");
    const injCard = card.querySelector(".game-card-info");
    if (playersEl && injCard && !injCard.querySelector(".income-estimate")) {
      const players = parsePlayers(playersEl.textContent);
      insertEstimateDetail(injCard, players);
    }
  });
}

// === OBSERVER PÁGINA DE GAME ===
function observeGamePage() {
  // Interval para pegar players enquanto carrega
  const interval = setInterval(() => {
    const statEl = document.querySelector(".game-stat .text-lead");
    const titleContainer = document.querySelector(".game-title-container");
    const playButtonParent = document.querySelector(".btn-play-game, .play-button-container")?.parentElement;

    if (statEl) {
      const players = parsePlayers(statEl.textContent);

      if (titleContainer && !titleContainer.querySelector(".estimate-detail")) {
        insertEstimateDetail(titleContainer, players);
      }

      if (playButtonParent && !playButtonParent.querySelector(".income-estimate")) {
        insertEstimateDetail(playButtonParent, players);
      }

      clearInterval(interval);
    }
  }, 200);

  // Observer para mudanças dentro de .game-stat-container
  const statContainer = document.querySelector(".game-stat-container");
  if (statContainer) {
    const observer = new MutationObserver(() => {
      const statEl = statContainer.querySelector(".game-stat .text-lead");
      const titleContainer = document.querySelector(".game-title-container");
      if (statEl && titleContainer && !titleContainer.querySelector(".estimate-detail")) {
        const players = parsePlayers(statEl.textContent);
        insertEstimateDetail(titleContainer, players);
      }
    });
    observer.observe(statContainer, { childList: true, subtree: true });
  }
}

// === START OBSERVER ===
function startObserver() {
  // homepage / destaques
  scanHomepageCards();

  // página de jogo
  observeGamePage();

  // observer geral do body para detectar cards ou novas páginas
  const observer = new MutationObserver(() => {
    if (window.__robloxIncomeScanTimeout) clearTimeout(window.__robloxIncomeScanTimeout);
    window.__robloxIncomeScanTimeout = setTimeout(() => {
      scanHomepageCards();
      observeGamePage();
    }, 200);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// === START ===
startObserver();
