import { z } from "zod";
import { db, type Queryable } from "@/lib/server/db";
import { cacheDelete, wsKey } from "@/lib/server/cache";
import { HttpError } from "@/lib/server/http";
import { SECRET_KEYS } from "@/lib/server/settings";

export const EXPORT_FORMAT = "open-aso-export";
export const CONFIRM_PHRASE = "DELETE ALL DATA";

const NEVER_SCOPED = new Set([
  "cache",
  "schema_migrations",
  "api_tokens",
  "workspace_plans",
  "user",
  "session",
  "account",
  "verification",
  "organization",
  "member",
  "invitation",
]);
const NOT_PORTABLE = new Set([
  "attribution_pending",
  "integration_events",
  "ads_change_log",
]);
const COUNTERS = /usage/;
const NOT_PORTABLE_PATTERN = /(usage|_logs?|_jobs?)$/;
const SECRET_SETTING = /(privateKey|anthropicKey|apiKey|token|secret)$/i;
const LEGACY_TABLES: Record<string, string> = {
  settings: "workspace_settings",
};

type Column = {
  name: string;
  type: string;
  nullable: boolean;
  serial: boolean;
};
type ForeignKey = { column: string; refTable: string; refColumn: string };

type TableInfo = {
  name: string;
  columns: Map<string, Column>;
  fks: ForeignKey[];
  uniques: string[][];
  serialPk: string | null;
  scope: { sql: string; params: number } | null;
  depth: number;
};

function quote(name: string) {
  return `"${name.replace(/"/g, '""')}"`;
}

function isSecretSetting(key: unknown) {
  return (
    typeof key === "string" &&
    (SECRET_KEYS.includes(key as (typeof SECRET_KEYS)[number]) ||
      SECRET_SETTING.test(key))
  );
}

function portable(name: string) {
  return !NOT_PORTABLE.has(name) && !NOT_PORTABLE_PATTERN.test(name);
}

async function schema(q: Queryable = db): Promise<Map<string, TableInfo>> {
  const [columns, fks, uniques] = await Promise.all([
    q.all<{
      table: string;
      column: string;
      type: string;
      nullable: boolean;
      serial: boolean;
    }>(
      `SELECT c.table_name AS "table", c.column_name AS "column", c.udt_name AS type, c.is_nullable = 'YES' AS nullable,
              COALESCE(c.column_default LIKE 'nextval(%', false) AS serial
       FROM information_schema.columns c
       JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
       WHERE c.table_schema = 'public' ORDER BY c.table_name, c.ordinal_position`,
    ),
    q.all<ForeignKey & { table: string }>(
      `SELECT cl.relname AS "table", a.attname AS "column", rc.relname AS "refTable", af.attname AS "refColumn"
       FROM pg_constraint con
       JOIN pg_class cl ON cl.oid = con.conrelid
       JOIN pg_class rc ON rc.oid = con.confrelid
       JOIN LATERAL unnest(con.conkey, con.confkey) AS k(attnum, fattnum) ON true
       JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.attnum
       JOIN pg_attribute af ON af.attrelid = con.confrelid AND af.attnum = k.fattnum
       WHERE con.contype = 'f' AND con.connamespace = 'public'::regnamespace`,
    ),
    q.all<{ table: string; columns: string[] }>(
      `SELECT cl.relname AS "table", array_agg(a.attname::text ORDER BY k.ord) AS columns
       FROM pg_constraint con
       JOIN pg_class cl ON cl.oid = con.conrelid
       JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
       JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.attnum
       WHERE con.contype IN ('p', 'u') AND con.connamespace = 'public'::regnamespace
       GROUP BY cl.relname, con.oid, con.contype
       ORDER BY con.contype, cl.relname`,
    ),
  ]);
  const tables = new Map<string, TableInfo>();
  for (const c of columns) {
    if (NEVER_SCOPED.has(c.table)) continue;
    const t = tables.get(c.table) ?? {
      name: c.table,
      columns: new Map(),
      fks: [],
      uniques: [],
      serialPk: null,
      scope: null,
      depth: 0,
    };
    t.columns.set(c.column, {
      name: c.column,
      type: c.type,
      nullable: c.nullable,
      serial: c.serial,
    });
    tables.set(c.table, t);
  }
  for (const fk of fks)
    tables.get(fk.table)?.fks.push({
      column: fk.column,
      refTable: fk.refTable,
      refColumn: fk.refColumn,
    });
  for (const u of uniques) {
    const t = tables.get(u.table);
    if (!t) continue;
    t.uniques.push(u.columns);
    if (
      u.columns.length === 1 &&
      t.columns.get(u.columns[0])?.serial &&
      !t.serialPk
    )
      t.serialPk = u.columns[0];
  }
  for (const t of tables.values())
    if (t.columns.has("workspace_id"))
      t.scope = { sql: "workspace_id = ?", params: 1 };
  for (let changed = true; changed; ) {
    changed = false;
    for (const t of tables.values()) {
      if (t.scope) continue;
      const fk = t.fks.find(
        (f) => f.refTable !== t.name && tables.get(f.refTable)?.scope,
      );
      if (!fk) continue;
      const ref = tables.get(fk.refTable)!;
      t.scope = {
        sql: `${quote(fk.column)} IN (SELECT ${quote(fk.refColumn)} FROM ${quote(ref.name)} WHERE ${ref.scope!.sql})`,
        params: ref.scope!.params,
      };
      changed = true;
    }
  }
  for (const [name, t] of tables) if (!t.scope) tables.delete(name);
  const depth = (t: TableInfo, seen = new Set<string>()): number => {
    if (seen.has(t.name)) return 0;
    seen.add(t.name);
    const parents = t.fks
      .map((f) => tables.get(f.refTable))
      .filter((p): p is TableInfo => !!p && p.name !== t.name);
    return parents.length
      ? 1 + Math.max(...parents.map((p) => depth(p, new Set(seen))))
      : 0;
  };
  for (const t of tables.values()) t.depth = depth(t);
  return tables;
}

