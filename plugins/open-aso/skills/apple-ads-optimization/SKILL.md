---
name: apple-ads-optimization
description: "Review Apple Ads (Apple Search Ads) performance in Open ASO and make capped, approved changes: bids, daily budgets, exact match keywords, negative keywords, pausing, and planning new exact match campaigns. Use when the user asks how their Apple Ads are doing, what to change, or wants to act on bids, budgets or keywords."
---

# Apple Ads optimization

Goal: spend where keywords earn back their cost, using the Open ASO playbook
rules, with every change previewed and approved.

## Read first

1. `get_apple_ads_connection`: is an account connected, which org and currency,
   the target CPA. If not connected, the user connects Apple Ads in the Open ASO
   web app (`demo: true` works for a walkthrough).
2. `get_apple_ads_playbook`: metric formulas, decision rules and the limits
   enforced on writes. Follow it; do not invent other thresholds.
3. `get_apple_ads_performance` for the window (default 7 or 30 days): totals
   versus the previous period, per-campaign metrics, top keywords with
   diagnosis, cannibalization issues.
4. `get_keyword_roas` when revenue attribution exists: which keywords pay back.
5. `list_apple_ads_campaigns` for budgets, budget utilization and serving state.

## Decide

- `suggest_bid_changes` gives capped bid and budget suggestions with the rule
  and reason for each. `diagnose_apple_ads_keyword` explains one keyword (or a
  what-if with raw metrics). `get_apple_ads_keyword_trend` shows its daily trend.
- Wait for enough data before judging a keyword (the playbook says how much).
- Raise bids on keywords below target CPA with low impression share; lower or
  pause keywords far above target CPA; add negatives for search terms that
  spend without converting or that cannibalize another campaign.

## Change (always dry run first)

Write tools: `update_apple_ads_bids`, `update_apple_ads_budgets`,
`pause_apple_ads_entities`, `add_apple_ads_keywords`, `add_negative_keywords`,
`create_apple_ads_campaigns` (after `plan_apple_ads_campaigns`).

1. Present a numbered list of proposed changes with before, after and reason.
2. Call the tool with the approved items only; it is a dry run by default and
   returns a diff. Show it.
3. After a clear yes, call again with `dryRun: false` and `confirm: true`.

Server-enforced limits: bids change by at most ±30% per call and must stay
under `maxBid`; budgets rise by at most 30% per call and must stay under
`maxDailyBudget`; exact match only; pausing is allowed but re-enabling is not
available over MCP; new campaigns are created paused. Explain a refusal instead
of splitting a change into several calls to get around a cap.

Spend, installs and CPT are Apple data; revenue and ROAS depend on the
attribution sources connected in Open ASO.
