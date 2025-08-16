// === CONFIG ===
const MIN_ARPU = 0.05;
const MAX_ARPU = 0.15;

// === FUNÇÃO DE CÁLCULO ===
function estimateIncome(players) {
  if (!players || isNaN(players)) return null;
  const low = Math.round(players * MIN_ARPU);
  const high = Math.round(players * MAX_ARPU);
  return `$${low.toLocaleString()} - $${high.toLocaleString()}`;
}

// Função auxiliar para parse numérico robusto (fixado para formato US-like)
function parseNumeric(numericPart, isFromTitle) {
  // Para title: remove tudo não-dígito, parseInt
  if (isFromTitle) {
    const cleaned = numericPart.replace(/[^0-9]/g, '');
    return parseInt(cleaned, 10);
  } else {
    // Para textContent: remove ',' (thousandSep), mantém '.' como decimal, parseFloat
    const parsedStr = numericPart.replace(/,/g, '');
    return parseFloat(parsedStr);
  }
}

// === PARSE PARA HOMEPAGE / DESTAQUES ===
function parsePlayersHighlights(text) {
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
  
  const num = parseNumeric(numericPart, false);
  return isNaN(num) ? null : Math.round(num * multiplier);
}

// === PARSE PARA PÁGINA DE JOGO ===
function parsePlayersGamePage(el) {
  if (!el) return null;

  const title = el.getAttribute("title");
  const textContent = el.textContent;

  let text = title || textContent;
  if (!text) return null;

  text = text.replace(/\+/g, "").replace(/\u00A0/g, " ").trim().toUpperCase();
  text = text.replace(/[^0-9.,KMB\s]/g, "").replace(/\s+/g, "");
  if (!text) return null;

  const suffix = text.slice(-1);
  let multiplier = 1;
  let numericPart = text;

  if (suffix === "K") multiplier = 1e3;
  else if (suffix === "M") multiplier = 1e6;
  else if (suffix === "B") multiplier = 1e9;

  if (["K","M","B"].includes(suffix)) numericPart = text.slice(0, -1);
  
  const num = parseNumeric(numericPart, !!title);
  return isNaN(num) ? null : Math.round(num * multiplier);
}

// === INSERÇÃO DE ESTIMATIVA ===
function insertEstimateDetail(titleContainer, players) {
  if (!titleContainer || !players) return;

  let wrapper = titleContainer.querySelector(".estimate-detail");
  if (!wrapper) {
    wrapper = document.createElement("div");
    wrapper.className = "info-label estimate-detail";
    wrapper.style.display = "flex";
    wrapper.style.alignItems = "center";
    wrapper.style.marginTop = "4px";

    const icon = document.createElement("img");
    icon.src = chrome.runtime.getURL("icons/money.png");
    icon.alt = "money";
    icon.width = 18;
    icon.height = 18;
    icon.style.display = "inline-block";
    icon.style.marginRight = "8px";

    const text = document.createElement("span");
    text.className = "estimate-detail";

    wrapper.appendChild(icon);
    wrapper.appendChild(text);
    titleContainer.appendChild(wrapper);

    const cardName = titleContainer.parentElement.querySelector(".game-card-name");
    if (cardName) cardName.style.paddingBottom = "50px";
  }

  wrapper.querySelector("span").textContent = estimateIncome(players);
}

function insertEstimateCard(element, players) {
  if (!element || !players || element.querySelector(".income-estimate")) return;

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
  text.textContent = estimateIncome(players);

  wrapper.appendChild(icon);
  wrapper.appendChild(text);
  element.appendChild(wrapper);
}

// === SCAN HOMEPAGE / DESTAQUES ===
function scanHomepageCards() {
  document.querySelectorAll(".list-item.game-card").forEach(card => {
    const playersEl = card.querySelector(".playing-counts-label");
    const injCard = card.querySelector(".game-card-info");
    if (playersEl && injCard) {
      const players = parsePlayersHighlights(playersEl.textContent);
      if (players) insertEstimateDetail(injCard, players);
    }
  });
}

// === DYNAMIC GAME PAGE COM OBSERVER PARA ATIVOS ===
function startDynamicGamePage() {
  const statEl = document.querySelector(".game-stat:first-child .text-lead"); // Mais específico para "Ativo"
  if (!statEl) return;

  let retryCount = 0;
  let lastPlayers = null;
  let stableCount = 0;
  const maxRetries = 10;
  let debounceTimer = null;

  const update = () => {
    const players = parsePlayersGamePage(statEl);
    const title = statEl.getAttribute("title") || '';
    const textClean = statEl.textContent.replace(/[^0-9]/g, '');
    const titleClean = title.replace(/[^0-9]/g, '');

    if (!players || players < 100 || (title && textClean !== titleClean)) {
      if (retryCount < maxRetries) {
        retryCount++;
        setTimeout(update, 1000); // Atraso maior
      }
      return;
    }

    // Verifica estabilização
    if (players === lastPlayers) {
      stableCount++;
      if (stableCount >= 2) { // Estável por 2 chamadas
        const titleContainer = document.querySelector(".game-title-container");
        const playButtonParent = document.querySelector(".btn-play-game, .play-button-container")?.parentElement;

        if (titleContainer) insertEstimateDetail(titleContainer, players);
        if (playButtonParent) insertEstimateDetail(playButtonParent, players);
        return;
      }
    } else {
      stableCount = 0;
    }
    lastPlayers = players;

    setTimeout(update, 1000); // Continua checando
  };

  // Debounce para observer
  const debouncedUpdate = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      retryCount = 0;
      stableCount = 0;
      update();
    }, 500); // Aumentado para reduzir chamadas
  };

  update(); // primeira chamada

  const mo = new MutationObserver(debouncedUpdate);
  mo.observe(statEl, { childList: true, subtree: true, characterData: true, attributes: true });
}

// === SPA URL CHANGE ===
let lastURL = location.href;
setInterval(() => {
  if (location.href !== lastURL) {
    lastURL = location.href;
    scanHomepageCards();
    startDynamicGamePage();
  }
}, 1000);

// === OBSERVER GLOBAL ===
const observer = new MutationObserver(() => {
  if (window.__robloxIncomeScanTimeout) clearTimeout(window.__robloxIncomeScanTimeout);
  window.__robloxIncomeScanTimeout = setTimeout(() => {
    scanHomepageCards();
    startDynamicGamePage();
  }, 200);
});
observer.observe(document.body, { childList: true, subtree: true });

// === START ===
scanHomepageCards();
startDynamicGamePage();