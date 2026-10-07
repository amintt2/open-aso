# Open ASO

Open-source, local-first App Store Optimization workspace. Research keywords, track rankings, watch competitors, edit your App Store listing, localize prices, run Apple Ads and connect your analytics — from one app that runs on your machine (or your own server).

Built with Next.js 16, React 19, Tailwind 4 and SQLite. UI kit derived from the MIT-licensed [Kargul sales-crm starter](https://github.com/kargulstudio/sales-crm).

## Features

| Area | What you get |
| --- | --- |
| Keywords | Tracked keywords per app and storefront with popularity, difficulty, targeting label, position + change, 30-day sparkline, estimated downloads, top-5 downloads/MRR, notes, likes, filters, CSV export, detail sheet with trend chart and version markers, top-apps sheet, background refresh |
| Suggestions | Keyword ideas from App Store search hints, top-ranking titles, competitors and recombinations (optional Claude-powered ideas), scored and one-click trackable; metadata insights for title/subtitle |
| Country opportunities | Scan one keyword across 66 storefronts, opportunity score, your rank, top competitor, world map |
| Explore & competitors | Search any app, profile with estimates, screenshots, ranking keywords, country presence map, similar apps; competitor tracking and keyword-by-keyword comparison |
| Reviews | Multi-storefront reviews, rating distribution, themes, optional AI summary |
| App Store page | App Store Connect metadata editor (name, subtitle, keywords, promo text, description, what's new) with keyword coverage, diff-before-save, locales, localization grid, US multi-locale keyword buckets, screenshots |
| Price localization | Subscriptions & IAPs: purchasing-power or equalized pricing snapped to Apple price points, scheduled changes |
| Apple Ads | OAuth setup, dashboard, campaigns / ad groups / keywords / negatives, bid & budget edits with diffs, campaign creation, cannibalization fix, playbook-driven recommendations |
| Analytics | Self-hosted install attribution (AdServices), RevenueCat & Superwall webhooks, overview, sources, geography, retention, keyword ROAS; PostHog product analytics |
| MCP server | 41 tools for Claude Code, Claude Desktop, Cursor, VS Code and Codex — read-only by default, guarded dry-run writes |

Popularity, difficulty, download and revenue numbers are **modeled estimates** computed from public App Store data (search hints, search results, ratings). Rankings come from the public iTunes Search API and can differ slightly from what a given device shows.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000 and add your first app.

Data lives in `.data/open-aso.sqlite` (override with `OPEN_ASO_DATA_DIR`).

### Environment variables

| Variable | Purpose |
| --- | --- |
| `OPEN_ASO_DATA_DIR` | Directory for the SQLite database |
| `OPEN_ASO_PASSWORD` / `OPEN_ASO_USERNAME` | Protect the whole app with HTTP Basic auth (webhooks, attribution and bearer-authenticated MCP stay reachable) |
| `OPEN_ASO_DISABLE_SCHEDULER=1` | Disable the background keyword refresh |

### Connections (all optional)

- **App Store Connect** — API key (Issuer ID, Key ID, .p8) for metadata and pricing. Set it up from an app's *App Store Page*.
- **Apple Ads** — generate a key pair in *Apple Ads*, paste the public key into Apple Ads → API, enter client/team/key IDs.
- **RevenueCat / Superwall / PostHog / SDK** — see *Integrations*. Webhooks need a publicly reachable URL (deploy it, or use a tunnel).
- **Claude** — Anthropic API key in *Settings* for AI suggestions and review summaries.

## Deploying

Any Node 22 host works (`npm run build && npm start`). Mount a persistent volume for `OPEN_ASO_DATA_DIR` and set `OPEN_ASO_PASSWORD`.

## License

MIT. Not affiliated with Apple or with any commercial ASO product.
