# Finance District Agent Wallet (MCP)

## Tech

[Finance District](https://developers.fd.xyz) ships **Agent Wallet** — AI-native, non-custodial wallet infrastructure exposed to AI agents through a remote MCP server (`https://wallet-mcp.fd.xyz`, Streamable HTTP + OAuth PKCE). The server publishes 16 tools (balances, transfers, swaps, yield, name resolution, signing) plus two **x402** payment tools (`authorizePayment`, `getX402Content`) that let an agent pay for HTTP APIs that answer `402 Payment Required`. Source bookmark: [walkthrough of wiring an Agent Wallet into an AI assistant via MCP](https://x.com/FD_XYZ/status/2096817485668663330).

## Demo angle

Make the **MCP ↔ agent-wallet loop visible on the wire**. One page shows a wallet (addresses + balances) driven entirely through MCP JSON-RPC calls, and runs one safe paid action: an x402 flow where the "agent" hits a paid API, gets a 402, asks the wallet's `authorizePayment` tool to sign, retries with payment, and gets the content — with every JSON-RPC frame and HTTP hop rendered in a live wire log.

The real server's OAuth Authorization Code + PKCE flow needs an interactive browser sign-in with a District Pass, so there is no headless, secret-free way to connect. The demo therefore defaults to a clearly labeled **SIMULATED** mode: an in-process mock MCP server speaking the same Streamable HTTP JSON-RPC protocol and mirroring the documented tool names and the `{ success, data } / { success, error }` response envelope. If `FD_MCP_TOKEN` is set, the app instead attempts the real server for read-only calls and falls back to mock when auth fails. No real funds ever move; no secrets are committed.

## Scope

- In: in-process mock Agent Wallet MCP server (Streamable HTTP JSON-RPC: `initialize`, `tools/list`, `tools/call`) implementing `getMyInfo`, `getWalletOverview`, `getAccountActivity`, `getTokenPrice`, `authorizePayment`, `getX402Content` with doc-mirroring shapes; the full 16-tool catalog listed via `tools/list`
- In: a built-in mock x402 merchant endpoint (`402` with `accepts[]`, verifies `X-PAYMENT`, settles against the mock wallet)
- In: single-page UI — mode badge, wallet addresses, balances, activity feed, tool discovery, token price lookup, one-click simulated x402 paid action, JSON-RPC wire log
- In: optional real mode (`FD_MCP_TOKEN` env var, read-only tools only), documented in README
- Out: real OAuth flow, real transfers/swaps/yield, persistence, multi-user, auth, any mainnet or testnet transaction

## Stack

- **Bun** runtime, `Bun.serve` — one process serves the UI, the agent-side API, the mock MCP server, and the mock x402 merchant
- **Zero npm dependencies** — the MCP Streamable HTTP client and server are hand-rolled JSON-RPC over `fetch`, which is the point: the protocol stays visible
- Vanilla HTML/CSS/JS single page, dark fintech styling

## Validation

How to run: `cd apps/agent-wallet-mcp && bun install && bun run dev`, then open `http://localhost:3402`.

Done looks like: the page shows the SIMULATED badge, the mock wallet's addresses and balances fetched via `getMyInfo`/`getWalletOverview`, and clicking **Run x402 paid action** plays the full loop — `402 Payment Required` → `authorizePayment` tool call → retry with `X-PAYMENT` → `200` + premium content — with the balance dropping by the paid amount and every frame visible in the wire log. PR carries at least one screenshot and at least one video of the running app.
