import { HttpError } from "./http";

type Bucket = { tokens: number; updatedAt: number };
type GlobalWithBuckets = typeof globalThis & { __openAsoRateBuckets?: Map<string, Bucket> };

export type RateRule = { capacity: number; refillPerHour: number };

export const RATE_RULES = {
  detect: { capacity: 6, refillPerHour: 6 },
  detectMulti: { capacity: 2, refillPerHour: 2 },
  opportunities: { capacity: 10, refillPerHour: 10 },
  suggestions: { capacity: 10, refillPerHour: 10 },
  explore: { capacity: 60, refillPerHour: 120 },
  workerLease: { capacity: 40, refillPerHour: 2400 },
  workerComplete: { capacity: 40, refillPerHour: 2400 },
  workerUser: { capacity: 120, refillPerHour: 7200 },
  oauthRegister: { capacity: 30, refillPerHour: 60 },
} satisfies Record<string, RateRule>;

function buckets() {
  const g = globalThis as GlobalWithBuckets;
  g.__openAsoRateBuckets ??= new Map();
  return g.__openAsoRateBuckets;
}

export function rateLimit(workspaceId: string, name: keyof typeof RATE_RULES, cost = 1) {
  const rule: RateRule = RATE_RULES[name];
  const key = `${workspaceId}:${name}`;
  const now = Date.now();
  const map = buckets();
  const bucket = map.get(key) ?? { tokens: rule.capacity, updatedAt: now };
  const refilled = Math.min(rule.capacity, bucket.tokens + ((now - bucket.updatedAt) / 3_600_000) * rule.refillPerHour);
  if (refilled < cost) {
    const waitMinutes = Math.ceil(((cost - refilled) / rule.refillPerHour) * 60);
    map.set(key, { tokens: refilled, updatedAt: now });
    throw new HttpError(429, `Too many requests for this workspace. Try again in about ${waitMinutes} minute${waitMinutes > 1 ? "s" : ""}.`);
  }
  map.set(key, { tokens: refilled - cost, updatedAt: now });
}
