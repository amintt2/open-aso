---
description: "Research App Store keywords for one of your apps: score ideas, compare with what you track, and (after your yes) track the best ones"
argument-hint: "[app name] [country, e.g. us] [seed terms]"
allowed-tools: mcp__plugin_open-aso_open-aso__list_apps, mcp__plugin_open-aso_open-aso__get_app_keywords, mcp__plugin_open-aso_open-aso__get_keyword_suggestions, mcp__plugin_open-aso_open-aso__analyze_keyword, mcp__plugin_open-aso_open-aso__get_ranking_keywords, mcp__plugin_open-aso_open-aso__search_rankings, mcp__plugin_open-aso_open-aso__add_keywords
---

Follow the `keyword-research` skill for this request:

$ARGUMENTS

If no app is named and the workspace tracks more than one, list them with `list_apps` and ask which one. Default to the app's primary country.

Finish with a short table of the best 10 to 15 terms (term, popularity, difficulty, opportunity, current rank) and why each fits. Only call `add_keywords` after I say which terms to track.
