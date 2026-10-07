import { api, revalidate } from "@/lib/client/api";
import type { TrackedKeyword } from "@/lib/client/types";
import { normalizeTerm } from "@/lib/aso/scoring";

export async function trackKeywords(appId: number, terms: string[], country: string) {
  const wanted = new Set(terms.map(normalizeTerm));
  const list = await api<TrackedKeyword[]>(`/api/apps/${appId}/keywords`, {
    method: "POST",
    body: { terms: [...wanted], country, analyze: false },
  });
  const added = list.filter((k) => wanted.has(k.term));
  const pending = added.filter((k) => !k.lastRefreshedAt).map((k) => k.id);
  void revalidate("/api/apps");
  if (pending.length) {
    void api("/api/keywords/refresh", { method: "POST", body: { ids: pending } })
      .then(() => Promise.all([revalidate("/api/apps"), revalidate("/api/competitors")]))
      .catch(() => undefined);
  }
  return added.length;
}
