# Open ASO — agent guide

Open-source, local-first App Store Optimization workspace (feature parity target: AppSprint ASO). Next.js 16 (App Router, Turbopack) + React 19 + Tailwind 4 + Radix primitives, SQLite via better-sqlite3, SWR on the client. UI kit is derived from the MIT "Kargul Starter / sales-crm" template.

Next.js 16 has breaking changes vs older versions: route handler / page `params` are Promises (`await params`), `middleware` is now `proxy`. Check `node_modules/next/dist/docs/` when unsure.

## Layout
- `lib/server/` — server-only: `db.ts` (SQLite + base schema), `cache.ts` (`cached(key, ttl, fn)`), `settings.ts` (credentials/settings KV), `http.ts` (`route()`, `body(req, zodSchema)`, `json()`, `HttpError`, `idParam`).
- `lib/appstore/` — public App Store data: `itunes.ts` (search, lookup, reviews, search hints, `artwork()`), `countries.ts` (66 storefronts).
- `lib/aso/` — ASO domain: `scoring.ts` (popularity/difficulty/estimates/labels — pure, client-safe), `analyze.ts` (`analyzeKeyword`, `popularity`, `rankingsFor`), `apps.ts`, `keywords.ts`.
- `lib/client/` — client: `api.ts` (`api()`, `useApi()` SWR, `revalidate(prefix)`), `format.ts`, `types.ts`, `nav.ts`.
- `components/_ui/` — primitives (Button, Dialog, Sheet, Select, Tabs, Table, Popover, DropdownMenu, Command, Input, Field, Checkbox, Slider, Tag, CountBadge, ScrollArea). Reuse them.
- `components/shell/` — app chrome: `PageHeader`, `CountrySelect`, `EmptyState`, `AppIcon`, `ScoreBar` / `LabelTag` / `PositionBadge`, `AddAppDialog`.
- `hooks/use-app.ts` — `useCurrentApp()`, `useAppCountry(app)`.
- Pages: `app/(workspace)/apps/[appId]/<module>/page.tsx` (app-scoped) and `app/(workspace)/<module>/page.tsx` (global). API: `app/api/**/route.ts`.

## Rules
- Module code lives in its own folders: `components/<module>/`, `lib/<module>/`, `app/api/<module>/`. Don't edit another module's files; shared files (`lib/server/*`, `lib/aso/*`, `components/shell/*`, `components/_ui/*`) only with additive, backwards-compatible changes.
- Extra tables: create them in `lib/<module>/schema.ts` with `CREATE TABLE IF NOT EXISTS` run lazily (`ensureSchema()`), don't edit `lib/server/db.ts`.
- Secrets go through `getSetting/setSetting` (never sent back to the client; `publicSettings()` masks them).
- Server-only modules must not be imported from client components (types via `import type` are fine).
- Styling: Tailwind only, dark theme tokens from `app/globals.css` (`bg-card`, `text-subtle`, `border-border`, `text-soft`, `bg-secondary`, `text-trend`, `text-danger`, …). Always pass an explicit `variant` to `Button`. Icons: `lucide-react`. Typography comes from globals (`h1/h2/h3/p`, `.caption-style`, `.eyebrow-style`, `.lead-style`) — don't restyle font sizes ad hoc.
- No code comments. Match the surrounding style. Keep components small and typed.
- Estimates (downloads, revenue, popularity) are modeled — label them as estimates in the UI.
- Verify with `npx tsc --noEmit -p .` and `npx eslint <your files>` before finishing.

## Multi-tenant SaaS rules (Postgres + workspaces) — these override anything above
- Database is **Postgres** (`DATABASE_URL`), not SQLite. Use `db` from `lib/server/db.ts`: `await db.all<T>(sql, params)`, `await db.get<T>(...)`, `await db.run(...)` (returns rowCount), `await db.tx(async (t) => { await t.run(...) })`. Placeholders are `?` (auto-converted to `$n`); don't use the jsonb `?` operator. Postgres SQL only: `now()`, `current_date`, `ON CONFLICT ... DO NOTHING/UPDATE`, `RETURNING id`, `string_agg`, `= ANY(?::bigint[])` / `?::text[]` for arrays, `?::jsonb` with `JSON.stringify(value)` for jsonb, real booleans. Type parsers: bigint/numeric → number, timestamptz → ISO string, date → 'YYYY-MM-DD'. `parseJson` accepts already-parsed jsonb.
- Schema lives in `db/migrations/NNN_name.sql`, applied in filename order at first DB use (`db.ready()`). Number ranges per module: core 000–099, ASO/keywords/explore/suggestions 100–199, App Store Connect 200–299, Apple Ads 300–399, analytics/integrations 400–449, PostHog 450–499, MCP/workspace/admin 500–599. Never edit an applied migration; add a new file. No more lazy `ensureSchema()` — move module tables into migrations.
- **Every tenant table has `workspace_id text NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE`** (or is reached through `apps.workspace_id`). Every service function takes `workspaceId: string` as its first parameter and every query filters by it. Never load a row by id without checking its workspace.
- Route handlers: `const { workspaceId, userId, role } = await requireWorkspace(minRole?)` from `lib/server/context.ts` (throws 401/403). Writes that change credentials/integrations/billing need `"admin"`.
- Settings/credentials: `await getSetting(workspaceId, key)` / `await setSetting(workspaceId, key, value)` — secrets are AES-GCM encrypted at rest automatically (`SECRET_KEYS`). Never return secrets to the client.
- Cache (`lib/server/cache.ts`) is async. Public App Store data uses global keys; anything derived from a workspace's private data uses `wsKey(workspaceId, key)`.
- Background jobs (`lib/suggestions/jobs.ts`): the job key must start with `${workspaceId}:`; job status endpoints must check `job.key.startsWith(\`${workspaceId}:\`)` before returning it.
- Public machine endpoints (webhooks, attribution ingest, MCP) resolve the workspace from a per-workspace token: `issueToken / workspaceForToken / tokenInfo / revokeToken` in `lib/server/tokens.ts` (hashed at rest). URL-scoped webhooks may use `?w=<workspaceId>` plus a signature/token check.
- Plan limits: `assertWithinLimit(workspaceId, "apps" | "keywords" | "competitors", n)` and `workspaceLimits()` in `lib/server/plans.ts`.
- Local dev: Postgres on `localhost:5433` (container `open-aso-pg`), `.env.local` has `OPEN_ASO_DEV_LOGIN=1` so `/login` shows a dev e-mail sign-in (any e-mail, auto-creates the user + a personal workspace). Use separate e-mails to test isolation between workspaces.
