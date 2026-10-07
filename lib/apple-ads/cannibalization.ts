import type { AdsSnapshot, CannibalizationIssue } from "./types";

function norm(s: string) {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

function broadCovers(broad: string, term: string) {
  const words = new Set(norm(term).split(" "));
  return norm(broad)
    .split(" ")
    .every((w) => words.has(w));
}

export function detectCannibalization(s: AdsSnapshot): CannibalizationIssue[] {
  const campaigns = new Map(s.campaigns.map((c) => [c.id, c]));
  const groups = new Map(s.adGroups.map((g) => [g.id, g]));
  const marketOf = (campaignId: string) => {
    const c = campaigns.get(campaignId);
    return c ? `${c.adamId}|${(c.countries[0] ?? "").toUpperCase()}` : null;
  };
  const negated = new Map<string, Set<string>>();
  for (const n of s.negatives) {
    if (n.matchType !== "EXACT" && n.matchType !== "BROAD") continue;
    const key = n.adGroupId ? `g:${n.adGroupId}` : `c:${n.campaignId}`;
    const set = negated.get(key) ?? new Set<string>();
    set.add(`${n.matchType}:${norm(n.text)}`);
    negated.set(key, set);
  }
  const isNegated = (campaignId: string, adGroupId: string, term: string) => {
    const t = norm(term);
    for (const key of [`g:${adGroupId}`, `c:${campaignId}`]) {
      const set = negated.get(key);
      if (!set) continue;
      if (set.has(`EXACT:${t}`)) return true;
      for (const entry of set) if (entry.startsWith("BROAD:") && broadCovers(entry.slice(6), t)) return true;
    }
    return false;
  };

  const exactKeywords = s.keywords.filter((k) => k.matchType === "EXACT" && k.status === "ACTIVE" && groups.get(k.adGroupId)?.searchMatch === false);
  const broadByGroup = new Map<string, string[]>();
  for (const k of s.keywords)
    if (k.matchType === "BROAD" && k.status === "ACTIVE") broadByGroup.set(k.adGroupId, [...(broadByGroup.get(k.adGroupId) ?? []), k.text]);

  const discovery = s.adGroups.filter((g) => g.status === "ENABLED" && campaigns.get(g.campaignId)?.status === "ENABLED" && (g.searchMatch || broadByGroup.has(g.id)));
  const issues: CannibalizationIssue[] = [];
  const seen = new Set<string>();

  for (const k of exactKeywords) {
    const market = marketOf(k.campaignId);
    const exactCampaign = campaigns.get(k.campaignId);
    const exactGroup = groups.get(k.adGroupId);
    if (!market || !exactCampaign || !exactGroup) continue;
    for (const g of discovery) {
      if (g.id === k.adGroupId || marketOf(g.campaignId) !== market) continue;
      if (isNegated(g.campaignId, g.id, k.text)) continue;
      const broad = (broadByGroup.get(g.id) ?? []).find((b) => broadCovers(b, k.text));
      if (!broad && !g.searchMatch) continue;
      const id = `${g.id}:${norm(k.text)}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const target = campaigns.get(g.campaignId);
      issues.push({
        id,
        term: k.text,
        country: (exactCampaign.countries[0] ?? "").toLowerCase(),
        adamId: exactCampaign.adamId,
        exact: { campaignId: k.campaignId, campaignName: exactCampaign.name, adGroupId: k.adGroupId, adGroupName: exactGroup.name, keywordId: k.id },
        target: {
          campaignId: g.campaignId,
          campaignName: target?.name ?? g.campaignId,
          adGroupId: g.id,
          adGroupName: g.name,
          reason: broad ? (norm(broad) === norm(k.text) ? `same keyword on broad match` : `broad keyword "${broad}" matches it`) : "Search Match can serve it",
        },
      });
    }
  }
  return issues;
}
