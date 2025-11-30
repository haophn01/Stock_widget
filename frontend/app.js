/* ============================================================
   SmartStock Monitor - Final app.js (Option 1: Rule-based alerts)
   - WebSocket live prices
   - Mock feed fallback
   - Chart.js theme-aware chart
   - Light/Dark toggle
   - Alert Rules loading
   - Recent Alerts loaded from backend /alerts/events every 5s
   ============================================================ */

// =========================
// CONFIG
// =========================

const API_BASE_URL = "http://127.0.0.1:8000";
const WS_URL = "ws://127.0.0.1:8000/ws/prices";
const TRACKED_SYMBOLS = ["AAPL", "TSLA", "NVDA", "MSFT", "BTC / USD"];

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
const recentAlertsContainer = document.getElementById("recent-alerts");
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

  chart.data.datasets[0].borderColor = styles
    .getPropertyValue("--chart-line")
    .trim();
  chart.data.datasets[0].backgroundColor = styles
    .getPropertyValue("--chart-fill")
    .trim();
  chart.options.scales.x.ticks.color = styles
    .getPropertyValue("--chart-ticks")
    .trim();
  chart.options.scales.y.ticks.color = styles
    .getPropertyValue("--chart-ticks")
    .trim();
  chart.options.scales.y.grid.color = styles
    .getPropertyValue("--chart-grid")
    .trim();

  chart.update("none");
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  if (themeToggleBtn) {
    themeToggleBtn.textContent = theme === "dark" ? "Dark Mode" : "Light Mode";
  }
  refreshChartColors();
}

function initTheme() {
  const saved = localStorage.getItem("theme") || "dark";
  applyTheme(saved);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      const next = current === "dark" ? "light" : "dark";
      applyTheme(next);
      localStorage.setItem("theme", next);
    });
  }
}

// =========================
// STATUS PILL
// =========================

function setWsStatus(state, text) {
  if (!wsStatusPill) return;
  wsStatusPill.classList.remove("pill-connected", "pill-disconnected");
  wsStatusPill.classList.add(
    state === "connected" ? "pill-connected" : "pill-disconnected"
  );
  wsStatusPill.textContent = text;
}

function formatTime(ts) {
  const d = ts ? new Date(ts) : new Date();
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// =========================
// STOCK TABLE
// =========================

function renderStocksTable() {
  if (!stocksTableBody) return;
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
      if (chartSymbolLabel) {
        chartSymbolLabel.textContent = symbol;
      }
      renderStocksTable();
      updateChart();
    });

    stocksTableBody.appendChild(tr);
  });
}

// =========================
// RECENT ALERTS
// =========================

function normalizeAlertEvent(raw) {
  // Backend AlertEvent likely has: symbol, message, triggered_at (or similar)
  const symbol =
    raw.symbol || raw.rule_symbol || raw.ticker || raw.symbol_name || "N/A";
  const msg =
    raw.message ||
    raw.text ||
    `${symbol} ${raw.direction || ""} ${
      raw.price !== undefined ? raw.price : ""
    }`;
  const ts = raw.triggered_at || raw.time_utc || raw.time || null;

  return { symbol, message: msg, triggered_at: ts };
}

function addRecentAlertFromEvent(evt) {
  if (!recentAlertsContainer) return;

  const normalized = normalizeAlertEvent(evt);

  // remove placeholder if present
  const placeholder = recentAlertsContainer.querySelector("[data-placeholder]");
  if (placeholder) {
    recentAlertsContainer.innerHTML = "";
  }

  const div = document.createElement("div");
  div.className = "alert-item";

  const timeLabel = normalized.triggered_at
    ? formatTime(normalized.triggered_at)
    : "Just now";

  div.innerHTML = `
    <div class="alert-symbol">${normalized.symbol}</div>
    <div class="alert-meta">${normalized.message}</div>
    <div class="alert-meta">${timeLabel}</div>
  `;

  recentAlertsContainer.prepend(div);

  // keep last 6 alerts
  while (recentAlertsContainer.children.length > 6) {
    recentAlertsContainer.removeChild(recentAlertsContainer.lastChild);
  }
}

