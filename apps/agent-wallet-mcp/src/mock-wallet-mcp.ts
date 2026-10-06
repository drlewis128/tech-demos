// Simulated Finance District Agent Wallet MCP server.
// Speaks MCP Streamable HTTP (JSON-RPC 2.0 over POST, plain-JSON responses)
// and mirrors the tool catalog + `{ success, data } / { success, error }`
// envelope documented at developers.fd.xyz. Everything here is fake.

import { wallet, overview, tokenPrice, randHex } from "./wallet-state";

const PROTOCOL_VERSION = "2025-06-18";

// Full documented catalog (16 tools). Only a safe subset is implemented;
// the rest respond with a SIMULATION_ONLY error if called.
const CATALOG: Array<{ name: string; description: string; implemented: boolean; inputSchema: object }> = [
  { name: "getWalletOverview", description: "Balances across the Agent Wallet and Smart Accounts", implemented: true, inputSchema: { type: "object", properties: {} } },
  { name: "getAccountActivity", description: "Transaction history for one account on one chain", implemented: true, inputSchema: { type: "object", properties: { chain: { type: "string" } } } },
  { name: "getTokenPrice", description: "USD price + 24h change for a token", implemented: true, inputSchema: { type: "object", properties: { symbol: { type: "string" } }, required: ["symbol"] } },
  { name: "transferTokens", description: "Transfer tokens across EVM, Solana, Bitcoin, and Sui", implemented: false, inputSchema: { type: "object", properties: { chain: { type: "string" }, to: { type: "string" }, amount: { type: "string" }, token: { type: "string" } } } },
  { name: "swapTokens", description: "Quote or execute a token swap (quote-only by default)", implemented: false, inputSchema: { type: "object", properties: { fromToken: { type: "string" }, toToken: { type: "string" }, amount: { type: "string" } } } },
  { name: "discoverYieldStrategies", description: "Discover DeFi yield strategies (EVM chains only)", implemented: false, inputSchema: { type: "object", properties: { chain: { type: "string" } } } },
  { name: "getYieldPositions", description: "List active yield positions for an account on a chain", implemented: false, inputSchema: { type: "object", properties: { chain: { type: "string" } } } },
  { name: "depositForYield", description: "Deposit into a yield strategy", implemented: false, inputSchema: { type: "object", properties: { vault: { type: "string" }, amount: { type: "string" } } } },
  { name: "withdrawFromYield", description: "Withdraw from a yield position by vault token address", implemented: false, inputSchema: { type: "object", properties: { vaultToken: { type: "string" } } } },
  { name: "getRedemptionRequests", description: "Track async vault-withdrawal status", implemented: false, inputSchema: { type: "object", properties: {} } },
  { name: "resolveNameService", description: "Resolve ENS (.eth), SNS (.sol), Unstoppable Domains", implemented: false, inputSchema: { type: "object", properties: { name: { type: "string" } } } },
  { name: "signMessage", description: "EIP-191 personal_sign or EIP-712 typed-data signing (EVM)", implemented: false, inputSchema: { type: "object", properties: { message: { type: "string" } } } },
  { name: "authorizePayment", description: "Build an x402 payment authorization from a 402 response", implemented: true, inputSchema: { type: "object", properties: { paymentRequirements: { type: "object" } }, required: ["paymentRequirements"] } },
  { name: "getX402Content", description: "Fetch from an x402 API and auto-pay on HTTP 402", implemented: true, inputSchema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } },
  { name: "getMyInfo", description: "Authenticated user profile + all wallet addresses (EVM, Solana, Bitcoin, Sui)", implemented: true, inputSchema: { type: "object", properties: {} } },
  { name: "reportIssue", description: "File a bug report (creates a GitHub issue)", implemented: false, inputSchema: { type: "object", properties: { title: { type: "string" }, body: { type: "string" } } } },
];

type Envelope =
  | { success: true; data: unknown }
  | { success: false; error: { code: string; message: string; retryable: boolean; details?: object } };

function err(code: string, message: string, retryable = false): Envelope {
  return { success: false, error: { code, message, retryable } };
}

