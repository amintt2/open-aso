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
