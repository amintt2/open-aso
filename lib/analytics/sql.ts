import type Database from "better-sqlite3";
import type { QueryResultRow } from "pg";
import { db } from "@/lib/server/db";

export type Named = Record<string, unknown>;

export type Runner = {
  all<T extends QueryResultRow>(sql: string, params?: Named): Promise<T[]>;
  get<T extends QueryResultRow>(
    sql: string,
    params?: Named,
  ): Promise<T | undefined>;
};

export function compile(sql: string, params: Named) {
  const values: unknown[] = [];
  const text = sql.replace(/@([A-Za-z_][A-Za-z0-9_]*)/g, (_, name: string) => {
    if (!(name in params)) throw new Error(`Missing SQL parameter @${name}`);
    values.push(params[name] ?? null);
    return "?";
  });
  return { text, values };
}

export const pgRunner: Runner = {
  all: (sql, params = {}) => {
    const c = compile(sql, params);
    return db.all(c.text, c.values);
  },
  get: (sql, params = {}) => {
    const c = compile(sql, params);
    return db.get(c.text, c.values);
  },
};

export function sqliteRunner(d: Database.Database): Runner {
  return {
    all: async <T extends QueryResultRow>(sql: string, params: Named = {}) => {
      const c = compile(sql, params);
      return d.prepare(c.text).all(...c.values) as T[];
    },
    get: async <T extends QueryResultRow>(sql: string, params: Named = {}) => {
      const c = compile(sql, params);
      return d.prepare(c.text).get(...c.values) as T | undefined;
    },
  };
}
