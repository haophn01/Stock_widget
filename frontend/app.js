/* ============================================================
   SmartStock Monitor - Final Complete app.js
   Includes:
   - WebSocket live prices
   - Mock feed fallback
   - Chart.js theme-aware chart
   - Light/Dark toggle
   - Load alert rules
   - Load recent alerts
   - NEW: Recent Alerts LIVE from table price flashes
   ============================================================ */

// =========================
// CONFIG
// =========================

const API_BASE_URL = "http://127.0.0.1:8000";
const WS_URL = "ws://127.0.0.1:8000/ws/prices";
const TRACKED_SYMBOLS = ["AAPL", "TSLA", "NVDA", "MSFT"];

// =========================
// STATE
// =========================

let latestPrices = {};
let chart = null;
let chartSymbol = "AAPL";
let chartHistory = [];
let usingMockFeed = false;

// =========================
// DOM REFERENCES
// =========================

const wsStatusPill = document.getElementById("ws-status-pill");
const stocksTableBody = document.getElementById("stocks-table-body");
const recentAlertsContainer = document.getElementById("recent-alerts-list");
const alertRulesList = document.getElementById("alert-rules-list");
const chartSymbolLabel = document.getElementById("chart-symbol-label");
const themeToggleBtn = document.getElementById("theme-toggle");

// =========================
// THEME HANDLING
// =========================

function refreshChartColors() {
  if (!chart) return;
  const canvas = document.getElementById("price-chart");
  if (!canvas) return;

  const styles = getComputedStyle(canvas);
  chart.data.datasets[0].borderColor = styles.getPropertyValue("--chart-line").trim();
  chart.data.datasets[0].backgroundColor = styles.getPropertyValue("--chart-fill").trim();
  chart.options.scales.x.ticks.color = styles.getPropertyValue("--chart-ticks").trim();
  chart.options.scales.y.ticks.color = styles.getPropertyValue("--chart-ticks").trim();
  chart.options.scales.y.grid.color = styles.getPropertyValue("--chart-grid").trim();
  chart.update("none");
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeToggleBtn.textContent = theme === "dark" ? "Dark Mode" : "Light Mode";
  refreshChartColors();
}

function initTheme() {
  const saved = localStorage.getItem("theme") || "dark";
  applyTheme(saved);

  themeToggleBtn.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
    localStorage.setItem("theme", next);
  });
}

// =========================
// STATUS PILL
// =========================

function setWsStatus(state, text) {
  wsStatusPill.classList.remove("pill-connected", "pill-disconnected");
  wsStatusPill.classList.add(state === "connected" ? "pill-connected" : "pill-disconnected");
  wsStatusPill.textContent = text;
}

function formatTime(ts) {
  const d = ts ? new Date(ts) : new Date();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// =========================
// STOCK TABLE
// =========================

function renderStocksTable() {
  stocksTableBody.innerHTML = "";

  TRACKED_SYMBOLS.forEach((symbol) => {
    const data = latestPrices[symbol];
    if (!data) return;

    const tr = document.createElement("tr");
    if (symbol === chartSymbol) tr.classList.add("row-selected");

    const up = data.change >= 0;
    const cls = up ? "price-up" : "price-down";
    const sign = up ? "+" : "";

    tr.innerHTML = `
      <td>${symbol}</td>
      <td>${data.price.toFixed(2)}</td>
      <td class="${cls}">${sign}${data.change.toFixed(2)}</td>
      <td class="${cls}">${sign}${data.percentChange.toFixed(2)}%</td>
      <td>${formatTime(data.ts)}</td>
    `;

    tr.addEventListener("click", () => {
      chartSymbol = symbol;
      chartHistory = [];
      chartSymbolLabel.textContent = symbol;
      renderStocksTable();
      updateChart();
    });

    stocksTableBody.appendChild(tr);
  });
}

// =========================
// RECENT ALERTS (UI)
// =========================

function addRecentAlert(symbol, direction, price, ts = null) {
  const placeholder = recentAlertsContainer.querySelector("[data-placeholder]");
  if (placeholder) recentAlertsContainer.innerHTML = "";

  const div = document.createElement("div");
  div.className = "alert-item";

  const t = ts ? formatTime(ts) : formatTime();

  div.innerHTML = `
    <div class="alert-symbol">${symbol}</div>
    <div class="alert-meta">
      ${symbol} moved ${direction} to <strong>${price.toFixed(2)}</strong> @ ${t}
    </div>
  `;

  recentAlertsContainer.prepend(div);

  while (recentAlertsContainer.children.length > 6) {
    recentAlertsContainer.removeChild(recentAlertsContainer.lastChild);
  }
}

// =========================
// CHART
// =========================

function initChart() {
  const canvas = document.getElementById("price-chart");
  const ctx = canvas.getContext("2d");
  const styles = getComputedStyle(canvas);

  chart = new Chart(ctx, {
    type: "line",
    data: { labels: [], datasets: [{ data: [], tension: 0.25, borderWidth: 3, borderColor: styles.getPropertyValue("--chart-line"), backgroundColor: styles.getPropertyValue("--chart-fill"), pointRadius: 0 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: styles.getPropertyValue("--chart-ticks") }, grid: { display: false } },
        y: { ticks: { color: styles.getPropertyValue("--chart-ticks") }, grid: { color: styles.getPropertyValue("--chart-grid") } },
      },
      plugins: { legend: { display: false } },
    },
  });
}

