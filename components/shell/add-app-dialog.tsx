"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, Star } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/_ui/dialog";
import { Input } from "@/components/_ui/input";
import Button from "@/components/_ui/button";
import AppIcon from "./app-icon";
import CountrySelect from "./country-select";
import { api, revalidate, useApi } from "@/lib/client/api";
import { formatCompact } from "@/lib/client/format";
import type { StoreApp, TrackedApp } from "@/lib/client/types";
import { useUiStore } from "@/stores/ui-store";

export default function AddAppDialog() {
  const open = useUiStore((s) => s.addAppOpen);
  const setOpen = useUiStore((s) => s.setAddAppOpen);
  const setCountry = useUiStore((s) => s.setCountry);
  const router = useRouter();
  const [country, setC] = useState("us");
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [adding, setAdding] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(t);
  }, [term]);

  const { data, isLoading } = useApi<StoreApp[]>(debounced.length > 1 ? `/api/store/search?term=${encodeURIComponent(debounced)}&country=${country}&limit=15` : null);

  async function add(app: StoreApp) {
    setAdding(app.trackId);
    try {
      const created = await api<TrackedApp>("/api/apps", { method: "POST", body: { trackId: app.trackId, country } });
      setCountry(created.id, country);
      await revalidate("/api/apps");
      setOpen(false);
      setTerm("");
      router.push(`/apps/${created.id}/keywords`);
      toast.success(`${created.name} added`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add app");
    } finally {
      setAdding(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-[560px]">
        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-2 pr-8">
            <DialogTitle className="h2-style">Add an app</DialogTitle>
            <DialogDescription className="text-subtle p-style">Search the App Store by name, developer or App ID. Your own apps and competitors both work.</DialogDescription>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search aria-hidden className="text-subtle absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
              <Input autoFocus value={term} onChange={(e) => setTerm(e.target.value)} placeholder="App name or ID…" className="pl-8" />
            </div>
            <CountrySelect value={country} onChange={setC} className="h-9 min-w-[160px] rounded-lg" />
          </div>
          <ul className="divide-border flex max-h-[380px] flex-col divide-y overflow-y-auto">
            {isLoading && (
              <li className="text-subtle flex items-center gap-2 py-6">
                <Loader2 aria-hidden className="size-4 animate-spin" /> Searching…
              </li>
            )}
            {data?.map((app) => (
              <li key={app.trackId} className="flex items-center gap-3 py-2.5">
                <AppIcon src={app.artworkUrl100} name={app.trackName} className="size-10" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="truncate text-[14px]">{app.trackName}</span>
                  <span className="caption-style text-subtle flex items-center gap-1.5 truncate">
                    {app.sellerName} · <Star aria-hidden className="size-3" /> {app.averageUserRating.toFixed(1)} ({formatCompact(app.userRatingCount)})
                  </span>
                </div>
                <Button variant="muted" size="sm" disabled={adding !== null} onClick={() => add(app)}>
                  {adding === app.trackId ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : "Add"}
                </Button>
              </li>
            ))}
            {data && !data.length && <li className="text-subtle py-6">No apps found in this storefront.</li>}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
