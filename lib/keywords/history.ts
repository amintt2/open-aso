import { db } from "@/lib/server/db";

export type PositionSeries = {
  from: string;
  days: number;
  series: Record<string, (number | null)[]>;
};

const DAY = 86400000;

export async function positionSeries(workspaceId: string, appId: number, country: string, days: number): Promise<PositionSeries> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const rows = await db.all<{ id: number; date: string; position: number | null }>(
    `SELECT s.keyword_id AS id, s.date, s.position FROM keyword_snapshots s
     JOIN keywords k ON k.id = s.keyword_id
     JOIN apps a ON a.id = k.app_id
     WHERE a.workspace_id = ? AND k.app_id = ? AND k.country = ? AND s.date >= ?::date ORDER BY s.date ASC`,
    [workspaceId, appId, country, start.toISOString().slice(0, 10)],
  );
  const series: Record<string, (number | null)[]> = {};
  for (const row of rows) {
    const index = Math.round((Date.parse(`${row.date}T00:00:00Z`) - start.getTime()) / DAY);
    if (index < 0 || index >= days) continue;
    const values = (series[row.id] ??= Array<number | null>(days).fill(null));
    values[index] = row.position;
  }
  return { from: start.toISOString().slice(0, 10), days, series };
}
