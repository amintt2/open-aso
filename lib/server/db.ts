import { Pool, types, type PoolClient, type QueryResultRow } from "pg";

types.setTypeParser(20, (v) => Number(v));
types.setTypeParser(1700, (v) => Number(v));
types.setTypeParser(1184, (v) => new Date(v).toISOString());
types.setTypeParser(1114, (v) => new Date(`${v.replace(" ", "T")}Z`).toISOString());
types.setTypeParser(1082, (v) => v);

type GlobalWithPool = typeof globalThis & { __openAsoPool?: Pool; __openAsoReady?: Promise<void> };

export function pool(): Pool {
  const g = globalThis as GlobalWithPool;
  if (g.__openAsoPool) return g.__openAsoPool;
  g.__openAsoPool = new Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.OPEN_ASO_DB_POOL ?? 10) });
  return g.__openAsoPool;
}

function placeholders(text: string) {
  let i = 0;
  let out = "";
  let quote: string | null = null;
  for (let c = 0; c < text.length; c++) {
    const ch = text[c];
    if (quote) {
      out += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === "?" && text[c + 1] !== "|" && text[c + 1] !== "&" && text[c - 1] !== "?") {
      out += `$${++i}`;
      continue;
    }
    out += ch;
  }
  return out;
}

async function ready() {
  const g = globalThis as GlobalWithPool;
  if (!g.__openAsoReady) {
    g.__openAsoReady = import("./migrate").then((m) => m.migrate()).catch((error) => {
      g.__openAsoReady = undefined;
      throw error;
    });
  }
  return g.__openAsoReady;
}

export type Params = unknown[];

export type Queryable = {
  all<T extends QueryResultRow = QueryResultRow>(text: string, params?: Params): Promise<T[]>;
  get<T extends QueryResultRow = QueryResultRow>(text: string, params?: Params): Promise<T | undefined>;
  run(text: string, params?: Params): Promise<number>;
};

function queryable(exec: () => Pool | PoolClient, waitReady: boolean): Queryable {
  const query = async <T extends QueryResultRow>(text: string, params: Params = []) => {
    if (waitReady) await ready();
    return exec().query<T>(placeholders(text), params);
  };
  return {
    all: async <T extends QueryResultRow>(text: string, params?: Params) => (await query<T>(text, params)).rows,
    get: async <T extends QueryResultRow>(text: string, params?: Params) => (await query<T>(text, params)).rows[0],
    run: async (text, params) => (await query(text, params)).rowCount ?? 0,
  };
}

export const db: Queryable & {
  tx<T>(fn: (t: Queryable) => Promise<T>): Promise<T>;
  ready: () => Promise<void>;
} = {
  ...queryable(pool, true),
  ready,
  async tx(fn) {
    await ready();
    const client = await pool().connect();
    try {
      await client.query("BEGIN");
      const result = await fn(queryable(() => client, false));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  },
};

export const rawDb = queryable(pool, false);

export function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null || value === "") return fallback;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
