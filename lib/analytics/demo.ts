import Database from "better-sqlite3";

export const DEMO_NOTICE =
  "Demo data — connect the SDK and RevenueCat/Superwall to see yours";

export const DEMO_WORKSPACE = "demo";

const DEMO_SCHEMA = `
CREATE TABLE apps (id INTEGER PRIMARY KEY, workspace_id TEXT NOT NULL, track_id INTEGER NOT NULL, name TEXT NOT NULL, bundle_id TEXT, is_mine INTEGER NOT NULL DEFAULT 1);
CREATE TABLE installs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, workspace_id TEXT NOT NULL, app_id INTEGER, user_id TEXT NOT NULL, country TEXT, city TEXT,
  source TEXT NOT NULL DEFAULT 'organic', campaign_id TEXT, ad_group_id TEXT, keyword_id TEXT, keyword TEXT,
  installed_at TEXT NOT NULL, UNIQUE(app_id, user_id)
);
CREATE INDEX installs_user ON installs(user_id);
CREATE INDEX installs_keyword ON installs(keyword_id);
CREATE TABLE revenue_events (
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, provider TEXT NOT NULL, app_id INTEGER, user_id TEXT, type TEXT NOT NULL, product_id TEXT,
  amount_usd REAL NOT NULL DEFAULT 0, country TEXT, occurred_at TEXT NOT NULL, raw TEXT
);
CREATE INDEX revenue_events_user ON revenue_events(user_id);
CREATE TABLE ads_keyword_daily (
  workspace_id TEXT NOT NULL, org_id TEXT NOT NULL, campaign_id TEXT NOT NULL, ad_group_id TEXT NOT NULL, keyword_id TEXT NOT NULL, keyword TEXT NOT NULL,
  country TEXT, date TEXT NOT NULL, impressions INTEGER NOT NULL DEFAULT 0, taps INTEGER NOT NULL DEFAULT 0,
  installs INTEGER NOT NULL DEFAULT 0, spend REAL NOT NULL DEFAULT 0, currency TEXT, PRIMARY KEY (keyword_id, date)
);
CREATE TABLE ads_campaigns (workspace_id TEXT NOT NULL, campaign_id TEXT NOT NULL, adam_id INTEGER NOT NULL, PRIMARY KEY (workspace_id, campaign_id));
CREATE TABLE analytics_sessions (
  workspace_id TEXT NOT NULL, app_id INTEGER NOT NULL, user_id TEXT NOT NULL, date TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (app_id, user_id, date)
);
CREATE INDEX analytics_sessions_date ON analytics_sessions(app_id, date);
`;

function registerFunctions(d: Database.Database) {
  d.function("analytics_day", { deterministic: true }, (ts: unknown) =>
    ts == null ? null : String(ts).slice(0, 10),
  );
  d.function(
    "analytics_add_days",
    { deterministic: true },
    (day: unknown, n: unknown) =>
      day == null
        ? null
        : new Date(Date.parse(`${String(day)}T00:00:00Z`) + Number(n) * DAY_MS)
            .toISOString()
            .slice(0, 10),
  );
  d.function("analytics_week", { deterministic: true }, (day: unknown) => {
    if (day == null) return null;
    const t = Date.parse(`${String(day)}T00:00:00Z`);
    const offset = (new Date(t).getUTCDay() + 6) % 7;
    return new Date(t - offset * DAY_MS).toISOString().slice(0, 10);
  });
}

const DAYS = 200;
const DEMO_VERSION = 3;
const DAY_MS = 86400000;

const KEYWORDS: {
  id: string;
  term: string;
  campaign: string;
  cpt: number;
  volume: number;
  quality: number;
}[] = [
  {
    id: "910001",
    term: "habit tracker",
    campaign: "5101",
    cpt: 2.4,
    volume: 1.0,
    quality: 1.15,
  },
  {
    id: "910002",
    term: "daily planner",
    campaign: "5101",
    cpt: 1.9,
    volume: 0.8,
    quality: 0.95,
  },
  {
    id: "910003",
    term: "routine app",
    campaign: "5101",
    cpt: 1.4,
    volume: 0.55,
    quality: 1.05,
  },
  {
    id: "910004",
    term: "goal tracker",
    campaign: "5101",
    cpt: 1.7,
    volume: 0.5,
    quality: 1.25,
  },
  {
    id: "910005",
    term: "streaks",
    campaign: "5102",
    cpt: 2.9,
    volume: 0.45,
    quality: 0.7,
  },
  {
    id: "910006",
    term: "self care",
    campaign: "5102",
    cpt: 1.2,
    volume: 0.6,
    quality: 0.6,
  },
  {
    id: "910007",
    term: "productivity",
    campaign: "5102",
    cpt: 3.4,
    volume: 0.7,
    quality: 0.5,
  },
  {
    id: "910008",
    term: "morning routine",
    campaign: "5101",
    cpt: 1.1,
    volume: 0.35,
    quality: 1.35,
  },
  {
    id: "910009",
    term: "to do list",
    campaign: "5102",
    cpt: 2.2,
    volume: 0.65,
    quality: 0.65,
  },
  {
    id: "910010",
    term: "habit",
    campaign: "5101",
    cpt: 2.6,
    volume: 0.9,
    quality: 0.9,
  },
];

