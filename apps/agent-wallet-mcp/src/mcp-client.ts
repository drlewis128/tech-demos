// Minimal MCP Streamable HTTP client (JSON-RPC 2.0 over fetch).
// Hand-rolled on purpose: every frame it sends/receives is captured so the
// UI can show the raw MCP wire traffic.

export interface Frame {
  dir: "out" | "in" | "http";
  label: string;
  body: unknown;
  at: string;
}

export class McpClient {
  private nextId = 1;
  private sessionId: string | null = null;
  frames: Frame[] = [];

  constructor(
    public url: string,
    private token?: string,
  ) {}

  private log(dir: Frame["dir"], label: string, body: unknown) {
    this.frames.push({ dir, label, body, at: new Date().toISOString() });
  }

  takeFrames(): Frame[] {
    const out = this.frames;
    this.frames = [];
    return out;
  }

  logHttp(label: string, body: unknown) {
    this.log("http", label, body);
  }

  private async post(payload: Record<string, unknown>): Promise<any> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (this.sessionId) headers["Mcp-Session-Id"] = this.sessionId;

    this.log("out", String(payload.method), payload);
    const res = await fetch(this.url, { method: "POST", headers, body: JSON.stringify(payload) });
    this.sessionId = res.headers.get("Mcp-Session-Id") ?? this.sessionId;

    if (res.status === 202) return null; // accepted notification

    const contentType = res.headers.get("content-type") ?? "";
    let json: any;
    if (contentType.includes("text/event-stream")) {
      // Streamable HTTP servers may answer over SSE; take the first message event.
      const text = await res.text();
      const dataLine = text.split("\n").find((l) => l.startsWith("data:"));
      json = dataLine ? JSON.parse(dataLine.slice(5)) : null;
    } else {
      json = await res.json().catch(() => null);
    }

    if (!res.ok && !json) {
      const failure = { status: res.status, statusText: res.statusText };
      this.log("in", `HTTP ${res.status}`, failure);
      throw new Error(`MCP endpoint returned HTTP ${res.status}`);
    }
    this.log("in", `${payload.method} response`, json);
    if (json?.error) throw new Error(`JSON-RPC error ${json.error.code}: ${json.error.message}`);
    return json?.result ?? null;
  }

  async request(method: string, params?: Record<string, unknown>): Promise<any> {
    return this.post({ jsonrpc: "2.0", id: this.nextId++, method, ...(params ? { params } : {}) });
  }

  async notify(method: string): Promise<void> {
    await this.post({ jsonrpc: "2.0", method });
  }

  async initialize() {
    const result = await this.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "agent-wallet-mcp-demo", version: "0.1.0" },
    });
    await this.notify("notifications/initialized");
    return result;
  }

  async listTools() {
    return this.request("tools/list");
  }

  /** Call a tool and unwrap the Finance District { success, data } envelope. */
  async callTool(name: string, args: Record<string, unknown> = {}) {
    const result = await this.request("tools/call", { name, arguments: args });
    const text = result?.content?.find((c: any) => c.type === "text")?.text;
    try {
      return text ? JSON.parse(text) : result;
    } catch {
      return { success: true, data: text };
    }
  }
}
