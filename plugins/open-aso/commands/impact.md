---
description: "Estimate how many downloads and how much revenue each tracked keyword brings, per country"
argument-hint: "[app name] [country] [7|30|90 days]"
allowed-tools: mcp__plugin_open-aso_open-aso__list_apps, mcp__plugin_open-aso_open-aso__get_keyword_impact, mcp__plugin_open-aso_open-aso__get_app_keywords, mcp__plugin_open-aso_open-aso__get_analytics_overview
---

Estimate keyword impact for this app. Read-only.

$ARGUMENTS

1. `list_apps` to resolve the app.
2. `get_keyword_impact` (default 30 days, all tracked countries unless I named one).
3. Report the top keywords by estimated downloads and revenue, the share of installs explained by tracked keywords versus browse and unexplained search, and the confidence of each row.

Say clearly that per-keyword numbers are modeled estimates, whether the model was calibrated on real installs, and which data sources it used. If it is uncalibrated, suggest connecting PostHog or the Open ASO SDK.
