"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, ChevronsUpDown, Link2, Loader2, PlugZap, Settings2, Unlink } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/_ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/_ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/_ui/select";
import EmptyState from "@/components/shell/empty-state";
import { api, revalidate, useApi } from "@/lib/client/api";
import type { TrackedApp } from "@/lib/client/types";
import type { AscAppOption } from "@/lib/asc/types";
import { InlineError } from "./asc-error";
import ASCSetupSheet from "./asc-setup-sheet";
import { errorMessage, useAscStatus } from "./use-asc";
import { cn } from "@/lib/utils";

export function ConnectCallout({ feature, onConnect }: { feature: string; onConnect: () => void }) {
  return (
    <div className="border-line-strong bg-card flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3">
      <span className="bg-secondary flex size-8 shrink-0 items-center justify-center rounded-lg">
        <PlugZap aria-hidden className="text-soft size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="lead-style">Connect App Store Connect to {feature}</span>
        <span className="caption-style text-subtle">Showing public App Store data in read-only mode.</span>
      </div>
      <Button variant="primary" size="sm" className="h-[30px] px-3" onClick={onConnect}>
        Connect
      </Button>
    </div>
  );
}

function useLinkApp(app: TrackedApp) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [manual, setManual] = useState(false);
  const [choice, setChoice] = useState("");
  const { data: options, error: listError, isLoading } = useApi<AscAppOption[]>(manual ? "/api/asc/apps" : null);

  async function link(ascAppId?: string) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/asc/apps/${app.id}/link`, { method: "POST", body: ascAppId ? { ascAppId } : {} });
      await revalidate("/api/apps");
      await revalidate("/api/asc/apps");
      toast.success(`${app.name} linked to App Store Connect`);
    } catch (e) {
      setError(e);
      setManual(true);
    } finally {
      setBusy(false);
    }
  }

  return { busy, error: error ?? listError, manual, setManual, choice, setChoice, options, isLoading, link };
}

function LinkControls({ app, align = "center" }: { app: TrackedApp; align?: "center" | "end" }) {
  const l = useLinkApp(app);
  return (
    <div className={cn("flex w-full flex-col gap-3", align === "center" ? "max-w-[420px] items-center" : "items-end")}>
      <div className="flex flex-wrap justify-center gap-2">
        {app.bundleId && (
          <Button variant="primary" size="sm" className="h-[30px] px-3" disabled={l.busy} onClick={() => void l.link()}>
            {l.busy ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <Link2 aria-hidden className="size-3.5" />}
            Find by bundle ID
          </Button>
        )}
        {!l.manual && (
          <Button variant="secondary" size="sm" className="h-[30px] px-3" onClick={() => l.setManual(true)}>
            Choose manually
          </Button>
        )}
      </div>
      {l.manual && (
        <div className="flex w-full max-w-[420px] gap-2">
          <Select value={l.choice} onValueChange={l.setChoice} disabled={l.isLoading}>
            <SelectTrigger aria-label="App Store Connect app" className="flex-1">
              <SelectValue placeholder={l.isLoading ? "Loading apps…" : "Select an app"} />
            </SelectTrigger>
            <SelectContent className="max-h-[320px]">
              {l.options?.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name} <span className="text-subtle">· {o.bundleId}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="secondary" size="md" disabled={!l.choice || l.busy} onClick={() => void l.link(l.choice)}>
            Link
          </Button>
        </div>
      )}
      {l.error != null && (
        <div className="w-full max-w-[420px]">
          <InlineError error={l.error} />
        </div>
      )}
    </div>
  );
}

function LinkApp({ app }: { app: TrackedApp }) {
  return (
    <EmptyState
      icon={Link2}
      title="Link this app to App Store Connect"
      description={
        app.bundleId
          ? `Match ${app.name} with its App Store Connect record by bundle ID (${app.bundleId}), or pick it from your account.`
          : `Pick the App Store Connect record that belongs to ${app.name}.`
      }
      action={<LinkControls app={app} />}
    />
  );
}

export function AscStatusBar({ state, app, error, feature, onSetup }: { state: Exclude<AscGateState, "ready" | "loading">; app: TrackedApp; error: string | null; feature: string; onSetup: () => void }) {
  if (state === "disconnected") return <ConnectCallout feature={feature} onConnect={onSetup} />;
  const title = state === "error" ? "App Store Connect connection failed" : `Link ${app.name} to App Store Connect to ${feature}`;
  const detail = state === "error" ? (error ?? "The saved credentials were rejected.") : "Showing public App Store data in read-only mode.";
  return (
    <div className="border-line-strong bg-card flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3">
      <span className="bg-secondary flex size-8 shrink-0 items-center justify-center rounded-lg">
        {state === "error" ? <AlertTriangle aria-hidden className="text-danger size-4" /> : <Link2 aria-hidden className="text-soft size-4" />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="lead-style">{title}</span>
        <span className="caption-style text-subtle break-words">{detail}</span>
      </div>
      {state === "error" ? (
        <Button variant="primary" size="sm" className="h-[30px] px-3" onClick={onSetup}>
          Update credentials
        </Button>
      ) : (
        <div className="min-w-[260px]">
          <LinkControls app={app} align="end" />
        </div>
      )}
    </div>
  );
}

export function AscMenu({ app, onSetup, onRefresh }: { app: TrackedApp; onSetup: () => void; onRefresh?: () => void }) {
  async function unlink() {
    try {
      await api(`/api/asc/apps/${app.id}/link`, { method: "DELETE" });
      await revalidate("/api/apps");
      toast.success("App unlinked");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className="h-[30px] px-3">
          <span className="bg-status size-1.5 rounded-full" aria-hidden />
          App Store Connect
          <ChevronsUpDown aria-hidden className="text-subtle size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[220px]">
        <DropdownMenuLabel>{app.ascAppId ? `Linked app ID ${app.ascAppId}` : "Not linked"}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {onRefresh && <DropdownMenuItem onSelect={onRefresh}>Reload from Apple</DropdownMenuItem>}
        <DropdownMenuItem onSelect={onSetup} className="gap-2">
          <Settings2 aria-hidden className="size-3.5" />
          API credentials
        </DropdownMenuItem>
        {app.ascAppId && (
          <DropdownMenuItem onSelect={() => void unlink()} className="gap-2">
            <Unlink aria-hidden className="size-3.5" />
            Unlink app
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export type AscGateState = "loading" | "disconnected" | "error" | "unlinked" | "ready";

export function useAscGate(app: TrackedApp | undefined) {
  const { status, isLoading } = useAscStatus();
  const [setupOpen, setSetupOpen] = useState(false);
  const state: AscGateState =
    isLoading || !status || !app ? "loading" : !status.configured ? "disconnected" : !status.connected ? "error" : !app.ascAppId ? "unlinked" : "ready";
  return { state, status, setupOpen, setSetupOpen, sheet: <ASCSetupSheet open={setupOpen} onOpenChange={setSetupOpen} /> };
}

export function AscGateFallback({
  state,
  app,
  feature,
  error,
  onSetup,
  children,
}: {
  state: Exclude<AscGateState, "ready">;
  app: TrackedApp | undefined;
  feature: string;
  error: string | null;
  onSetup: () => void;
  children?: ReactNode;
}) {
  if (state === "loading")
    return (
      <div className="text-subtle flex flex-1 items-center justify-center gap-2 py-16">
        <Loader2 aria-hidden className="size-4 animate-spin" /> Checking App Store Connect…
      </div>
    );
  if (state === "error")
    return (
      <EmptyState
        icon={PlugZap}
        title="App Store Connect connection failed"
        description={<span className="text-soft block break-words">{error ?? "The saved credentials were rejected."}</span>}
        action={
          <Button variant="primary" size="md" onClick={onSetup}>
            Update credentials
          </Button>
        }
      />
    );
  if (state === "unlinked" && app) return <LinkApp app={app} />;
  if (children) return <>{children}</>;
  return (
    <EmptyState
      icon={PlugZap}
      title="Connect App Store Connect"
      description={`Add an App Store Connect API key to ${feature}. Credentials are stored encrypted for this workspace only.`}
      action={
        <Button variant="primary" size="md" onClick={onSetup}>
          Connect App Store Connect
        </Button>
      }
    />
  );
}
