---
description: "Review Apple Ads performance and propose capped bid, budget and keyword changes (applied only after your yes)"
argument-hint: "[days, e.g. 7 or 30] [campaign name]"
allowed-tools: mcp__plugin_open-aso_open-aso__get_apple_ads_connection, mcp__plugin_open-aso_open-aso__get_apple_ads_playbook, mcp__plugin_open-aso_open-aso__list_apple_ads_campaigns, mcp__plugin_open-aso_open-aso__get_apple_ads_performance, mcp__plugin_open-aso_open-aso__suggest_bid_changes, mcp__plugin_open-aso_open-aso__diagnose_apple_ads_keyword, mcp__plugin_open-aso_open-aso__get_keyword_roas, mcp__plugin_open-aso_open-aso__update_apple_ads_bids, mcp__plugin_open-aso_open-aso__update_apple_ads_budgets, mcp__plugin_open-aso_open-aso__add_negative_keywords, mcp__plugin_open-aso_open-aso__pause_apple_ads_entities
---

Follow the `apple-ads-optimization` skill:

$ARGUMENTS

Start with `get_apple_ads_connection` and `get_apple_ads_playbook`. Report performance, then a numbered list of proposed changes with the rule behind each. Every write tool is a dry run first; apply only the items I approve, with `dryRun: false` and `confirm: true`, and never raise a bid or budget by more than the caps.
