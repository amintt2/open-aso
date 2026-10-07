---
description: "Audit an app's App Store title, subtitle and keyword field against its tracked keywords and propose a better version"
argument-hint: "[app name] [country or locale]"
allowed-tools: mcp__plugin_open-aso_open-aso__list_apps, mcp__plugin_open-aso_open-aso__get_metadata_insights, mcp__plugin_open-aso_open-aso__get_metadata, mcp__plugin_open-aso_open-aso__get_app_store_page, mcp__plugin_open-aso_open-aso__get_app_keywords, mcp__plugin_open-aso_open-aso__analyze_keyword, mcp__plugin_open-aso_open-aso__update_metadata
---

Follow the `metadata-optimization` skill for this app:

$ARGUMENTS

Read-only until I approve: show the findings, then up to two proposed versions of title (30), subtitle (30) and keyword field (100) with character counts. Only run `update_metadata` as a dry run, show me the diff, and apply it with `dryRun: false` and `confirm: true` only after a clear yes.