const COUNTRIES: {
  code: string;
  weight: number;
  arpuBoost: number;
  cities: string[];
}[] = [
  {
    code: "us",
    weight: 34,
    arpuBoost: 1.25,
    cities: [
      "New York",
      "Los Angeles",
      "Chicago",
      "Austin",
      "Seattle",
      "San Francisco",
    ],
  },
  {
    code: "gb",
    weight: 9,
    arpuBoost: 1.1,
    cities: ["London", "Manchester", "Bristol"],
  },
  {
    code: "de",
    weight: 8,
    arpuBoost: 1.05,
    cities: ["Berlin", "Munich", "Hamburg"],
  },
  {
    code: "fr",
    weight: 6,
    arpuBoost: 0.95,
    cities: ["Paris", "Lyon", "Marseille"],
  },
  {
    code: "ca",
    weight: 6,
    arpuBoost: 1.1,
    cities: ["Toronto", "Vancouver", "Montreal"],
  },
  { code: "au", weight: 5, arpuBoost: 1.15, cities: ["Sydney", "Melbourne"] },
  { code: "jp", weight: 6, arpuBoost: 1.0, cities: ["Tokyo", "Osaka"] },
  {
    code: "br",
    weight: 6,
    arpuBoost: 0.45,
    cities: ["São Paulo", "Rio de Janeiro"],
  },
  {
    code: "in",
    weight: 6,
    arpuBoost: 0.3,
    cities: ["Mumbai", "Bengaluru", "Delhi"],
  },
  { code: "es", weight: 3, arpuBoost: 0.8, cities: ["Madrid", "Barcelona"] },
  { code: "it", weight: 3, arpuBoost: 0.8, cities: ["Milan", "Rome"] },
  { code: "nl", weight: 2, arpuBoost: 1.0, cities: ["Amsterdam"] },
  { code: "se", weight: 2, arpuBoost: 1.05, cities: ["Stockholm"] },
  {
    code: "mx",
    weight: 3,
    arpuBoost: 0.5,
    cities: ["Mexico City", "Guadalajara"],
  },
  { code: "kr", weight: 2, arpuBoost: 0.9, cities: ["Seoul"] },
];

const PRODUCTS = [
  { id: "demo.pro.monthly", price: 7.99, months: 1 },
  { id: "demo.pro.yearly", price: 39.99, months: 12 },
];

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function poisson(rand: () => number, lambda: number) {
  if (lambda <= 0) return 0;
  if (lambda > 30)
    return Math.max(
      0,
      Math.round(
        lambda + Math.sqrt(lambda) * (rand() + rand() + rand() - 1.5) * 2,
      ),
    );
  const l = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rand();
  } while (p > l);
  return k - 1;
}

function pick<T extends { weight: number }>(rand: () => number, items: T[]) {
  const total = items.reduce((a, b) => a + b.weight, 0);
  let x = rand() * total;
  for (const item of items) {
    x -= item.weight;
    if (x <= 0) return item;
  }
  return items[items.length - 1];
}

function sqlTs(t: number) {
  return new Date(t).toISOString().slice(0, 19).replace("T", " ");
}

