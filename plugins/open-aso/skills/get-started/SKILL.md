---
name: get-started
description: "Use for anything in Open ASO, the App Store Optimization workspace (keyword research and rank tracking, App Store Connect metadata, competitors, reviews, Apple Ads, installs and revenue analytics). Start here to learn what the Open ASO tools do, which ones change data, and which workflow skill to follow next."
---

# Open ASO

Open ASO is an App Store Optimization workspace: it tracks apps and their search
keywords in 66 App Store storefronts, scores keywords (popularity, difficulty,
opportunity), checks rankings daily, compares competitors, reads App Store
Connect metadata and Apple Ads, and collects installs and revenue from its SDK,
RevenueCat, Superwall and PostHog.

The connection is bound to the one workspace the user picked when they signed
in. To work in another workspace, the user reconnects and picks it.

## First steps

1. `list_apps` returns each app's `appId` (Open ASO id, used by most tools) and
   `trackId` (App Store id, used by App Store tools such as `get_app_details`,
   `search_app_store`, `get_ranking_keywords`).
2. Countries are two-letter storefront codes (`us`, `gb`, `de`, `jp`...). When
   the user names none, use the app's `primaryCountry`.
3. Popularity, difficulty, downloads and revenue are modeled estimates. Say so
   whenever you quote them.

## Which skill to follow

| The user wants to... | Follow |
| --- | --- |
| Find and score new keywords, decide what to track | `keyword-research` |
| Improve title, subtitle and the 100-character keyword field | `metadata-optimization` |
| Review Apple Ads, change bids or budgets, add keywords or negatives | `apple-ads-optimization` |

Quick answers without a workflow:

- "Where do I rank?" -> `get_app_keywords` (tracked) or `search_rankings` (live, any terms).
- "Is this keyword worth it?" -> `analyze_keyword`.
- "How do I compare with X?" -> `list_competitors`, then `get_competitor_comparison`.
- "What do users complain about?" -> `get_reviews`.
- "Which countries should I localize for?" -> `get_country_opportunities`.
- "Which keywords bring downloads and revenue?" -> `get_keyword_impact`, `get_keyword_roas`.
- "How is the app doing?" -> `get_analytics_overview`, `get_analytics_sources`, `get_posthog_overview`.

## Changes need a yes

Read tools need no permission. These change data and need an explicit yes from
the user in this conversation, for that exact change:

- Tracking: `add_keywords`, `remove_keywords` (deletes history), `set_keyword_note`.
- App Store Connect: `update_metadata`.
- Apple Ads: `update_apple_ads_bids`, `update_apple_ads_budgets`,
  `pause_apple_ads_entities`, `add_apple_ads_keywords`, `add_negative_keywords`,
  `create_apple_ads_campaigns`.

App Store Connect and Apple Ads tools are dry runs by default and return a
before/after diff. Show the diff, wait for a yes, then call again with
`dryRun: false` and `confirm: true`. A yes for one change is not a yes for the
next one.

## When Open ASO refuses

- "Write tools are disabled": a workspace admin must enable "Allow write tools"
  in Open ASO → MCP Server. Tell the user; do not retry.
- Read-only connection (scope `mcp:read`): write tools are not available; the
  user can reconnect with full access.
- "The MCP server is disabled for this workspace": an admin turns it on in
  Open ASO → MCP Server.
- Apple Ads caps (±30% bids, +30% budgets, exact match only, no re-enabling)
  and the 30 / 30 / 100 metadata limits are enforced by the server. Explain the
  limit and propose a change that fits it instead of working around it.

Never ask for or accept App Store Connect keys, Apple Ads credentials or tokens
in the chat. Integrations are connected in the Open ASO web app.
