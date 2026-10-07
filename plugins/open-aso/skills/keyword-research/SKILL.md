---
name: keyword-research
description: "Find, score and shortlist App Store search keywords for an app in Open ASO: suggestions, popularity, difficulty, opportunity, current rankings and terms competitors rank for, then track the chosen ones. Use when the user asks for keyword ideas, which keywords to target or track, or why a keyword is worth it."
---

# Keyword research

Goal: a short, justified list of search terms the app can realistically rank
for, in one storefront, then (after a yes) track them.

## Steps

1. Resolve the app with `list_apps`. Use its `appId`, `trackId` and
   `primaryCountry` unless the user names another country.
2. Baseline: `get_app_keywords` for what is already tracked (popularity 0-100,
   difficulty 0-100, opportunity, current rank, label).
3. Ideas, from several sources:
   - `get_keyword_suggestions` (needs at least 3 tracked keywords in the
     country; may take up to a minute, call again if it is still running).
   - `get_ranking_keywords` with the app's `trackId`: terms it already ranks for
     but may not track.
   - `get_ranking_keywords` on a competitor's `trackId` (`list_competitors`):
     terms they rank for.
   - Seed terms from the user.
4. Score candidates with `analyze_keyword` (term, country, and `trackId` to get
   the app's rank). Use `search_rankings` to check up to 20 terms at once.
5. Shortlist. Prefer, in order:
   - Terms where the app ranks 11 to 50 with popularity above ~30 (quick wins).
   - High opportunity: popularity clearly higher than difficulty.
   - Relevant long-tail terms with low difficulty, even with modest popularity.
   Drop terms that are irrelevant to what the app does, brand names of other
   apps, and terms where the top 10 is all giant apps (difficulty above ~75)
   unless the app is already close.
6. Present a table: term, popularity, difficulty, opportunity, rank, reason.
   Mention that popularity and downloads are modeled estimates.
7. Only after the user picks terms, call `add_keywords` (max 25 per call, one
   country per call). It analyzes them right away.

## Tips

- Apple indexes the title, subtitle and the 100-character keyword field. A term
  that is not in any of them rarely ranks; hand off to `metadata-optimization`
  to place shortlisted terms.
- Singular and plural forms, and words split across title and keyword field,
  combine in search; do not waste characters on duplicates.
- For other markets, `get_country_opportunities` scans one term across the
  largest storefronts and shows where it is popular but less competitive.
- `get_keyword_history` shows whether a rank is trending or just noisy before
  you call something a win or a loss.
