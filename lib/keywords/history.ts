import { db } from "@/lib/server/db";

export type PositionSeries = {
  from: string;
  days: number;
  series: Record<string, (number | null)[]>;
};

const DAY = 86400000;

export function positionSeries(
  appId: number,
  country: string,
  days: number,
): PositionSeries {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const rows = db()
    .prepare(
      `SELECT s.keyword_id AS id, s.date, s.position FROM keyword_snapshots s
       JOIN keywords k ON k.id = s.keyword_id
       WHERE k.app_id = ? AND k.country = ? AND s.date >= ? ORDER BY s.date ASC`,
    )
    .all(appId, country, start.toISOString().slice(0, 10)) as {
    id: number;
    date: string;
    position: number | null;
  }[];
  const series: Record<string, (number | null)[]> = {};
  for (const row of rows) {
    const index = Math.round(
      (Date.parse(`${row.date}T00:00:00Z`) - start.getTime()) / DAY,
    );
    if (index < 0 || index >= days) continue;
    const values = (series[row.id] ??= Array<number | null>(days).fill(null));
    values[index] = row.position;
  }
  return { from: start.toISOString().slice(0, 10), days, series };
}

export function setKeywordsLiked(ids: number[], liked: boolean) {
  const update = db().prepare("UPDATE keywords SET liked = ? WHERE id = ?");
  db().transaction(() => ids.forEach((id) => update.run(liked ? 1 : 0, id)))();
}
