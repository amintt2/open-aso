import fs from "node:fs";
import path from "node:path";
import { pool, rawDb } from "./db";

const DIR = path.join(process.cwd(), "db", "migrations");
const LOCK = 7321901;

export async function migrate() {
  const client = await pool().connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [LOCK]);
    const { getMigrations } = await import("better-auth/db/migration");
    const { authOptions } = await import("@/lib/auth");
    const { runMigrations } = await getMigrations(authOptions);
    await runMigrations();
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
    const applied = new Set((await client.query<{ name: string }>("SELECT name FROM schema_migrations")).rows.map((r) => r.name));
    const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort() : [];
    for (const file of files) {
      if (applied.has(file)) continue;
      const text = fs.readFileSync(path.join(DIR, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(text);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${file} failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK]).catch(() => undefined);
    client.release();
  }
}

export { rawDb };
