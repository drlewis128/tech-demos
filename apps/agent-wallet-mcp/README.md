# Agent Wallet · MCP demo

A single-page Bun demo that makes the [Finance District Agent Wallet](https://developers.fd.xyz/agent-wallet/overview) MCP loop visible: an MCP client (the "agent") talks JSON-RPC over Streamable HTTP to a wallet MCP server, shows wallet addresses and balances, and runs one safe **x402 paid action** — with every JSON-RPC frame and HTTP hop rendered in a live wire log.

## Run

```bash
cd apps/agent-wallet-mcp
bun install
bun run dev
# open http://localhost:3402
```

Then in the UI: **1 · Connect & discover tools** → **2 · Load wallet via MCP** → **3 · Run x402 paid action**. The paid action plays the full flow: `GET` paid resource → `402 Payment Required` with `accepts[]` → MCP `authorizePayment` tool call signs a (simulated) EIP-3009 authorization → retry with `X-PAYMENT` header → `200` + premium content, and the USDC balance drops by 0.05.

## Mock vs. real mode

**Simulated (default).** The real hosted server (`https://wallet-mcp.fd.xyz`) authenticates via OAuth Authorization Code + PKCE, which requires an interactive browser sign-in with a District Pass — there is no headless, secret-free way to connect. So by default the app runs an **in-process simulated MCP server** that speaks the same protocol (`initialize`, `tools/list`, `tools/call`) and mirrors the documented surface:

- the full 16-tool catalog is listed via `tools/list`
- `getMyInfo`, `getWalletOverview`, `getAccountActivity`, `getTokenPrice`, `authorizePayment`, and `getX402Content` are implemented with the documented `{ success, data } / { success, error }` response envelope
- fund-moving tools (`transferTokens`, `swapTokens`, yield tools, …) deliberately return a `SIMULATION_ONLY` error if called
- a built-in mock x402 merchant (`/x402/premium-report`) answers `402` with x402 v2 payment requirements and "settles" against the simulated wallet

The UI shows a **SIMULATED** badge whenever this mode is active. All addresses, balances, signatures, and transactions are fake and held in memory.

**Real (opt-in, read-only).** If you already have an OAuth access token for the hosted server, export it before starting:

```bash
export FD_MCP_TOKEN="<your OAuth access token for wallet-mcp.fd.xyz>"
bun run dev
```

On connect, the app initializes against `https://wallet-mcp.fd.xyz` with `Authorization: Bearer $FD_MCP_TOKEN` and uses it for the read-only tools only (`getMyInfo`, `getWalletOverview`, `getAccountActivity`, `getTokenPrice`). The x402 paid action **always** runs against the in-process simulator, so the demo never moves real funds in either mode. If the token is missing or rejected, the app falls back to simulated mode and says so in the mode badge.

No secrets are stored or committed; the token is read from the environment at startup only.

## Layout

| Path | What |
| --- | --- |
| `src/server.ts` | `Bun.serve` — UI, agent-side `/api/*`, mounts the mock MCP server at `/mcp` and the mock merchant at `/x402/*` |
| `src/mcp-client.ts` | Minimal hand-rolled MCP Streamable HTTP client; captures every frame for the wire log |
| `src/mock-wallet-mcp.ts` | Simulated Agent Wallet MCP server mirroring the documented tool shapes |
| `src/x402-merchant.ts` | Simulated x402 merchant (402 → verify `X-PAYMENT` → settle → content) |
| `src/wallet-state.ts` | In-memory simulated wallet (addresses, balances, activity) |
| `public/` | Single-page UI (vanilla HTML/CSS/JS) |

Zero npm dependencies — the MCP client and server are plain JSON-RPC over `fetch`, which is the point of the demo: the protocol stays visible.
