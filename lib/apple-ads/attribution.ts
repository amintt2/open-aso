import { db } from "@/lib/server/db";
import type { Attribution } from "./types";

type Bucket = { installs: number; revenue: number };

export type AttributionIndex = {
  total: Bucket;
  campaign: Map<string, Bucket>;
  adGroup: Map<string, Bucket>;
  keyword: Map<string, Bucket>;
};

export async function loadAttribution(workspaceId: string, start: string, end: string): Promise<AttributionIndex | null> {
  const exists = await db.get("SELECT 1 FROM installs WHERE workspace_id = ? AND campaign_id IS NOT NULL LIMIT 1", [workspaceId]);
  if (!exists) return null;
  const rows = await db.all<{ campaignId: string; adGroupId: string | null; keywordId: string | null; installs: number; revenue: number }>(
    `SELECT i.campaign_id AS "campaignId", i.ad_group_id AS "adGroupId", i.keyword_id AS "keywordId",
            COUNT(DISTINCT i.user_id) AS installs, COALESCE(SUM(r.revenue), 0) AS revenue
     FROM installs i
     LEFT JOIN (SELECT user_id, SUM(amount_usd) AS revenue FROM revenue_events WHERE workspace_id = ? AND user_id IS NOT NULL GROUP BY user_id) r ON r.user_id = i.user_id
     WHERE i.workspace_id = ? AND i.campaign_id IS NOT NULL AND i.installed_at::date >= ?::date AND i.installed_at::date <= ?::date
     GROUP BY i.campaign_id, i.ad_group_id, i.keyword_id`,
    [workspaceId, workspaceId, start, end],
  );
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
