---
description: "Compare an app with its saved competitors: shared keywords, who outranks whom, and terms only competitors rank for"
argument-hint: "[app name] [competitor name]"
allowed-tools: mcp__plugin_open-aso_open-aso__list_apps, mcp__plugin_open-aso_open-aso__list_competitors, mcp__plugin_open-aso_open-aso__get_competitor_comparison, mcp__plugin_open-aso_open-aso__get_app_details, mcp__plugin_open-aso_open-aso__get_ranking_keywords, mcp__plugin_open-aso_open-aso__search_app_store, mcp__plugin_open-aso_open-aso__get_reviews
---

Compare this app with its competitors. Read-only.

$ARGUMENTS

1. `list_apps`, then `list_competitors` for the app.
2. For the named competitor (or the two that outrank us most), `get_competitor_comparison`.
3. `get_ranking_keywords` on the competitor's trackId to find terms we don't track.
4. Optionally `get_reviews` for the competitor to spot complaints we can answer in our metadata.

Summarize: where we lead, where they lead, keywords to add, and one positioning idea. Estimates are modeled.