async function loadRecentAlerts() {
  if (!recentAlertsContainer) return;

  try {
    const res = await fetch(`${API_BASE_URL}/alerts/events`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const events = await res.json();

    if (!events || events.length === 0) {
      recentAlertsContainer.innerHTML = `
        <div class="alert-meta" data-placeholder>
          No alerts yet. They'll appear here when rules trigger.
        </div>`;
      return;
    }

    recentAlertsContainer.innerHTML = "";
    events.forEach((e) => addRecentAlertFromEvent(e));
  } catch (err) {
    console.error("Failed to load recent alerts:", err);
    recentAlertsContainer.innerHTML = `
      <div class="alert-meta" data-placeholder>
        Failed to load alerts.
      </div>`;
  }
}

// =========================
// CHART
// =========================

function initChart() {
  const canvas = document.getElementById("price-chart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const styles = getComputedStyle(canvas);

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          data: [],
          tension: 0.25,
          borderWidth: 3,
          borderColor: styles.getPropertyValue("--chart-line"),
          backgroundColor: styles.getPropertyValue("--chart-fill"),
          pointRadius: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: { color: styles.getPropertyValue("--chart-ticks") },
          grid: { display: false },
        },
        y: {
          ticks: { color: styles.getPropertyValue("--chart-ticks") },
          grid: { color: styles.getPropertyValue("--chart-grid") },
        },
      },
      plugins: { legend: { display: false } },
    },
  });
}

function updateChart() {
  if (!chart) return;
  const data = latestPrices[chartSymbol];
  if (!data) return;

  chartHistory.push({ ts: data.ts, price: data.price });
  if (chartHistory.length > 20) chartHistory.shift();

  chart.data.labels = chartHistory.map((p) => formatTime(p.ts));
  chart.data.datasets[0].data = chartHistory.map((p) => p.price);
  chart.update();
}

// =========================
// ALERT RULES
// =========================

async function loadAlertRules() {
  if (!alertRulesList) return;

  try {
    const res = await fetch(`${API_BASE_URL}/alerts/rules`);
    if (!res.ok) throw new Error();

    const rules = await res.json();
    alertRulesList.innerHTML = "";

    rules.forEach((rule) => {
      const li = document.createElement("li");
      li.className = "alert-rule-item";
      li.innerHTML = `
        <div class="rule-symbol">${rule.symbol} ${rule.operator} ${rule.threshold}</div>
        <div class="rule-meta">Active · WebEx notifications · #${rule.id}</div>
      `;
      alertRulesList.appendChild(li);
    });
  } catch (err) {
    console.error("Failed to load alert rules:", err);
    alertRulesList.innerHTML = `<li class="rule-meta">Failed to load rules.</li>`;
  }
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

    // If backend ever sends alert events over WS:
    if (msg.type === "alert" || msg.kind === "alert") {
      addRecentAlertFromEvent(msg);
      return;
    }

    // Otherwise treat as price snapshot: msg.data is price array
    if (Array.isArray(msg.data)) {
      msg.data.forEach((item) => {
        latestPrices[item.symbol] = item;
      });
      renderStocksTable();
      updateChart();
    }
  };

  socket.onerror = socket.onclose = () => {
    if (!usingMockFeed) {
      startMockFeed();
    }
  };
}

// =========================
// MOCK FEED (for demo)
// =========================

function startMockFeed() {
  usingMockFeed = true;
  setWsStatus("disconnected", "Live data: mock demo");

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

  if (chartSymbolLabel) {
    chartSymbolLabel.textContent = chartSymbol;
  }

  // Load rules and backend recent alerts
  loadAlertRules();
  loadRecentAlerts();
  // keep UI in sync with backend/WebEx alerts
  setInterval(loadRecentAlerts, 5000);

  // Live data
  connectWebSocket();
});
