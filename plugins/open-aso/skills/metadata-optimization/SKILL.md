---
name: metadata-optimization
description: "Audit and rewrite an app's App Store title (30 characters), subtitle (30) and keyword field (100) with Open ASO, using tracked keyword data, then apply the change in App Store Connect only after the user approves the dry-run diff. Use for ASO audits, metadata rewrites, keyword field optimization and localization of metadata."
---

# Metadata optimization

Goal: title, subtitle and keyword field that cover the most valuable tracked
keywords without wasted characters, applied safely.

## Read

1. `list_apps` to get the `appId`; note whether it is linked to App Store Connect.
2. `get_metadata_insights` (appId, country): unused characters, duplicated words,
   high-opportunity keywords missing from title or subtitle, keywords already
   working.
3. `get_metadata` (appId, optional locale): the live title, subtitle, keyword
   field, promotional text and what's new per locale, with character counts and
   whether app info and version are editable. Needs App Store Connect connected
   and the app linked; otherwise use `get_app_store_page` for the public title
   and subtitle (the keyword field is private).
4. `get_app_keywords` for popularity, difficulty and rank of every tracked term.

## Rules for a good proposal

- Limits: title 30, subtitle 30, keyword field 100 characters. Count exactly.
- Keyword field: comma-separated, no spaces after commas, no words already in
  the title or subtitle, no plurals of words already present, no app name,
  no category name, no competitor brand names.
- Highest-value terms go in the title, then the subtitle; the title should
  still read as a brand plus a clear benefit, not a keyword list.
- Keep words that already rank in the top 10 unless the user wants to trade them.
- One locale at a time. Other locales indexed for the same storefront can carry
  extra keywords; mention it when relevant.

## Propose, then apply

1. Show the current version and up to two proposals side by side with
   character counts and which tracked keywords each one gains or loses.
2. When the user picks one, call `update_metadata` with the locale and the new
   fields. It is a dry run by default and returns a diff and warnings; show it.
3. Only after a clear yes, call `update_metadata` again with the same fields,
   `dryRun: false` and `confirm: true`. Title and subtitle need an editable app
   info, the keyword field needs an editable version; if not editable, say what
   the user must create in App Store Connect first.
4. If the server says write tools are disabled, tell the user an admin must
   allow them in Open ASO → MCP Server.

Changes reach users only with the next approved App Store version (keyword
field) or app info update. Suggest tracking rank changes for two to four weeks
with `get_keyword_history` before judging.
