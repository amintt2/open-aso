import { tableStats } from "@/lib/integrations/data";
import { db } from "@/lib/server/db";
import { json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const GET = route(() => {
  const keywords = db()
    .prepare("SELECT COUNT(*) AS total, MAX(last_refreshed_at) AS lastRefreshedAt, SUM(last_refreshed_at IS NULL OR last_refreshed_at < datetime('now', '-20 hours')) AS stale FROM keywords")
    .get() as { total: number; lastRefreshedAt: string | null; stale: number | null };
  return json({
    database: tableStats(),
    scheduler: {
      disabled: process.env.OPEN_ASO_DISABLE_SCHEDULER === "1",
      keywords: keywords.total,
      staleKeywords: keywords.stale ?? 0,
      lastRefreshedAt: keywords.lastRefreshedAt,
    },
    passwordProtection: { enabled: !!process.env.OPEN_ASO_PASSWORD, username: process.env.OPEN_ASO_USERNAME || null },
  });
});
