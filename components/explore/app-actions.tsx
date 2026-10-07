"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Plus, Swords } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/_ui/button";
import { api, revalidate } from "@/lib/client/api";
import type { TrackedApp } from "@/lib/client/types";
import type { ExploreAppDetail } from "@/lib/explore/types";
import { useUiStore } from "@/stores/ui-store";
import TargetAppMenu from "./target-app-menu";

export default function AppActions({ detail }: { detail: ExploreAppDetail }) {
  const router = useRouter();
  const setCountry = useUiStore((s) => s.setCountry);
  const [busy, setBusy] = useState<"track" | "competitor" | null>(null);
  const { app, country, trackedAppId } = detail;

  async function trackAsMine() {
    setBusy("track");
    try {
      const created = await api<TrackedApp>("/api/apps", { method: "POST", body: { trackId: app.trackId, country, isMine: true } });
      setCountry(created.id, country);
      await revalidate("/api/apps");
      await revalidate("/api/explore");
      toast.success(`${created.name} is now tracked`);
      router.push(`/apps/${created.id}/keywords`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not track this app");
    } finally {
      setBusy(null);
    }
  }

  async function addCompetitor(target: TrackedApp) {
    setBusy("competitor");
    try {
      await api(`/api/apps/${target.id}/competitors`, { method: "POST", body: { trackId: app.trackId, country } });
      await revalidate(`/api/apps/${target.id}/competitors`);
      toast.success(`${app.trackName} added as a competitor of ${target.name}`, {
        action: { label: "View", onClick: () => router.push(`/apps/${target.id}/competitors`) },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add competitor");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {trackedAppId ? (
        <Button variant="secondary" size="md" href={`/apps/${trackedAppId}/keywords`}>
          Open tracked app
          <ArrowRight aria-hidden className="size-3.5" />
        </Button>
      ) : (
        <Button variant="primary" size="md" disabled={busy !== null} onClick={() => void trackAsMine()}>
          {busy === "track" ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <Plus aria-hidden className="size-3.5" />}
          Track as my app
        </Button>
      )}
      <TargetAppMenu label="Add as competitor of…" exclude={[app.trackId]} onSelect={(target) => void addCompetitor(target)}>
        <Button variant="secondary" size="md" disabled={busy !== null}>
          {busy === "competitor" ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <Swords aria-hidden className="size-3.5" />}
          Add as competitor of…
        </Button>
      </TargetAppMenu>
    </>
  );
}