function build(today: string) {
  const d = new Database(":memory:");
  d.exec(DEMO_SCHEMA);
  registerFunctions(d);
  const rand = rng(20261007);
  const end = Date.parse(`${today}T00:00:00Z`);
  const now = Date.now();
  const start = end - (DAYS - 1) * DAY_MS;
  d.prepare(
    "INSERT INTO apps (id, workspace_id, track_id, name, bundle_id) VALUES (1, 'demo', 1000000001, 'Demo Habit App', 'com.example.demo')",
  ).run();
  const insertAds = d.prepare(
    "INSERT INTO ads_keyword_daily VALUES ('demo', 'demo-org', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'USD')",
  );
  const insertInstall = d.prepare(
    "INSERT INTO installs (workspace_id, app_id, user_id, country, city, source, campaign_id, ad_group_id, keyword_id, keyword, installed_at) VALUES ('demo', 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertRevenue = d.prepare(
    "INSERT INTO revenue_events (id, workspace_id, provider, app_id, user_id, type, product_id, amount_usd, country, occurred_at, raw) VALUES (?, 'demo', 'revenuecat', 1, ?, ?, ?, ?, ?, ?, '{\"environment\":\"PRODUCTION\"}')",
  );
  const insertSession = d.prepare(
    "INSERT OR IGNORE INTO analytics_sessions (workspace_id, app_id, user_id, date) VALUES ('demo', 1, ?, ?)",
  );
  let userSeq = 0;
  let eventSeq = 0;

  const addUser = (
    dayStart: number,
    source: "organic" | "apple_ads",
    kw: (typeof KEYWORDS)[number] | null,
  ) => {
    const country = kw && rand() < 0.75 ? COUNTRIES[0] : pick(rand, COUNTRIES);
    const city =
      rand() < 0.8
        ? country.cities[Math.floor(rand() * country.cities.length)]
        : null;
    const userId = `demo-${++userSeq}`;
    const installedAt = dayStart + Math.floor(rand() * DAY_MS * 0.95);
    if (installedAt > now) return;
    insertInstall.run(
      userId,
      country.code,
      city,
      source,
      kw?.campaign ?? null,
      kw ? `${kw.campaign}01` : null,
      kw?.id ?? null,
      kw?.term ?? null,
      sqlTs(installedAt),
    );
    const quality = (kw?.quality ?? 1) * country.arpuBoost;
    const event = (
      type: string,
      product: string | null,
      amount: number,
      at: number,
    ) => {
      if (at > now) return;
      insertRevenue.run(
        `demo_${++eventSeq}`,
        userId,
        type,
        product,
        amount,
        country.code,
        new Date(at).toISOString(),
      );
    };
    const trialP = Math.min(
      0.6,
      (source === "apple_ads" ? 0.24 : 0.15) * Math.sqrt(quality),
    );
    const roll = rand();
    if (roll < trialP) {
      const product = rand() < 0.62 ? PRODUCTS[1] : PRODUCTS[0];
      const trialAt = installedAt + Math.floor(rand() * 3600 * 1000 * 6);
      event("trial_started", product.id, 0, trialAt);
      if (rand() < Math.min(0.75, 0.42 * quality)) {
        const convertAt = trialAt + 7 * DAY_MS;
        const price = product.price * (0.85 + rand() * 0.3);
        event("trial_converted", product.id, price, convertAt);
        if (rand() < 0.035)
          event(
            "refund",
            product.id,
            -price,
            convertAt + Math.floor(rand() * 10) * DAY_MS,
          );
        else if (product.months === 1) {
          let at = convertAt;
          for (let m = 0; m < 8 && rand() < 0.72; m++) {
            at += 30 * DAY_MS;
            event("renewal", product.id, price, at);
          }
          if (rand() < 0.4)
            event(
              "cancellation",
              product.id,
              0,
              at + Math.floor(rand() * 20) * DAY_MS,
            );
        }
      } else
        event(
          "cancellation",
          product.id,
          0,
          trialAt + Math.floor(rand() * 6) * DAY_MS,
        );
    } else if (roll < trialP + 0.02 * quality) {
      event(
        "non_renewing_purchase",
        "demo.lifetime",
        59.99 * country.arpuBoost,
        installedAt + Math.floor(rand() * 2 * DAY_MS),
      );
    }
    const engagement = 0.85 + rand() * 0.5 + (quality - 1) * 0.2;
    for (const k of [1, 2, 3, 5, 7, 10, 14, 21, 30, 45]) {
      const at = installedAt + k * DAY_MS;
      if (at > now) break;
      if (rand() < Math.min(0.95, 0.42 * Math.pow(k, -0.55) * engagement))
        insertSession.run(userId, new Date(at).toISOString().slice(0, 10));
    }
  };

  d.transaction(() => {
    for (let i = 0; i < DAYS; i++) {
      const dayStart = start + i * DAY_MS;
      const date = new Date(dayStart).toISOString().slice(0, 10);
      const weekday = new Date(dayStart).getUTCDay();
      const season =
        (weekday === 0 || weekday === 6 ? 1.18 : 1) * (0.7 + 0.6 * (i / DAYS));
      const organic = poisson(rand, 42 * season);
      for (let n = 0; n < organic; n++) addUser(dayStart, "organic", null);
      for (const kw of KEYWORDS) {
        const impressions = poisson(rand, 260 * kw.volume * season);
        const taps = poisson(
          rand,
          impressions * 0.075 * (0.8 + kw.quality * 0.2),
        );
        const adsInstalls = poisson(rand, taps * 0.58);
        const spend =
          Math.round(taps * kw.cpt * (0.85 + rand() * 0.3) * 100) / 100;
        if (dayStart <= now)
          insertAds.run(
            kw.campaign,
            `${kw.campaign}01`,
            kw.id,
            kw.term,
            "us",
            date,
            impressions,
            taps,
            adsInstalls,
            spend,
          );
        const attributed = Math.round(adsInstalls * (0.82 + rand() * 0.1));
        for (let n = 0; n < attributed; n++) addUser(dayStart, "apple_ads", kw);
      }
    }
  })();
  return d;
}

type DemoCache = { day: string; db: Database.Database };
type GlobalWithDemo = typeof globalThis & { __openAsoDemoDb?: DemoCache };

export function demoDb(): Database.Database {
  const g = globalThis as GlobalWithDemo;
  const today = `${new Date().toISOString().slice(0, 10)}:${DEMO_VERSION}`;
  if (g.__openAsoDemoDb?.day === today) return g.__openAsoDemoDb.db;
  g.__openAsoDemoDb?.db.close();
  const db = build(today.slice(0, 10));
  g.__openAsoDemoDb = { day: today, db };
  return db;
}
