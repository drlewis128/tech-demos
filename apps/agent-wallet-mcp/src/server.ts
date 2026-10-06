// Agent Wallet MCP demo — one Bun process hosting:
//   /            the demo UI
//   /api/*       the "agent" side: an MCP client driven by UI buttons
//   /mcp         a simulated Finance District Agent Wallet MCP server
//   /x402/*      a simulated x402 merchant (paid API endpoint)

import indexHtml from "../public/index.html" with { type: "text" };
import appJs from "../public/app.js" with { type: "text" };
import styleCss from "../public/style.css" with { type: "text" };
import { handleMcpRequest } from "./mock-wallet-mcp";
import { handleMerchantRequest, PRICE_USDC } from "./x402-merchant";
import { McpClient, type Frame } from "./mcp-client";

const PORT = Number(process.env.PORT ?? 3402);
const REAL_MCP_URL = "https://wallet-mcp.fd.xyz";
const FD_MCP_TOKEN = process.env.FD_MCP_TOKEN;

let mode: "simulated" | "real" = "simulated";
let modeNote = "No FD_MCP_TOKEN set — using the in-process simulated MCP server.";
let client: McpClient;

function makeSimClient() {
  return new McpClient(`http://localhost:${PORT}/mcp`);
}

async function connect(): Promise<{ serverInfo: any; tools: any[]; frames: Frame[] }> {
  if (FD_MCP_TOKEN) {
    // Opt-in real mode: read-only calls against the hosted server.
    const real = new McpClient(REAL_MCP_URL, FD_MCP_TOKEN);
    try {
      const init = await real.initialize();
      const tools = await real.listTools();
      client = real;
      mode = "real";
      modeNote = `Connected to ${REAL_MCP_URL} with FD_MCP_TOKEN (read-only tools only).`;
      return { serverInfo: init?.serverInfo, tools: tools?.tools ?? [], frames: real.takeFrames() };
    } catch (e) {
      modeNote = `FD_MCP_TOKEN was set but the real server rejected it (${(e as Error).message}). Fell back to simulation.`;
    }
  }
  client = makeSimClient();
  mode = "simulated";
  const init = await client.initialize();
  const tools = await client.listTools();
  return { serverInfo: init?.serverInfo, tools: tools?.tools ?? [], frames: client.takeFrames() };
}

client = makeSimClient();

const json = (data: unknown, status = 200) => Response.json(data, { status });

async function handleApi(req: Request, url: URL): Promise<Response> {
  switch (url.pathname) {
    case "/api/status":
      return json({ mode, modeNote, mcpUrl: client.url, priceUsdc: PRICE_USDC });

    case "/api/connect": {
      const result = await connect();
      return json({ ok: true, mode, modeNote, mcpUrl: client.url, ...result });
    }

    case "/api/wallet": {
      const info = await client.callTool("getMyInfo");
      const bal = await client.callTool("getWalletOverview");
      const act = await client.callTool("getAccountActivity");
      return json({ ok: true, info, overview: bal, activity: act, frames: client.takeFrames() });
    }

    case "/api/price": {
      const symbol = url.searchParams.get("symbol") ?? "ETH";
      const price = await client.callTool("getTokenPrice", { symbol });
      return json({ ok: true, price, frames: client.takeFrames() });
    }

    case "/api/paid-action": {
      // The "agent with HTTP access" x402 flow (authorizePayment path).
      // Always runs against the simulated wallet + merchant: never real funds.
      const agent = mode === "real" ? makeSimClient() : client;
      if (mode === "real") await agent.initialize();

      const resource = `http://localhost:${PORT}/x402/premium-report`;
      agent.logHttp("GET premium resource (no payment)", { method: "GET", url: resource });
      const first = await fetch(resource);
      const requirements = await first.json();
      agent.logHttp(`HTTP ${first.status} Payment Required`, requirements);
      if (first.status !== 402) return json({ ok: false, error: "Expected 402 from merchant" }, 500);

      const auth = await agent.callTool("authorizePayment", { paymentRequirements: requirements });
      if (!auth.success) return json({ ok: false, error: auth.error, frames: agent.takeFrames() });

      const paymentHeader = btoa(JSON.stringify(auth.data));
      agent.logHttp("GET premium resource (retry with X-PAYMENT)", {
        method: "GET",
        url: resource,
        headers: { "X-PAYMENT": paymentHeader.slice(0, 48) + "…(base64)" },
      });
      const retry = await fetch(resource, { headers: { "X-PAYMENT": paymentHeader } });
      const content = await retry.json();
      const settlement = retry.headers.get("X-PAYMENT-RESPONSE");
      agent.logHttp(`HTTP ${retry.status} paid content delivered`, {
        settlement: settlement ? JSON.parse(atob(settlement)) : null,
      });

      return json({
        ok: retry.ok,
        content,
        settlement: settlement ? JSON.parse(atob(settlement)) : null,
        frames: agent.takeFrames(),
      });
    }

    default:
      return json({ error: "Not found" }, 404);
  }
}

Bun.serve({
  port: PORT,
  idleTimeout: 30,
  async fetch(req) {
    const url = new URL(req.url);
    try {
      if (url.pathname === "/mcp") return handleMcpRequest(req);
      if (url.pathname.startsWith("/x402/")) return handleMerchantRequest(req);
      if (url.pathname.startsWith("/api/")) return handleApi(req, url);
      if (url.pathname === "/app.js") return new Response(appJs, { headers: { "Content-Type": "text/javascript" } });
      if (url.pathname === "/style.css") return new Response(styleCss, { headers: { "Content-Type": "text/css" } });
      return new Response(indexHtml, { headers: { "Content-Type": "text/html" } });
    } catch (e) {
      return json({ ok: false, error: (e as Error).message }, 500);
    }
  },
});

console.log(`Agent Wallet MCP demo → http://localhost:${PORT}`);
console.log(`Mode: ${mode.toUpperCase()} — ${modeNote}`);
