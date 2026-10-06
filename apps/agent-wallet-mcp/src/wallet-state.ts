// In-memory simulated Agent Wallet. No real keys, no real chains, no real funds.

export interface Balance {
  chain: string;
  symbol: string;
  token: string;
  amount: number;
  decimals: number;
  usdPrice: number;
}

export interface Activity {
  hash: string;
  chain: string;
  kind: string;
  symbol: string;
  amount: number;
  counterparty: string;
  note: string;
  at: string;
}

const randHex = (n: number) =>
  Array.from(crypto.getRandomValues(new Uint8Array(n)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

export const wallet = {
  user: {
    email: "demo-agent@example.com",
    districtPass: "dp_sim_" + randHex(6),
    simulated: true,
  },
  addresses: {
    evm: "0x" + randHex(20),
    solana: "S1m" + randHex(14),
    bitcoin: "bc1q" + randHex(16),
    sui: "0x" + randHex(32),
  },
  merchantAddress: "0x" + randHex(20),
  balances: [
    { chain: "base", symbol: "USDC", token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", amount: 25.0, decimals: 6, usdPrice: 1.0 },
    { chain: "bsc", symbol: "FDUSD", token: "0xc5f0f7b66764F6ec8C8Dff7BA683102295E16409", amount: 10.0, decimals: 18, usdPrice: 1.0 },
    { chain: "base", symbol: "ETH", token: "native", amount: 0.0042, decimals: 18, usdPrice: 0 /* filled by price fn */ },
  ] as Balance[],
  activity: [] as Activity[],
};

wallet.activity.push({
  hash: "0x" + randHex(32),
  chain: "base",
  kind: "receive",
  symbol: "USDC",
  amount: 25.0,
  counterparty: "faucet.fd.xyz (simulated)",
  note: "Simulated testnet funding",
  at: new Date(Date.now() - 86_400_000).toISOString(),
});

const BASE_PRICES: Record<string, { priceUsd: number; change24h: number }> = {
  USDC: { priceUsd: 1.0, change24h: 0.01 },
  FDUSD: { priceUsd: 0.999, change24h: -0.02 },
  ETH: { priceUsd: 4187.5, change24h: 2.4 },
  BTC: { priceUsd: 118_240, change24h: 1.1 },
  SOL: { priceUsd: 231.8, change24h: -0.8 },
};

export function tokenPrice(symbol: string) {
  const base = BASE_PRICES[symbol.toUpperCase()];
  if (!base) return null;
  // Small deterministic-enough jitter so repeated lookups feel live.
  const jitter = 1 + (Math.random() - 0.5) * 0.002;
  return {
    symbol: symbol.toUpperCase(),
    priceUsd: +(base.priceUsd * jitter).toFixed(base.priceUsd > 10 ? 2 : 4),
    change24h: base.change24h,
    asOf: new Date().toISOString(),
    source: "simulated",
  };
}

export function overview() {
  const accounts = wallet.balances.map((b) => {
    const price = b.symbol === "ETH" ? tokenPrice("ETH")!.priceUsd : b.usdPrice;
    return { ...b, usdValue: +(b.amount * price).toFixed(2) };
  });
  const totalUsd = +accounts.reduce((s, a) => s + a.usdValue, 0).toFixed(2);
  return { accountType: "EOA (simulated)", accounts, totalUsd };
}

export function debit(chain: string, symbol: string, amount: number, payTo: string, note: string) {
  const bal = wallet.balances.find((b) => b.chain === chain && b.symbol === symbol);
  if (!bal || bal.amount < amount) return null;
  bal.amount = +(bal.amount - amount).toFixed(6);
  const tx: Activity = {
    hash: "0x" + randHex(32),
    chain,
    kind: "x402-payment",
    symbol,
    amount: -amount,
    counterparty: payTo,
    note,
    at: new Date().toISOString(),
  };
  wallet.activity.unshift(tx);
  return tx;
}

export { randHex };
