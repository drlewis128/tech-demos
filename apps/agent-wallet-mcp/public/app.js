const $ = (id) => document.getElementById(id);
const fmt = (n, d = 2) => Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: 6 });

const IMPLEMENTED = new Set([
  "getMyInfo", "getWalletOverview", "getAccountActivity",
  "getTokenPrice", "authorizePayment", "getX402Content",
]);

async function api(path, opts) {
  const res = await fetch(path, opts);
  const data = await res.json();
  if (data.frames) renderFrames(data.frames);
  return data;
}

function renderFrames(frames) {
  const log = $("wire-log");
  log.querySelector(".empty")?.remove();
  for (const f of frames) {
    const el = document.createElement("div");
    el.className = `frame ${f.dir}`;
    const arrow = f.dir === "out" ? "→" : f.dir === "in" ? "←" : "⇄";
    const tag = f.dir === "http" ? "HTTP" : "RPC";
    el.innerHTML = `
      <div class="frame-head">
        <span class="dir">${arrow} ${tag}</span>
        <span class="lbl"></span>
        <span class="ts">${new Date(f.at).toLocaleTimeString()}</span>
      </div>
      <pre class="hidden"></pre>`;
    el.querySelector(".lbl").textContent = f.label;
    el.querySelector("pre").textContent = JSON.stringify(f.body, null, 2);
    el.querySelector(".frame-head").addEventListener("click", () =>
      el.querySelector("pre").classList.toggle("hidden"));
    log.appendChild(el);
  }
  log.scrollTop = log.scrollHeight;
}

function setMode(mode, note) {
  const badge = $("mode-badge");
  badge.textContent = mode === "real" ? "REAL · READ-ONLY" : "SIMULATED";
  badge.className = `badge ${mode === "real" ? "real" : "sim"}`;
  $("mode-note").textContent = note ?? "";
}

function renderTools(tools) {
  $("tools").innerHTML = tools.map((t) => {
    const impl = IMPLEMENTED.has(t.name);
    return `<div class="tool ${impl ? "impl" : "stub"}" title="${t.description ?? ""}">
      <span class="dot">●</span>${t.name}</div>`;
  }).join("");
}

function renderWallet({ info, overview, activity }) {
  if (info?.success) {
    const w = info.data.wallets;
    $("addresses").innerHTML = ["evm", "solana", "bitcoin", "sui"]
      .filter((c) => w[c])
      .map((c) => `<div class="addr"><span class="chain">${c}</span><code>${w[c]}</code></div>`)
      .join("");
  }
  if (overview?.success) {
    const rows = overview.data.accounts.map((a) => `
      <tr>
        <td><span class="sym">${a.symbol}</span><span class="chain-pill">${a.chain}</span></td>
        <td class="num">${fmt(a.amount)}</td>
        <td class="num">$${fmt(a.usdValue)}</td>
      </tr>`).join("");
    $("balances").innerHTML = `<table>
      <tr><th>Asset</th><th class="num">Balance</th><th class="num">USD</th></tr>${rows}</table>`;
    $("total").textContent = `Total $${fmt(overview.data.totalUsd)}`;
    $("wallet-card").classList.remove("flash");
    void $("wallet-card").offsetWidth;
    $("wallet-card").classList.add("flash");
  }
  if (activity?.success) {
    const txs = activity.data.transactions;
    $("activity").innerHTML = txs.length ? txs.map((t) => `
      <div class="act">
        <div><div class="what">${t.kind} · ${t.chain}</div><div class="note">${t.note}</div></div>
        <div class="amt ${t.amount < 0 ? "neg" : "pos"}">${t.amount > 0 ? "+" : ""}${fmt(t.amount)} ${t.symbol}</div>
      </div>`).join("") : `<p class="empty">No transactions yet.</p>`;
  }
}

$("btn-connect").addEventListener("click", async () => {
  $("btn-connect").disabled = true;
  try {
    const r = await api("/api/connect", { method: "POST" });
    setMode(r.mode, r.modeNote);
    renderTools(r.tools);
    ["btn-wallet", "btn-price", "btn-paid"].forEach((id) => ($(id).disabled = false));
    $("btn-connect").textContent = "Reconnect";
  } finally {
    $("btn-connect").disabled = false;
  }
});

$("btn-wallet").addEventListener("click", async () => {
  renderWallet(await api("/api/wallet"));
});

$("btn-price").addEventListener("click", async () => {
  const symbol = $("price-symbol").value;
  const r = await api(`/api/price?symbol=${symbol}`);
  $("price-out").textContent = r.price?.success
    ? `${r.price.data.symbol} $${fmt(r.price.data.priceUsd)} (${r.price.data.change24h > 0 ? "+" : ""}${r.price.data.change24h}% 24h)`
    : `error: ${r.price?.error?.message ?? "unknown"}`;
});

$("btn-paid").addEventListener("click", async () => {
  $("btn-paid").disabled = true;
  try {
    const r = await api("/api/paid-action", { method: "POST" });
    const box = $("paid-result");
    box.classList.remove("hidden");
    if (!r.ok) {
      box.innerHTML = `<h3>Payment failed</h3><div class="meta">${JSON.stringify(r.error)}</div>`;
      return;
    }
    box.innerHTML = `
      <h3>402 → authorizePayment → 200 · ${r.content.title}</h3>
      ${r.content.signals.map((s) => `<div class="sig"><span>${s.metric}</span><b>${s.value}</b></div>`).join("")}
      <div class="meta">paid ${r.content.paidWith} · settlement tx ${r.settlement?.txHash ?? "—"} (simulated)</div>`;
    renderWallet(await api("/api/wallet"));
  } finally {
    $("btn-paid").disabled = false;
  }
});

$("btn-clear").addEventListener("click", () => {
  $("wire-log").innerHTML = `<p class="empty">JSON-RPC frames and x402 HTTP hops appear here.</p>`;
});

api("/api/status").then((s) => setMode(s.mode, s.modeNote));