function ordered(tables: Map<string, TableInfo>) {
  return [...tables.values()].sort(
    (a, b) => a.depth - b.depth || a.name.localeCompare(b.name),
  );
}

function scopeParams(t: TableInfo, workspaceId: string) {
  return Array.from({ length: t.scope!.params }, () => workspaceId);
}

export async function exportWorkspace(workspaceId: string) {
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const t of ordered(await schema())) {
    if (!portable(t.name)) continue;
    const rows = await db.all<Record<string, unknown>>(
      `SELECT * FROM ${quote(t.name)} WHERE ${t.scope!.sql}`,
      scopeParams(t, workspaceId),
    );
    const clean = rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).filter(([key]) => key !== "workspace_id"),
      ),
    );
    tables[t.name] =
      t.name === "workspace_settings"
        ? clean.filter((r) => !isSecretSetting(r.key))
        : clean;
  }
  return {
    format: EXPORT_FORMAT,
    version: 2,
    exportedAt: new Date().toISOString(),
    credentialsIncluded: false,
    tables,
  };
}

export const importPayload = z.object({
  format: z.literal(EXPORT_FORMAT),
  version: z.number().int().min(1).max(2),
  tables: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
});

async function clearWorkspace(
  q: Queryable,
  tables: Map<string, TableInfo>,
  workspaceId: string,
  keepSecrets: boolean,
) {
  for (const t of ordered(tables).reverse()) {
    if (COUNTERS.test(t.name)) continue;
    if (t.name === "workspace_settings" && keepSecrets) {
      const keys = (
        await q.all<{ key: string }>(
          "SELECT key FROM workspace_settings WHERE workspace_id = ?",
          [workspaceId],
        )
      )
        .map((r) => r.key)
        .filter((k) => !isSecretSetting(k));
      if (keys.length)
        await q.run(
          "DELETE FROM workspace_settings WHERE workspace_id = ? AND key = ANY(?::text[])",
          [workspaceId, keys],
        );
      continue;
    }
    await q.run(
      `DELETE FROM ${quote(t.name)} WHERE ${t.scope!.sql}`,
      scopeParams(t, workspaceId),
    );
  }
  if (!keepSecrets)
    await q.run("DELETE FROM api_tokens WHERE workspace_id = ?", [workspaceId]);
}

const SQLITE_TIMESTAMP = /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d(\.\d+)?$/;

