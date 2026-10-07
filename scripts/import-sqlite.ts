import path from "node:path";
import { parseArgs } from "node:util";
import Database from "better-sqlite3";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd(), true, { info: () => undefined, error: console.error });

type Row = Record<string, unknown>;

const { values: args } = parseArgs({
  options: {
    file: { type: "string" },
    email: { type: "string" },
    workspace: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    "overwrite-settings": { type: "boolean", default: false },
  },
});

function usage(message: string): never {
  console.error(`${message}\n\nUsage: npx tsx --tsconfig tsconfig.json scripts/import-sqlite.ts --file <open-aso.sqlite> --email <user e-mail> [--workspace <id>] [--dry-run] [--overwrite-settings]`);
  process.exit(1);
}

function ts(value: unknown) {
  if (value == null || value === "") return null;
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) return `${s.replace(" ", "T")}Z`;
  return s;
}

function jsonText(value: unknown) {
  if (value == null || value === "") return null;
  try {
    return JSON.stringify(JSON.parse(String(value)));
  } catch {
    return null;
  }
}

function num(value: unknown) {
  return value == null ? null : Number(value);
}

async function main() {
  if (!args.file) usage("--file is required");
  if (!args.email && !args.workspace) usage("--email (or --workspace) is required");
  const dryRun = args["dry-run"];
  const file = path.resolve(args.file);
  const old = new Database(file, { readonly: true, fileMustExist: true });
  const hasTable = (name: string) => !!old.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
  const rows = <T extends Row = Row>(sql: string, ...params: unknown[]) => old.prepare(sql).all(...params) as T[];
  const table = <T extends Row = Row>(name: string) => (hasTable(name) ? rows<T>(`SELECT * FROM ${name}`) : []);

  const { db, pool } = await import("@/lib/server/db");
  const { setSetting, getSetting } = await import("@/lib/server/settings");
  type SettingKey = Parameters<typeof setSetting>[1];

  try {
    await db.ready();
    let workspaceId = args.workspace ?? null;
    let workspaceName = "";
    if (!workspaceId) {
      const member = await db.get<{ organizationId: string; name: string }>(
        `SELECT m."organizationId", o."name" FROM "member" m JOIN "user" u ON u."id" = m."userId" JOIN "organization" o ON o."id" = m."organizationId"
          WHERE lower(u."email") = lower(?) ORDER BY m."createdAt" ASC LIMIT 1`,
        [args.email],
      );
      if (!member) usage(`No workspace found for ${args.email}. Sign in once first so the user and a personal workspace exist.`);
      workspaceId = member.organizationId;
      workspaceName = member.name;
    } else {
      const org = await db.get<{ name: string }>(`SELECT "name" FROM "organization" WHERE "id" = ?`, [workspaceId]);
      if (!org) usage(`Workspace ${workspaceId} not found`);
      workspaceName = org.name;
    }
    const ws: string = workspaceId;

    const apps = table<{ id: number; track_id: number }>("apps");
    const keywords = table<{ id: number; app_id: number }>("keywords");
    const snapshots = table<{ keyword_id: number }>("keyword_snapshots");
    const competitors = table<{ app_id: number }>("competitors");
    const versions = table("app_versions");
    const settings = table<{ key: string; value: string }>("settings").filter((s) => !s.key.startsWith("mcp."));
    const adsDaily = table("ads_keyword_daily");
    const installs = table<{ app_id: number | null }>("installs");
    const revenue = table<{ app_id: number | null }>("revenue_events");
    const posthogMap = table<{ app_id: number }>("posthog_app_map");
    const posthogRoles = table<{ app_id: number }>("posthog_event_roles");
    const pgTables = new Set((await db.all<{ table_name: string }>("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")).map((r) => r.table_name));

    const existing = new Map(
      (await db.all<{ id: number; track_id: number }>("SELECT id, track_id FROM apps WHERE workspace_id = ?", [ws])).map((a) => [Number(a.track_id), Number(a.id)]),
    );
    const toCreate = apps.filter((a) => !existing.has(Number(a.track_id)));
    const skipped = apps.filter((a) => existing.has(Number(a.track_id)));
    const createIds = new Set(toCreate.map((a) => a.id));

    console.log(`Source:     ${file}`);
    console.log(`Workspace:  ${workspaceName} (${ws})${dryRun ? "  [dry run, nothing is written]" : ""}`);
    console.log(
      `Found:      ${apps.length} apps, ${keywords.length} keywords, ${snapshots.length} snapshots, ${competitors.length} competitors, ${versions.length} app versions, ${settings.length} settings, ${adsDaily.length} ads keyword-days, ${installs.length} installs, ${revenue.length} revenue events`,
    );
    if (skipped.length) console.log(`Skipping:   ${skipped.length} app(s) already in this workspace (track ids ${skipped.map((a) => a.track_id).join(", ")})`);

    if (dryRun) {
      const kw = keywords.filter((k) => createIds.has(k.app_id));
      const kwIds = new Set(kw.map((k) => k.id));
      console.log(
        `Would add:  ${toCreate.length} apps, ${kw.length} keywords, ${snapshots.filter((s) => kwIds.has(s.keyword_id)).length} snapshots, ${competitors.filter((c) => createIds.has(c.app_id)).length} competitors`,
      );
      console.log(`Settings:   ${settings.map((s) => s.key).join(", ") || "none"}`);
      return;
    }

    const summary = { apps: 0, keywords: 0, snapshots: 0, competitors: 0, versions: 0, settings: 0, settingsSkipped: 0, adsDaily: 0, installs: 0, revenue: 0, posthog: 0 };
    const appMap = new Map<number, number>();
    for (const a of skipped) appMap.set(a.id, existing.get(Number(a.track_id))!);

    await db.tx(async (t) => {
      for (const a of apps.filter((x) => createIds.has(x.id)) as Row[]) {
        const created = await t.get<{ id: number }>(
          `INSERT INTO apps (workspace_id, track_id, name, subtitle, icon_url, bundle_id, developer, primary_country, is_mine, asc_app_id, data, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, coalesce(?::timestamptz, now())) RETURNING id`,
          [ws, a.track_id, a.name, a.subtitle, a.icon_url, a.bundle_id, a.developer, a.primary_country ?? "us", !!a.is_mine, a.asc_app_id, jsonText(a.data), ts(a.created_at)],
        );
        appMap.set(Number(a.id), created!.id);
        summary.apps++;
      }

      const keywordMap = new Map<number, number>();
      for (const k of keywords as Row[]) {
        if (!createIds.has(Number(k.app_id))) continue;
        const created = await t.get<{ id: number }>(
          `INSERT INTO keywords (app_id, term, country, notes, liked, popularity, difficulty, position, downloads_est, top5_downloads, top5_mrr, label, results_count, top_apps, last_refreshed_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::timestamptz, coalesce(?::timestamptz, now()))
           ON CONFLICT (app_id, term, country) DO NOTHING RETURNING id`,
          [
            appMap.get(Number(k.app_id)),
            k.term,
            k.country,
            k.notes,
            !!k.liked,
            num(k.popularity),
            num(k.difficulty),
            num(k.position),
            num(k.downloads_est),
            num(k.top5_downloads),
            num(k.top5_mrr),
            k.label,
            num(k.results_count),
            jsonText(k.top_apps),
            ts(k.last_refreshed_at),
            ts(k.created_at),
          ],
        );
        if (created) {
          keywordMap.set(Number(k.id), created.id);
          summary.keywords++;
        }
      }

      for (const s of snapshots as Row[]) {
        const id = keywordMap.get(Number(s.keyword_id));
        if (!id) continue;
        summary.snapshots += await t.run(
          "INSERT INTO keyword_snapshots (keyword_id, date, popularity, difficulty, position) VALUES (?, ?::date, ?, ?, ?) ON CONFLICT DO NOTHING",
          [id, String(s.date).slice(0, 10), num(s.popularity), num(s.difficulty), num(s.position)],
        );
      }

      for (const c of competitors as Row[]) {
        if (!createIds.has(Number(c.app_id))) continue;
        summary.competitors += await t.run(
          `INSERT INTO competitors (app_id, track_id, name, icon_url, developer, country, data, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, coalesce(?::timestamptz, now())) ON CONFLICT (app_id, track_id) DO NOTHING`,
          [appMap.get(Number(c.app_id)), c.track_id, c.name, c.icon_url, c.developer, c.country ?? "us", jsonText(c.data), ts(c.created_at)],
        );
      }

      for (const v of versions as Row[]) {
        summary.versions += await t.run("INSERT INTO app_versions (track_id, version, released_at) VALUES (?, ?, ?::timestamptz) ON CONFLICT DO NOTHING", [
          v.track_id,
          v.version,
          ts(v.released_at),
        ]);
      }

      for (const d of adsDaily as Row[]) {
        summary.adsDaily += await t.run(
          `INSERT INTO ads_keyword_daily (workspace_id, org_id, campaign_id, ad_group_id, keyword_id, keyword, country, date, impressions, taps, installs, spend, currency)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?::date, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
          [ws, d.org_id, d.campaign_id, d.ad_group_id, d.keyword_id, d.keyword, d.country, String(d.date).slice(0, 10), d.impressions ?? 0, d.taps ?? 0, d.installs ?? 0, d.spend ?? 0, d.currency],
        );
      }

      for (const i of installs as Row[]) {
        const appId = i.app_id == null ? null : (appMap.get(Number(i.app_id)) ?? null);
        if (i.app_id != null && appId == null) continue;
        summary.installs += await t.run(
          `INSERT INTO installs (workspace_id, app_id, user_id, country, city, source, campaign_id, ad_group_id, keyword_id, keyword, installed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, coalesce(?::timestamptz, now())) ON CONFLICT DO NOTHING`,
          [ws, appId, i.user_id, i.country, i.city, i.source ?? "organic", i.campaign_id, i.ad_group_id, i.keyword_id, i.keyword, ts(i.installed_at)],
        );
      }

      for (const r of revenue as Row[]) {
        const appId = r.app_id == null ? null : (appMap.get(Number(r.app_id)) ?? null);
        if (r.app_id != null && appId == null) continue;
        summary.revenue += await t.run(
          `INSERT INTO revenue_events (id, workspace_id, provider, app_id, user_id, type, product_id, amount_usd, country, occurred_at, raw)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::timestamptz, ?::jsonb) ON CONFLICT DO NOTHING`,
          [r.id, ws, r.provider, appId, r.user_id, r.type, r.product_id, r.amount_usd ?? 0, r.country, ts(r.occurred_at), jsonText(r.raw)],
        );
      }

      if (pgTables.has("posthog_app_map"))
        for (const m of posthogMap as Row[]) {
          if (!createIds.has(Number(m.app_id))) continue;
          summary.posthog += await t.run(
            "INSERT INTO posthog_app_map (app_id, workspace_id, bundle_id, prefix, auto, updated_at) VALUES (?, ?, ?, ?, ?, coalesce(?::timestamptz, now())) ON CONFLICT DO NOTHING",
            [appMap.get(Number(m.app_id)), ws, m.bundle_id, m.prefix, !!m.auto, ts(m.updated_at)],
          );
        }
      if (pgTables.has("posthog_event_roles"))
        for (const r of posthogRoles as Row[]) {
          if (!createIds.has(Number(r.app_id))) continue;
          summary.posthog += await t.run(
            "INSERT INTO posthog_event_roles (app_id, workspace_id, role, events, updated_at) VALUES (?, ?, ?, ?::jsonb, coalesce(?::timestamptz, now())) ON CONFLICT DO NOTHING",
            [appMap.get(Number(r.app_id)), ws, r.role, jsonText(r.events) ?? "[]", ts(r.updated_at)],
          );
        }
    });

    for (const s of settings) {
      const key = s.key as SettingKey;
      if (!args["overwrite-settings"] && (await getSetting(ws, key)) !== undefined) {
        summary.settingsSkipped++;
        continue;
      }
      await setSetting(ws, key, s.value);
      summary.settings++;
    }

    console.log(
      `Imported:   ${summary.apps} apps, ${summary.keywords} keywords, ${summary.snapshots} snapshots, ${summary.competitors} competitors, ${summary.versions} app versions, ${summary.adsDaily} ads keyword-days, ${summary.installs} installs, ${summary.revenue} revenue events, ${summary.posthog} PostHog mappings`,
    );
    console.log(`Settings:   ${summary.settings} written (secrets encrypted)${summary.settingsSkipped ? `, ${summary.settingsSkipped} already set and kept (use --overwrite-settings to replace)` : ""}`);
    const leftover = ["ads_change_log", "ads_custom_reports", "ads_impression_share", "ads_prefs", "analytics_sessions", "attribution_pending", "integration_events"].filter(
      (name) => hasTable(name) && (old.prepare(`SELECT count(*) AS n FROM ${name}`).get() as { n: number }).n > 0,
    );
    if (leftover.length) console.log(`Not copied: ${leftover.join(", ")} (module-specific history; reconnect or resync those integrations)`);
  } finally {
    old.close();
    await pool().end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
