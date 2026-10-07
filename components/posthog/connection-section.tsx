"use client";

import { useState, type FormEvent } from "react";
import { ArrowUpRight, PlugZap, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/_ui/button";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import { api, revalidate } from "@/lib/client/api";
import { formatCompact } from "@/lib/client/format";
import type { PosthogConnectionCheck, PosthogRegion, PosthogStatus } from "@/lib/posthog/types";
import { Segmented } from "./product-parts";

const REGION_HOST: Record<Exclude<PosthogRegion, "custom">, string> = { us: "https://us.posthog.com", eu: "https://eu.posthog.com" };

function keysUrl(region: PosthogRegion, host: string) {
  if (region !== "custom") return `${REGION_HOST[region]}/settings/user-api-keys`;
  try {
    const url = new URL(host);
    return url.protocol === "https:" || url.protocol === "http:" ? `${url.origin}${url.pathname.replace(/\/+$/, "")}/settings/user-api-keys` : null;
  } catch {
    return null;
  }
}

export async function refreshPosthog() {
  await Promise.all([revalidate("/api/posthog"), revalidate("/api/integrations")]);
}

export default function ConnectionSection({ status }: { status: PosthogStatus }) {
  const [region, setRegion] = useState<PosthogRegion>(status.region ?? "us");
  const [host, setHost] = useState(status.region === "custom" ? (status.host ?? "") : "");
  const [projectId, setProjectId] = useState(status.projectId ?? "");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState<"save" | "test" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const link = keysUrl(region, host);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy("save");
    setError(null);
    try {
      const res = await api<{ check: PosthogConnectionCheck }>("/api/posthog/credentials", { method: "PUT", body: { region, host: region === "custom" ? host : null, projectId, apiKey: apiKey || null } });
      setApiKey("");
      await refreshPosthog();
      toast.success(`Connected to PostHog · ${formatCompact(res.check.eventsLast24h)} events in the last 24 h`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect");
    } finally {
      setBusy(null);
    }
  }

  async function test() {
    setBusy("test");
    setError(null);
    try {
      const res = await api<{ check: PosthogConnectionCheck }>("/api/posthog/status", { method: "POST" });
      toast.success(`Connection works · ${formatCompact(res.check.eventsLast24h)} events in the last 24 h`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!window.confirm("Disconnect PostHog? The API key is deleted from this Open ASO instance. App and event mappings are kept.")) return;
    setBusy("remove");
    try {
      await api("/api/posthog/credentials", { method: "DELETE" });
      await refreshPosthog();
      toast.success("PostHog disconnected");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not disconnect");
    } finally {
      setBusy(null);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="caption-style text-soft">Region</span>
        <Segmented
          label="PostHog region"
          value={region}
          onChange={setRegion}
          options={[
            { value: "us", label: "US Cloud" },
            { value: "eu", label: "EU Cloud" },
            { value: "custom", label: "Self-hosted" },
          ]}
        />
      </div>
      {region === "custom" && (
        <Field label="PostHog URL" htmlFor="posthog-host" hint="The address you open PostHog at, without /project/…">
          <Input id="posthog-host" type="url" inputMode="url" autoComplete="off" spellCheck={false} placeholder="https://posthog.example.com" value={host} onChange={(e) => setHost(e.target.value)} required />
        </Field>
      )}
      <Field label="Project ID" htmlFor="posthog-project" hint="The number in your PostHog URL (/project/12345), also under Settings → Project → General.">
        <Input id="posthog-project" inputMode="numeric" autoComplete="off" spellCheck={false} placeholder="12345" value={projectId} onChange={(e) => setProjectId(e.target.value)} required />
      </Field>
      <Field
        label="Personal API key"
        htmlFor="posthog-key"
        hint="Create it under Settings → Personal API keys with the Query → Read scope (query:read) for this project. It stays on this machine and is never sent back to the browser."
        trailing={
          link && (
            <a href={link} target="_blank" rel="noreferrer" className="caption-style text-soft hover:text-foreground flex items-center gap-1">
              Personal API keys
              <ArrowUpRight aria-hidden className="size-3" />
            </a>
          )
        }
      >
        <Input
          id="posthog-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={status.keyHint ? `Saved ${status.keyHint} — leave empty to keep it` : "phx_…"}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          required={!status.keyHint}
        />
      </Field>
      {error && (
        <p role="alert" className="caption-style text-danger leading-[1.4]">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" size="md" disabled={!!busy}>
          <Save aria-hidden className="size-3.5" />
          {busy === "save" ? "Testing…" : status.configured ? "Save & test" : "Connect"}
        </Button>
        {status.configured && (
          <>
            <Button variant="secondary" size="md" onClick={test} disabled={!!busy}>
              <PlugZap aria-hidden className="size-3.5" />
              {busy === "test" ? "Testing…" : "Test connection"}
            </Button>
            <Button variant="ghost" size="md" onClick={remove} disabled={!!busy}>
              <Trash2 aria-hidden className="size-3.5" />
              Disconnect
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
