// === CONFIG ===
const MIN_ARPU = 0.05; // $0.05 por player
const MAX_ARPU = 0.15; // $0.15 por player

// === FUNÇÃO DE CÁLCULO ===
function estimateIncome(players) {
  if (!players || isNaN(players)) return null;

  // estimativa mensal simples
  const low = Math.round(players * MIN_ARPU);
  const high = Math.round(players * MAX_ARPU);
  return `$${low.toLocaleString()} - $${high.toLocaleString()}`;
}

// === FUNÇÃO: PARSE PLAYERS (robusta) ===
function parsePlayers(text) {
  if (!text) return null;

  // remove "+" e normaliza espaços (inclui NBSP)
  let s = String(text).replace(/\+/g, "").replace(/\u00A0/g, " ").trim().toUpperCase();
  // remove palavras extras e deixa só números, ., K M B e spaces
  s = s.replace(/[^0-9.,KMB\s]/g, "");
  // remove espaços para simplificar (ex: "2 460 299" -> "2460299")
  s = s.replace(/\s+/g, "");

  if (!s) return null;

  // detecta sufixo K/M/B
  const suffix = s.slice(-1);
  let multiplier = 1;
  let numericPart = s;

  if (suffix === "K" || suffix === "M" || suffix === "B") {
    numericPart = s.slice(0, -1);
    if (suffix === "K") multiplier = 1e3;
    if (suffix === "M") multiplier = 1e6;
    if (suffix === "B") multiplier = 1e9;
  }

  // troca vírgula por ponto, remove milhares e parseFloat
  numericPart = numericPart.replace(/,/g, ".");
  const num = parseFloat(numericPart);
  if (isNaN(num)) return null;
  return Math.round(num * multiplier);
}

// === INSERÇÃO NO CARD (homepage) ===
function insertEstimateCard(element, players) {
  if (!element || element.querySelector(".income-estimate")) return;

  const wrapper = document.createElement("div");
  wrapper.className = "info-label income-estimate"; // usa classe do roblox pra camuflar
  wrapper.style.display = "flex";
  wrapper.style.alignItems = "center";
  wrapper.style.gap = "6px";

  const icon = document.createElement("img");
  icon.src = chrome.runtime.getURL("icons/money.png");
  icon.alt = "money";
  icon.width = 14;
  icon.height = 14;
  icon.style.display = "inline-block";

  const text = document.createElement("span");
  const income = estimateIncome(players);
  text.textContent = income ? `${income}` : "No estimated value...";

  wrapper.appendChild(icon);
  wrapper.appendChild(text);

  // Append: em cards (game-card-info) funciona bem se for appended ao fim
  element.appendChild(wrapper);
}

// === INSERÇÃO NA PÁGINA DE DETALHE (game page) ===
function insertEstimateDetail(titleContainer, players) {
  if (!titleContainer || titleContainer.querySelector(".estimate-detail")) return;

  const wrapper = document.createElement("div");
  wrapper.className = "info-label estimate-detail";
  // conteúdo
  const icon = document.createElement("img");
  icon.src = chrome.runtime.getURL("icons/money.png");
  icon.alt = "money";
  icon.width = 18;
  icon.height = 18;
  icon.style.display = "inline-block";
  icon.style.marginRight = "8px";

  const text = document.createElement("span");
  text.className = "estimate-detail";
  const income = estimateIncome(players);
  text.textContent = income ? `${income}` : "No estimated value...";

  wrapper.appendChild(icon);
  wrapper.appendChild(text);

  // colocar no fim do titleContainer (fica ao lado do creator etc)
  // Se preferir em outra posição, troque appendChild por insertBefore.
  titleContainer.appendChild(wrapper);
}

// === SCAN ÚNICO (procura em todos os lugares relevantes) ===
function runScan() {
  // 1) Homepage cards
  document.querySelectorAll(".list-item.game-card").forEach(card => {
    const playersEl = card.querySelector(".playing-counts-label");
    const injCard = card.querySelector(".game-card-info");
    if (playersEl && injCard && !injCard.querySelector(".income-estimate")) {
      const players = parsePlayers(playersEl.textContent);
      insertEstimateDetail(injCard, players);
    }
  });

  // 2) Página de jogo - area de estatísticas (ex: quando abre a página principal do jogo)
  // tenta pegar o container de estatísticas (a estrutura que você mostrou)
  const statContainer = document.querySelector(".game-stat-container, .border-top.border-bottom.game-stat-container");
  if (statContainer) {
    // normalmente o primeiro .game-stat é o "active/playing" — usamos a primeira occurrence
    const firstStat = statContainer.querySelector(".game-stat .text-lead, .game-stat p.text-lead");
    if (firstStat) {
      const players = parsePlayers(firstStat.textContent);
      // onde colocar? vamos colocar dentro do .game-title-container
      const titleContainer = document.querySelector(".game-title-container");
      if (titleContainer && !titleContainer.querySelector(".income-estimate-detail")) {
        insertEstimateDetail(titleContainer, players);
      }
      // também, para compatibilidade, tenta inserir perto do play button se existir
      const playButton = document.querySelector(".btn-play-game, .play-button-container");
      if (playButton && !playButton.parentElement.querySelector(".income-estimate")) {
        insertEstimateDetail(playButton.parentElement, players);
      }
    }
  }

  // 3) Caso a página de jogo use outra estrutura (fallback para seletor genérico que já usávamos)
  const statElGeneric = document.querySelector(".game-stat .text-lead");
  if (statElGeneric) {
    const players = parsePlayers(statElGeneric.textContent);
    const playButton = document.querySelector(".btn-play-game, .play-button-container");
    if (playButton && !playButton.parentElement.querySelector(".income-estimate")) {
      insertEstimateCard(playButton.parentElement, players);
    }
  }
}

// === OBSERVER ===
function startObserver() {
  runScan(); // scan inicial rápido
  const observer = new MutationObserver((mutations) => {
    // Debounce simples: small delay para agrupar mutações pesadas
    if (window.__robloxIncomeScanTimeout) clearTimeout(window.__robloxIncomeScanTimeout);
    window.__robloxIncomeScanTimeout = setTimeout(() => {
      runScan();
    }, 150);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// === START ===
startObserver();