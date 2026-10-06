// Simulated x402 merchant: one paid API endpoint that answers
// 402 Payment Required until a payment payload arrives, then settles
// against the simulated wallet and returns the premium content.

import { wallet, debit, randHex } from "./wallet-state";

export const PRICE_USDC = 0.05;
const PRICE_ATOMIC = String(PRICE_USDC * 10 ** 6); // USDC has 6 decimals

export function paymentRequirements(resource: string) {
  return {
    x402Version: 2,
    error: "Payment required",
    accepts: [
      {
        scheme: "exact",
        network: "base",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        assetSymbol: "USDC",
        maxAmountRequired: PRICE_ATOMIC,
        payTo: wallet.merchantAddress,
        resource,
        description: "Premium agent-market intelligence report (simulated)",
        mimeType: "application/json",
        maxTimeoutSeconds: 300,
      },
    ],
  };
}

export function handleMerchantRequest(req: Request): Response {
  const url = new URL(req.url);
  const paymentHeader = req.headers.get("X-PAYMENT");

  if (!paymentHeader) {
    return Response.json(paymentRequirements(url.origin + url.pathname), { status: 402 });
  }

  let payload: any;
  try {
    payload = JSON.parse(atob(paymentHeader));
  } catch {
    return Response.json({ error: "Malformed X-PAYMENT header" }, { status: 400 });
  }

  const auth = payload?.payload?.authorization;
  if (payload?.x402Version !== 2 || !auth?.from || !payload?.payload?.signature) {
    return Response.json({ error: "Invalid x402 payment payload" }, { status: 400 });
  }
  if (auth.to !== wallet.merchantAddress || auth.value !== PRICE_ATOMIC) {
    return Response.json({ error: "Payment does not match requirements" }, { status: 400 });
  }

  // "Settlement": the simulated facilitator moves simulated funds.
  const tx = debit(payload.network, "USDC", PRICE_USDC, wallet.merchantAddress, "x402: premium market report");
  if (!tx) return Response.json({ error: "Insufficient balance at settlement" }, { status: 402 });

  const report = {
    title: "Agent Commerce Market Pulse (simulated)",
    generatedAt: new Date().toISOString(),
    paidWith: `${PRICE_USDC} USDC on ${payload.network}`,
    headline: "x402-style paid actions keep trending across agent-wallet demos",
    signals: [
      { metric: "agent-initiated stablecoin payments (7d)", value: "+38%", confidence: 0.92 },
      { metric: "MCP wallet-server connections (7d)", value: "+61%", confidence: 0.88 },
      { metric: "median paid-API price", value: "$0.04 / call", confidence: 0.95 },
    ],
    disclaimer: "Entirely simulated content for a tech demo. No real market data, no real funds.",
  };

  return Response.json(report, {
    headers: {
      "X-PAYMENT-RESPONSE": btoa(JSON.stringify({ success: true, txHash: tx.hash, networkId: payload.network, simulated: true })),
    },
  });
}