function updateChart() {
  const data = latestPrices[chartSymbol];
  if (!data) return;

  chartHistory.push({ ts: data.ts, price: data.price });
  if (chartHistory.length > 20) chartHistory.shift();

  chart.data.labels = chartHistory.map((p) => formatTime(p.ts));
  chart.data.datasets[0].data = chartHistory.map((p) => p.price);
  chart.update();
}

// =========================
// API: Load Alert Rules
// =========================

async function loadAlertRules() {
  try {
    const res = await fetch(`${API_BASE_URL}/alerts/rules`);
    if (!res.ok) throw new Error();

    const rules = await res.json();
    alertRulesList.innerHTML = "";

    rules.forEach((rule) => {
      const li = document.createElement("li");
      li.className = "alert-rule-item";

      li.innerHTML = `
        <div class="rule-symbol">${rule.symbol} ${rule.operator.toUpperCase()} ${rule.threshold}</div>
        <div class="rule-meta">Active · WebEx notifications · #${rule.id}</div>
      `;

      alertRulesList.appendChild(li);
    });
  } catch (err) {
    alertRulesList.innerHTML = `<li class="rule-meta">Failed to load rules.</li>`;
  }
}

// =========================
// API: Load Recent Alerts (initial)
// =========================

async function loadRecentAlerts() {
  try {
    const res = await fetch(`${API_BASE_URL}/alerts/recent`);
    if (!res.ok) return;

    const alerts = await res.json();
    recentAlertsContainer.innerHTML = "";

    alerts.forEach((a) => {
      addRecentAlert(a.symbol, a.direction || "moved", a.price, a.triggered_at);
    });
  } catch {}
}

// =========================
// WEBSOCKET HANDLING
// =========================

function connectWebSocket() {
  const socket = new WebSocket(WS_URL);

  socket.onopen = () => {
    usingMockFeed = false;
    setWsStatus("connected", "Live data: connected");
  };

  socket.onmessage = (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }

    if (msg.type !== "price_update") return;

    msg.data.forEach((item) => {
      const prev = latestPrices[item.symbol];
      latestPrices[item.symbol] = item;

      // Live recent alerts via table flash replacement
      if (prev && Math.abs(item.price - prev.price) >= 1.5) {
        addRecentAlert(
          item.symbol,
          item.price > prev.price ? "up" : "down",
          item.price
        );
      }
    });

    renderStocksTable();
    updateChart();
  };

  socket.onerror = socket.onclose = () => {
    if (!usingMockFeed) startMockFeed();
  };
}

// =========================
// MOCK FEED
// =========================

function startMockFeed() {
  usingMockFeed = true;
  setWsStatus("error", "Live data: mock demo");

  if (Object.keys(latestPrices).length === 0) {
    const now = new Date().toISOString();
    TRACKED_SYMBOLS.forEach((sym) => {
      latestPrices[sym] = {
        symbol: sym,
        price: 100,
        change: 0,
        percentChange: 0,
        ts: now,
      };
    });
  }

  setInterval(() => {
    const now = new Date().toISOString();

    TRACKED_SYMBOLS.forEach((sym) => {
      const prev = latestPrices[sym];
      const delta = (Math.random() - 0.5) * 4;
      const newPrice = Math.max(1, prev.price + delta);
      const change = newPrice - prev.price;

      latestPrices[sym] = {
        symbol: sym,
        price: newPrice,
        change,
        percentChange: (change / prev.price) * 100,
        ts: now,
      };

      if (Math.abs(change) >= 1.5) {
        addRecentAlert(sym, change > 0 ? "up" : "down", newPrice);
      }
    });

    renderStocksTable();
    updateChart();
  }, 2500);
}

// =========================
// INIT
// =========================

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initChart();

  chartSymbolLabel.textContent = chartSymbol;

  // Load from API
  loadAlertRules();
  loadRecentAlerts();

  // Live data
  connectWebSocket();
});
