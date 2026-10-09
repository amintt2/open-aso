import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import pg from "pg";

const { values } = parseArgs({
  options: {
    email: { type: "string", default: "dev@example.com" },
    days: { type: "string", default: "90" },
    manifest: { type: "string", default: path.join(os.tmpdir(), "open-aso-seed-history.json") },
    clean: { type: "boolean", default: false },
  },
});

type Manifest = { workspaceId: string; snapshots: [number, string][]; versions: [number, string][] };
type KeywordRow = { id: number; country: string; popularity: number | null; difficulty: number | null; position: number | null };

const DAY = 86400000;

function guard() {
  if (process.env.OPEN_ASO_DEV_LOGIN !== "1") throw new Error("Refusing to run: OPEN_ASO_DEV_LOGIN must be 1");
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to run with NODE_ENV=production");
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("Refusing to run against a non-local database");
}

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

async function workspaceFor(client: pg.Client, email: string) {
  const res = await client.query<{ organizationId: string }>(
    `SELECT m."organizationId" FROM "member" m JOIN "user" u ON u."id" = m."userId" WHERE lower(u."email") = lower($1) ORDER BY m."createdAt" ASC LIMIT 1`,
    [email],
  );
  if (!res.rows[0]) throw new Error(`No workspace for ${email}`);
  return res.rows[0].organizationId;
}

async function seed(client: pg.Client) {
  if (fs.existsSync(values.manifest!)) throw new Error(`Manifest ${values.manifest} exists; run with --clean first`);
  const workspaceId = await workspaceFor(client, values.email!);
  const days = Math.max(7, Math.min(400, Number(values.days) || 90));
  const today = (await client.query<{ today: string }>("SELECT current_date::text AS today")).rows[0].today;
  const end = Date.parse(`${today}T00:00:00Z`);
  const keywords = (
    await client.query<KeywordRow>(
      `SELECT k.id::int AS id, k.country, k.popularity, k.difficulty, k.position FROM keywords k JOIN apps a ON a.id = k.app_id WHERE a.workspace_id = $1`,
      [workspaceId],
    )
  ).rows;
  const manifest: Manifest = { workspaceId, snapshots: [], versions: [] };
  for (const k of keywords) {
    const random = rng(k.id * 7919);
    let position: number | null = k.position;
    let popularity = k.popularity ?? 30;
    let difficulty = k.difficulty ?? 40;
    let rank = position ?? 120 + Math.round(random() * 60);
    const drift = random() < 0.5 ? -1 : 1;
    for (let d = 1; d < days; d++) {
      const date = new Date(end - d * DAY).toISOString().slice(0, 10);
      rank = clamp(rank + drift * (0.6 + random() * 1.4) + (random() - 0.5) * 6, 1, 230);
      position = rank > 200 || random() < 0.03 ? null : Math.round(rank);
      popularity = clamp(popularity + (random() - 0.5) * 3, 5, 95);
      difficulty = clamp(difficulty + (random() - 0.5) * 2, 1, 99);
      if (random() < 0.08) continue;
      const res = await client.query<{ keyword_id: number; date: string }>(
        `INSERT INTO keyword_snapshots (keyword_id, date, popularity, difficulty, position) VALUES ($1, $2::date, $3, $4, $5)
         ON CONFLICT (keyword_id, date) DO NOTHING RETURNING keyword_id::int, date::text`,
        [k.id, date, Math.round(popularity), Math.round(difficulty), position],
      );
      for (const row of res.rows) manifest.snapshots.push([row.keyword_id, row.date]);
    }
  }
  const apps = (await client.query<{ track_id: number }>("SELECT DISTINCT track_id::bigint AS track_id FROM apps WHERE workspace_id = $1", [workspaceId])).rows;
  for (const app of apps) {
    for (const [version, back] of [
      ["0.9.0-seed", Math.round(days * 0.7)],
      ["0.9.5-seed", Math.round(days * 0.25)],
    ] as const) {
      const res = await client.query(
        "INSERT INTO app_versions (track_id, version, released_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING version",
        [app.track_id, version, new Date(end - back * DAY + 15 * 3600000).toISOString()],
      );
      if (res.rowCount) manifest.versions.push([Number(app.track_id), version]);
    }
  }
  await client.query("DELETE FROM cache WHERE key LIKE $1", [`ws:${workspaceId}:trends:%`]);
  fs.writeFileSync(values.manifest!, JSON.stringify(manifest));
  console.log(`Seeded ${manifest.snapshots.length} snapshots for ${keywords.length} keywords and ${manifest.versions.length} versions. Manifest: ${values.manifest}`);
}

async function clean(client: pg.Client) {
  if (!fs.existsSync(values.manifest!)) throw new Error(`No manifest at ${values.manifest}`);
  const manifest = JSON.parse(fs.readFileSync(values.manifest!, "utf8")) as Manifest;
  const removed = await client.query(
    "DELETE FROM keyword_snapshots s USING unnest($1::bigint[], $2::date[]) AS t(id, d) WHERE s.keyword_id = t.id AND s.date = t.d",
    [manifest.snapshots.map((s) => s[0]), manifest.snapshots.map((s) => s[1])],
  );
  const versions = await client.query(
    "DELETE FROM app_versions v USING unnest($1::bigint[], $2::text[]) AS t(track, version) WHERE v.track_id = t.track AND v.version = t.version",
    [manifest.versions.map((v) => v[0]), manifest.versions.map((v) => v[1])],
  );
  await client.query("DELETE FROM cache WHERE key LIKE $1", [`ws:${manifest.workspaceId}:trends:%`]);
  fs.unlinkSync(values.manifest!);
  console.log(`Removed ${removed.rowCount} seeded snapshots and ${versions.rowCount} seeded versions.`);
}

async function main() {
  guard();
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await (values.clean ? clean(client) : seed(client));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