function coerce(value: unknown, column: Column) {
  if (value === undefined || value === null) return null;
  if (column.type === "bool")
    return typeof value === "string"
      ? value === "true" || value === "1"
      : !!value;
  if (column.type === "json" || column.type === "jsonb") {
    if (typeof value !== "string") return JSON.stringify(value);
    try {
      JSON.parse(value);
      return value;
    } catch {
      return JSON.stringify(value);
    }
  }
  if (
    (column.type === "timestamptz" || column.type === "timestamp") &&
    typeof value === "string" &&
    SQLITE_TIMESTAMP.test(value)
  )
    return `${value.replace(" ", "T")}Z`;
  if (column.type.startsWith("_")) return Array.isArray(value) ? value : null;
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

type IdMap = Map<string, Map<string, number>>;

function conflictTarget(
  t: TableInfo,
  tables: Map<string, TableInfo>,
  keys: string[],
) {
  const safe = (cols: string[]) =>
    cols.includes("workspace_id") ||
    cols.some((c) =>
      t.fks.some((f) => f.column === c && tables.has(f.refTable)),
    );
  return (
    t.uniques.find(
      (cols) =>
        !(cols.length === 1 && cols[0] === t.serialPk) &&
        cols.every((c) => keys.includes(c)) &&
        safe(cols),
    ) ?? null
  );
}

async function importRow(
  q: Queryable,
  t: TableInfo,
  tables: Map<string, TableInfo>,
  row: Record<string, unknown>,
  workspaceId: string,
  ids: IdMap,
) {
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row))
    if (t.columns.has(key) && key !== t.serialPk) values[key] = value;
  if (t.columns.has("workspace_id")) values.workspace_id = workspaceId;
  for (const fk of t.fks) {
    if (fk.column === "workspace_id" || values[fk.column] == null) continue;
    const column = t.columns.get(fk.column)!;
    const ref = tables.get(fk.refTable);
    if (ref?.serialPk === fk.refColumn) {
      const mapped = ids.get(ref.name)?.get(String(values[fk.column]));
      if (mapped === undefined) {
        if (!column.nullable) return false;
        values[fk.column] = null;
      } else values[fk.column] = mapped;
    } else if (!ref && column.nullable) values[fk.column] = null;
  }
  const keys = Object.keys(values);
  if (!keys.length) return false;
  const params = keys.map((k) => coerce(values[k], t.columns.get(k)!));
  const target = conflictTarget(t, tables, keys);
  const updates = target ? keys.filter((k) => !target.includes(k)) : [];
  const action = target
    ? updates.length
      ? `(${target.map(quote).join(", ")}) DO UPDATE SET ${updates.map((k) => `${quote(k)} = excluded.${quote(k)}`).join(", ")}`
      : `(${target.map(quote).join(", ")}) DO NOTHING`
    : "DO NOTHING";
  const returning = t.serialPk ? ` RETURNING ${quote(t.serialPk)} AS id` : "";
  const inserted = await q.get<{ id: number }>(
    `INSERT INTO ${quote(t.name)} (${keys.map(quote).join(", ")}) VALUES (${keys.map(() => "?").join(", ")}) ON CONFLICT ${action}${returning}`,
    params,
  );
  if (!t.serialPk) return true;
  let id = inserted?.id;
  if (id === undefined && target) {
    const existing = await q.get<{ id: number }>(
      `SELECT ${quote(t.serialPk)} AS id FROM ${quote(t.name)} WHERE ${target.map((c) => `${quote(c)} = ?`).join(" AND ")} LIMIT 1`,
      target.map((c) => params[keys.indexOf(c)]),
    );
    id = existing?.id;
  }
  if (id === undefined) return false;
  const oldId = row[t.serialPk];
  if (oldId != null) {
    const map = ids.get(t.name) ?? new Map<string, number>();
    map.set(String(oldId), id);
    ids.set(t.name, map);
  }
  return inserted !== undefined;
}

export async function importWorkspace(
  workspaceId: string,
  payload: z.infer<typeof importPayload>,
  mode: "merge" | "replace",
) {
  const tables = await schema();
  const incoming = new Map<string, Record<string, unknown>[]>();
  for (const [name, rows] of Object.entries(payload.tables)) {
    const target = LEGACY_TABLES[name] ?? name;
    if (!tables.has(target) || !portable(target)) continue;
    incoming.set(target, [...(incoming.get(target) ?? []), ...rows]);
  }
  const summary: Record<string, number> = {};
  let skipped = 0;
  await db.tx(async (q) => {
    if (mode === "replace") await clearWorkspace(q, tables, workspaceId, true);
    const ids: IdMap = new Map();
    for (const t of ordered(tables)) {
      const rows = incoming.get(t.name);
      if (!rows?.length) continue;
      let count = 0;
      for (const row of rows) {
        if (t.name === "workspace_settings" && isSecretSetting(row.key))
          continue;
        await q.run("SAVEPOINT import_row");
        try {
          if (await importRow(q, t, tables, row, workspaceId, ids)) count++;
          else skipped++;
          await q.run("RELEASE SAVEPOINT import_row");
        } catch {
          await q.run("ROLLBACK TO SAVEPOINT import_row");
          skipped++;
        }
      }
      summary[t.name] = count;
    }
  });
  await cacheDelete(wsKey(workspaceId, ""));
  return { imported: summary, skipped };
}

export async function wipeWorkspace(workspaceId: string) {
  const tables = await schema();
  await db.tx((q) => clearWorkspace(q, tables, workspaceId, false));
  await cacheDelete(wsKey(workspaceId, ""));
}

export function assertConfirmation(value: string) {
  if (value !== CONFIRM_PHRASE)
    throw new HttpError(400, `Type "${CONFIRM_PHRASE}" to confirm`);
}
