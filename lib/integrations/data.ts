import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { DATA_DIR, db } from "@/lib/server/db";
import { HttpError } from "@/lib/server/http";

const SKIP_TABLES = new Set(["cache", "sqlite_sequence", "sqlite_stat1", "sqlite_stat4"]);
const SECRET_SETTING = /(privateKey|anthropicKey|token|secret)$/i;

export const EXPORT_FORMAT = "open-aso-export";

export function dataDirectory() {
  return path.resolve(DATA_DIR);
}

function tableNames() {
  return (db().prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[])
    .map((t) => t.name)
    .filter((name) => !SKIP_TABLES.has(name));
}

function quote(name: string) {
  return `"${name.replace(/"/g, '""')}"`;
}

function columns(table: string) {
  return db().prepare(`PRAGMA table_info(${quote(table)})`).all() as { name: string; pk: number }[];
}

function upsertSql(table: string, keys: string[], pk: Set<string>) {
  const updates = keys.filter((k) => !pk.has(k));
  const action = updates.length ? `DO UPDATE SET ${updates.map((k) => `${quote(k)} = excluded.${quote(k)}`).join(", ")}` : "DO NOTHING";
  return `INSERT INTO ${quote(table)} (${keys.map(quote).join(", ")}) VALUES (${keys.map(() => "?").join(", ")}) ON CONFLICT ${action}`;
}

function isSecretSetting(key: unknown) {
  return typeof key === "string" && SECRET_SETTING.test(key);
}

export function tableStats() {
  const file = path.join(dataDirectory(), "open-aso.sqlite");
  const size = ["", "-wal", "-shm"].reduce((acc, suffix) => {
    try {
      return acc + fs.statSync(file + suffix).size;
    } catch {
      return acc;
    }
  }, 0);
  return {
    directory: dataDirectory(),
    file,
    sizeBytes: size,
    tables: tableNames().map((name) => ({ name, rows: (db().prepare(`SELECT COUNT(*) AS n FROM ${quote(name)}`).get() as { n: number }).n })),
  };
}

export function exportAll() {
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const name of tableNames()) {
    const rows = db().prepare(`SELECT * FROM ${quote(name)}`).all() as Record<string, unknown>[];
    tables[name] = name === "settings" ? rows.filter((r) => !isSecretSetting(r.key)) : rows;
  }
  return { format: EXPORT_FORMAT, version: 1, exportedAt: new Date().toISOString(), credentialsIncluded: false, tables };
}

export const importPayload = z.object({
  format: z.literal(EXPORT_FORMAT),
  version: z.number().int().min(1).max(1),
  tables: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
});

function clearAll(keepSecrets: boolean) {
  const d = db();
  for (const name of tableNames()) {
    if (name === "settings" && keepSecrets) {
      const keys = (d.prepare("SELECT key FROM settings").all() as { key: string }[]).map((r) => r.key).filter((k) => !isSecretSetting(k));
      const del = d.prepare("DELETE FROM settings WHERE key = ?");
      for (const key of keys) del.run(key);
      continue;
    }
    d.prepare(`DELETE FROM ${quote(name)}`).run();
  }
  if (d.prepare("SELECT 1 FROM sqlite_master WHERE name = 'sqlite_sequence'").get()) d.prepare("DELETE FROM sqlite_sequence").run();
  d.prepare("DELETE FROM cache").run();
}

export function importAll(payload: z.infer<typeof importPayload>, mode: "merge" | "replace") {
  const d = db();
  const existing = new Set(tableNames());
  const summary: Record<string, number> = {};
  const statements = new Map<string, ReturnType<typeof d.prepare>>();
  const statement = (sql: string) => {
    const cached = statements.get(sql);
    if (cached) return cached;
    const created = d.prepare(sql);
    statements.set(sql, created);
    return created;
  };
  d.transaction(() => {
    d.pragma("defer_foreign_keys = ON");
    if (mode === "replace") clearAll(true);
    const ordered = Object.keys(payload.tables).sort((a, b) => (a === "apps" ? -1 : b === "apps" ? 1 : 0));
    for (const table of ordered) {
      if (!existing.has(table)) continue;
      const info = columns(table);
      const cols = new Set(info.map((c) => c.name));
      const pk = new Set(info.filter((c) => c.pk > 0).map((c) => c.name));
      let count = 0;
      for (const row of payload.tables[table]) {
        if (table === "settings" && isSecretSetting(row.key)) continue;
        const keys = Object.keys(row).filter((k) => cols.has(k));
        if (!keys.length) continue;
        const values = keys.map((k) => {
          const v = row[k];
          if (v === null || typeof v === "number" || typeof v === "string" || typeof v === "bigint") return v;
          if (typeof v === "boolean") return v ? 1 : 0;
          return JSON.stringify(v);
        });
        statement(upsertSql(table, keys, pk)).run(...values);
        count++;
      }
      summary[table] = count;
    }
  })();
  return summary;
}

export function wipeAll() {
  const d = db();
  d.transaction(() => {
    d.pragma("defer_foreign_keys = ON");
    clearAll(false);
  })();
  try {
    d.exec("VACUUM");
  } catch {
    return;
  }
}

export function assertConfirmation(value: string) {
  if (value !== "DELETE ALL DATA") throw new HttpError(400, 'Type "DELETE ALL DATA" to confirm');
}
