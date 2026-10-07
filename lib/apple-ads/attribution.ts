import { db } from "@/lib/server/db";
import type { Attribution } from "./types";

type Bucket = { installs: number; revenue: number };

export type AttributionIndex = {
  total: Bucket;
  campaign: Map<string, Bucket>;
  adGroup: Map<string, Bucket>;
  keyword: Map<string, Bucket>;
};

export function loadAttribution(start: string, end: string): AttributionIndex | null {
  const exists = db().prepare("SELECT 1 FROM installs WHERE campaign_id IS NOT NULL LIMIT 1").get();
  if (!exists) return null;
  const rows = db()
    .prepare(
      `SELECT i.campaign_id AS campaignId, i.ad_group_id AS adGroupId, i.keyword_id AS keywordId,
              COUNT(DISTINCT i.user_id) AS installs, COALESCE(SUM(r.revenue), 0) AS revenue
       FROM installs i
       LEFT JOIN (SELECT user_id, SUM(amount_usd) AS revenue FROM revenue_events WHERE user_id IS NOT NULL GROUP BY user_id) r ON r.user_id = i.user_id
       WHERE i.campaign_id IS NOT NULL AND date(i.installed_at) >= ? AND date(i.installed_at) <= ?
       GROUP BY i.campaign_id, i.ad_group_id, i.keyword_id`,
    )
    .all(start, end) as { campaignId: string; adGroupId: string | null; keywordId: string | null; installs: number; revenue: number }[];
  const index: AttributionIndex = { total: { installs: 0, revenue: 0 }, campaign: new Map(), adGroup: new Map(), keyword: new Map() };
  const add = (map: Map<string, Bucket>, key: string | null, row: Bucket) => {
    if (!key) return;
    const b = map.get(key) ?? { installs: 0, revenue: 0 };
    b.installs += row.installs;
    b.revenue += row.revenue;
    map.set(key, b);
  };
  for (const r of rows) {
    index.total.installs += r.installs;
    index.total.revenue += r.revenue;
    add(index.campaign, String(r.campaignId), r);
    add(index.adGroup, r.adGroupId ? String(r.adGroupId) : null, r);
    add(index.keyword, r.keywordId ? String(r.keywordId) : null, r);
  }
  return index;
}

export function toAttribution(bucket: Bucket | undefined, spend: number): Attribution | null {
  if (!bucket) return null;
  return {
    installs: bucket.installs,
    revenue: bucket.revenue,
    rpi: bucket.installs > 0 ? bucket.revenue / bucket.installs : null,
    roas: spend > 0 ? bucket.revenue / spend : null,
  };
}
