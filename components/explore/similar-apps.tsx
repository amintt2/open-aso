"use client";

import { LayoutGrid, Loader2 } from "lucide-react";
import EmptyState from "@/components/shell/empty-state";
import { useApi } from "@/lib/client/api";
import type { SimilarApps as Similar } from "@/lib/explore/types";
import { StoreAppGrid } from "./app-card";

export default function SimilarApps({ trackId, country, developer }: { trackId: number; country: string; developer: string }) {
  const { data, error, isLoading } = useApi<Similar>(`/api/explore/${trackId}/similar?country=${country}`);

  if (isLoading)
    return (
      <div role="status" className="text-subtle flex items-center justify-center gap-2 py-16">
        <Loader2 aria-hidden className="size-4 animate-spin" /> Finding similar apps…
      </div>
    );
  if (error || !data) return <EmptyState icon={LayoutGrid} title="Could not load similar apps" description={error instanceof Error ? error.message : undefined} />;

  return (
    <div className="flex flex-col gap-6 p-4">
      <section className="flex flex-col gap-3">
        <h3 className="h2-style">Similar apps</h3>
        {data.similar.length ? <StoreAppGrid apps={data.similar} country={country} /> : <p className="text-subtle">No similar apps found.</p>}
      </section>
      <section className="flex flex-col gap-3">
        <h3 className="h2-style">More from {developer}</h3>
        {data.developer.length ? <StoreAppGrid apps={data.developer} country={country} /> : <p className="text-subtle">No other apps from this developer in this storefront.</p>}
      </section>
    </div>
  );
}
