"use client";

import { useState } from "react";
import { CheckCircle2, Copy, KeyRound, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/_ui/button";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import { api, useApi } from "@/lib/client/api";
import { timeAgo } from "@/lib/client/format";

type Status = {
  configured: boolean;
  hasKeyPair: boolean;
  publicKey: string | null;
  clientId: string | null;
  teamId: string | null;
  keyId: string | null;
  adAccountId: string | null;
  countryFilter: string;
  lastError: string | null;
  lastOkAt: string | null;
};

export default function PlatformKeyCard() {
  const { data, mutate } = useApi<Status>("/api/platform/apple-ads");
  const [busy, setBusy] = useState<string | null>(null);
  const [ids, setIds] = useState({ clientId: "", teamId: "", keyId: "" });

  async function run(action: string, payload: Record<string, unknown> = {}) {
    setBusy(action);
    try {
      const res = await api<Status & { status?: Status; result?: { popularity: number | null; term: string; countryFilter: string } }>("/api/platform/apple-ads", {
        method: "POST",
        body: { action, ...payload },
      });
      await mutate(res.status ?? res, { revalidate: true });
      if (action === "test" && res.result)
        toast.success(
          res.result.popularity == null ? `Connected — Apple has no popularity for “${res.result.term}”` : `Connected — “${res.result.term}” popularity ${res.result.popularity}`,
        );
      if (action === "save") toast.success("Platform key saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Request failed");
      await mutate();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="border-border bg-card flex flex-col gap-4 rounded-xl border p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2">
            <KeyRound aria-hidden className="text-soft size-4" />
            Platform Apple Ads key
          </h2>
          <p className="text-subtle max-w-[560px]">
            Serves Apple&apos;s real search popularity (0–100) to every workspace that hasn&apos;t connected its own Apple Ads account. Results are cached for 7 days and shared across workspaces.
          </p>
        </div>
        {data?.configured && !data.lastError && (
          <span className="caption-style text-trend flex shrink-0 items-center gap-1">
            <CheckCircle2 aria-hidden className="size-3.5" /> Active
          </span>
        )}
      </div>

      {data?.lastError && (
        <p role="alert" className="caption-style text-danger flex items-start gap-1.5">
          <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" /> {data.lastError}
        </p>
      )}

      <ol className="flex flex-col gap-4">
        <li className="flex flex-col gap-2">
          <span className="caption-style text-soft">1. Generate a key pair and paste the public key in Apple Ads (signed in as your API user) → Account Settings → API.</span>
          {data?.publicKey ? (
            <div className="flex items-start gap-2">
              <pre className="bg-secondary border-line-strong caption-style min-w-0 flex-1 overflow-x-auto rounded-lg border p-3">{data.publicKey}</pre>
              <Button variant="secondary" size="icon" aria-label="Copy public key" onClick={() => void navigator.clipboard.writeText(data.publicKey ?? "").then(() => toast.success("Public key copied"))}>
                <Copy aria-hidden className="size-3.5" />
              </Button>
            </div>
          ) : (
            <Button variant="muted" size="md" className="self-start" disabled={busy !== null} onClick={() => void run("generate")}>
              {busy === "generate" && <Loader2 aria-hidden className="size-3.5 animate-spin" />}
              Generate key pair
            </Button>
          )}
        </li>
        <li className="flex flex-col gap-3">
          <span className="caption-style text-soft">2. Copy the client ID, team ID and key ID Apple shows after saving the public key.</span>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Client ID" htmlFor="pk-client">
              <Input id="pk-client" placeholder={data?.clientId ?? "SEARCHADS.…"} value={ids.clientId} onChange={(e) => setIds({ ...ids, clientId: e.target.value })} />
            </Field>
            <Field label="Team ID" htmlFor="pk-team">
              <Input id="pk-team" placeholder={data?.teamId ?? "SEARCHADS.…"} value={ids.teamId} onChange={(e) => setIds({ ...ids, teamId: e.target.value })} />
            </Field>
            <Field label="Key ID" htmlFor="pk-key">
              <Input id="pk-key" placeholder={data?.keyId ?? "xxxxxxxx-…"} value={ids.keyId} onChange={(e) => setIds({ ...ids, keyId: e.target.value })} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="md" disabled={busy !== null || !data?.hasKeyPair || !ids.clientId || !ids.teamId || !ids.keyId} onClick={() => void run("save", ids)}>
              {busy === "save" && <Loader2 aria-hidden className="size-3.5 animate-spin" />}
              Save IDs
            </Button>
            <Button variant="secondary" size="md" disabled={busy !== null || !data?.configured} onClick={() => void run("test")}>
              {busy === "test" && <Loader2 aria-hidden className="size-3.5 animate-spin" />}
              Test connection
            </Button>
            {data?.configured && (
              <Button variant="ghost" size="md" disabled={busy !== null} onClick={() => void run("clear")}>
                Remove key
              </Button>
            )}
          </div>
        </li>
      </ol>

      {data?.configured && (
        <p className="caption-style text-subtle">
          Ad account {data.adAccountId ?? "—"} · country filter {data.countryFilter} · last success {timeAgo(data.lastOkAt)}
        </p>
      )}
    </section>
  );
}
