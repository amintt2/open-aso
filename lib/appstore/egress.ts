import { fetch as undiciFetch, ProxyAgent, type Dispatcher } from "undici";

type Egress = {
  id: string;
  label: string;
  dispatcher?: Dispatcher;
  tokens: number;
  refilledAt: number;
  cooldownUntil: number;
  strikes: number;
  successes: number;
  active: number;
  requests: number;
  limited: number;
};

const COOLDOWNS = [10_000, 30_000, 120_000, 600_000];
const MAX_IN_FLIGHT = 3;

function rpm() {
  return Math.max(1, Number(process.env.OPEN_ASO_ITUNES_RPM ?? 20));
}

function burst() {
  return Math.max(2, Math.ceil(rpm() / 6));
}

type Pool = { egresses: Egress[]; cursor: number };
type GlobalWithPool = typeof globalThis & { __openAsoEgress?: Pool };

function maskProxy(url: string) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}:${u.port || (u.protocol === "https:" ? "443" : "80")}`;
  } catch {
    return "proxy";
  }
}

function pool(): Pool {
  const g = globalThis as GlobalWithPool;
  if (g.__openAsoEgress) return g.__openAsoEgress;
  const proxies = (process.env.OPEN_ASO_PROXIES ?? "")
    .split(/[,\n\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const make = (id: string, label: string, dispatcher?: Dispatcher): Egress => ({
    id,
    label,
    dispatcher,
    tokens: burst(),
    refilledAt: Date.now(),
    cooldownUntil: 0,
    strikes: 0,
    successes: 0,
    active: 0,
    requests: 0,
    limited: 0,
  });
  const egresses = [
    ...(process.env.OPEN_ASO_PROXY_ONLY === "1" && proxies.length ? [] : [make("direct", "server IP")]),
    ...proxies.map((url, i) => make(`proxy-${i}`, maskProxy(url), new ProxyAgent(url))),
  ];
  g.__openAsoEgress = { egresses, cursor: 0 };
  return g.__openAsoEgress;
}

function refill(e: Egress, now: number) {
  const add = ((now - e.refilledAt) / 60_000) * rpm();
  e.tokens = Math.min(burst(), e.tokens + add);
  e.refilledAt = now;
}

async function acquire(): Promise<Egress> {
  const p = pool();
  for (;;) {
    const now = Date.now();
    let soonest = Infinity;
    for (let i = 0; i < p.egresses.length; i++) {
      const e = p.egresses[(p.cursor + i) % p.egresses.length];
      refill(e, now);
      if (e.cooldownUntil > now) {
        soonest = Math.min(soonest, e.cooldownUntil - now);
        continue;
      }
      if (e.active >= MAX_IN_FLIGHT) {
        soonest = Math.min(soonest, 200);
        continue;
      }
      if (e.tokens >= 1) {
        e.tokens -= 1;
        e.active++;
        e.requests++;
        p.cursor = (p.cursor + i + 1) % p.egresses.length;
        return e;
      }
      soonest = Math.min(soonest, ((1 - e.tokens) / rpm()) * 60_000);
    }
    await new Promise((r) => setTimeout(r, Math.max(50, Math.min(soonest, 5_000))));
  }
}

function release(e: Egress, outcome: "ok" | "limited" | "error") {
  e.active = Math.max(0, e.active - 1);
  if (outcome === "limited") {
    e.limited++;
    e.successes = 0;
    e.cooldownUntil = Date.now() + COOLDOWNS[Math.min(e.strikes, COOLDOWNS.length - 1)];
    e.strikes++;
    e.tokens = 0;
    console.warn(`[open-aso] App Store rate limit on ${e.label}, pausing ${Math.round((e.cooldownUntil - Date.now()) / 1000)}s`);
  } else if (outcome === "ok") {
    e.successes++;
    if (e.successes >= 20 && e.strikes > 0) {
      e.strikes--;
      e.successes = 0;
    }
  }
}

export async function appStoreFetch(url: string, init: { headers?: Record<string, string> } = {}, attempts = 6): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    const e = await acquire();
    let outcome: "ok" | "limited" | "error" = "error";
    try {
      const res = (await undiciFetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh) open-aso", ...init.headers },
        signal: AbortSignal.timeout(20_000),
        dispatcher: e.dispatcher,
      })) as unknown as Response;
      if (res.status === 403 || res.status === 429) {
        outcome = "limited";
        lastError = new Error("The App Store is rate limiting requests right now. Keywords will be retried automatically.");
        continue;
      }
      if (res.status >= 500) {
        lastError = new Error(`App Store responded ${res.status}`);
        await new Promise((r) => setTimeout(r, 800 * 2 ** i));
        continue;
      }
      outcome = "ok";
      return res;
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 500 * 2 ** i));
    } finally {
      release(e, outcome);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("App Store request failed");
}

export function egressStats() {
  const now = Date.now();
  return {
    rpmPerEgress: rpm(),
    egresses: pool().egresses.map((e) => ({
      label: e.label,
      cooldownMs: Math.max(0, e.cooldownUntil - now),
      inFlight: e.active,
      requests: e.requests,
      rateLimited: e.limited,
    })),
  };
}