async function callTool(name: string, args: Record<string, unknown>): Promise<Envelope> {
  switch (name) {
    case "getMyInfo":
      return { success: true, data: { user: wallet.user, wallets: wallet.addresses, mode: "SIMULATED" } };

    case "getWalletOverview":
      return { success: true, data: overview() };

    case "getAccountActivity": {
      const chain = typeof args.chain === "string" ? args.chain : null;
      const transactions = chain ? wallet.activity.filter((a) => a.chain === chain) : wallet.activity;
      return { success: true, data: { transactions } };
    }

    case "getTokenPrice": {
      const price = tokenPrice(String(args.symbol ?? ""));
      return price
        ? { success: true, data: price }
        : err("UNSUPPORTED_TOKEN", `No simulated price for ${args.symbol}`);
    }

    case "authorizePayment": {
      const reqs = args.paymentRequirements as { accepts?: Array<Record<string, any>> } | undefined;
      const accepts = reqs?.accepts ?? [];
      // Pick the first option the wallet can cover, like the real wallet's best-match selection.
      const choice = accepts.find((a) => {
        const amount = Number(a.maxAmountRequired) / 10 ** 6;
        return wallet.balances.some((b) => b.chain === a.network && b.amount >= amount);
      });
      if (!choice) return err("INSUFFICIENT_BALANCE", "No balance covers any accepted payment option");
      const now = Math.floor(Date.now() / 1000);
      return {
        success: true,
        data: {
          x402Version: 2,
          scheme: choice.scheme ?? "exact",
          network: choice.network,
          payload: {
            authorization: {
              from: wallet.addresses.evm,
              to: choice.payTo,
              value: choice.maxAmountRequired,
              validAfter: String(now - 60),
              validBefore: String(now + (choice.maxTimeoutSeconds ?? 300)),
              nonce: "0x" + randHex(32),
            },
            // Simulated EIP-3009 transferWithAuthorization signature — not a real signature.
            signature: "0xsim" + randHex(63),
          },
        },
      };
    }

    case "getX402Content": {
      // Fallback tool: the wallet runs the whole 402 -> pay -> retry loop itself.
      const url = String(args.url ?? "");
      const first = await fetch(url);
      if (first.status !== 402) {
        return { success: true, data: { status: first.status, content: await first.json(), paid: false } };
      }
      const requirements = await first.json();
      const auth = await callTool("authorizePayment", { paymentRequirements: requirements });
      if (!auth.success) return auth;
      const retry = await fetch(url, {
        headers: { "X-PAYMENT": btoa(JSON.stringify(auth.data)) },
      });
      return { success: true, data: { status: retry.status, content: await retry.json(), paid: true } };
    }

    default: {
      const known = CATALOG.find((t) => t.name === name);
      if (!known) return err("UNKNOWN_TOOL", `No such tool: ${name}`);
      return err("SIMULATION_ONLY", `'${name}' exists on the real server but is intentionally not simulated in this demo (it would move funds or touch chains).`);
    }
  }
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number | string;
  method: string;
  params?: Record<string, any>;
}

/** Handle one Streamable-HTTP MCP POST. Returns a Response. */
export async function handleMcpRequest(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return Response.json(
      { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Only POST is supported by this simulated endpoint" } },
      { status: 405 },
    );
  }
  const rpc = (await req.json()) as JsonRpcRequest;
  const reply = (result: unknown) =>
    Response.json({ jsonrpc: "2.0", id: rpc.id ?? null, result }, { headers: { "Mcp-Session-Id": "sim-session-1" } });

  switch (rpc.method) {
    case "initialize":
      return reply({
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "agent-wallet-mcp-SIMULATED", title: "Finance District Agent Wallet (simulated)", version: "0.1.0" },
        instructions: "Simulated Agent Wallet MCP server. Mirrors wallet-mcp.fd.xyz tool shapes. No real funds.",
      });

    case "notifications/initialized":
      return new Response(null, { status: 202 });

    case "tools/list":
      return reply({
        tools: CATALOG.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
      });

    case "tools/call": {
      const envelope = await callTool(rpc.params?.name, rpc.params?.arguments ?? {});
      return reply({
        content: [{ type: "text", text: JSON.stringify(envelope) }],
        isError: !envelope.success,
      });
    }

    case "ping":
      return reply({});

    default:
      return Response.json({ jsonrpc: "2.0", id: rpc.id ?? null, error: { code: -32601, message: `Method not found: ${rpc.method}` } });
  }
}

export const toolCatalog = CATALOG;
