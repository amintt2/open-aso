"use client";

import { useState, type ReactNode } from "react";
import { CheckCircle2, Copy, ExternalLink, KeyRound, Loader2, PlugZap, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";
import Button, { buttonVariants } from "@/components/_ui/button";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/_ui/select";
import { api, revalidate, useApi } from "@/lib/client/api";
import type { AdsConnection, AdsOrg } from "@/lib/apple-ads/types";
import { cn } from "@/lib/utils";
import { ConfirmDialog, DetailSheet } from "./bits";
import { useAdsUi } from "./store";

type ConnectionResponse = { connection: AdsConnection; orgs: AdsOrg[]; canManage?: boolean; platformAvailable?: boolean };

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: ReactNode }) {
  return (
    <li className="border-border flex gap-4 border-b pb-6 last:border-0 last:pb-0">
      <span className={cn("bg-secondary flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] tabular-nums shadow-[0px_0px_0px_1px_#393939]", done && "bg-(--tag-green-bg) text-(--tag-green-text)")}>
        {done ? <CheckCircle2 aria-hidden className="size-3.5" /> : n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <h3 className="pt-1.5">{title}</h3>
        {children}
      </div>
    </li>
  );
}

export default function ConnectSheet() {
  const open = useAdsUi((s) => s.sheet === "connect");
  const openSheet = useAdsUi((s) => s.openSheet);
  const setDemo = useAdsUi((s) => s.setDemo);
  const { data, mutate } = useApi<ConnectionResponse>("/api/apple-ads/connection");
  const c = data?.connection;
  const canManage = data?.canManage !== false;
  const [ids, setIds] = useState<{ clientId: string; teamId: string; keyId: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [ownKey, setOwnKey] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"regenerate" | "disconnect" | null>(null);
  const form = ids ?? { clientId: c?.clientId ?? "", teamId: c?.teamId ?? "", keyId: c?.keyId ?? "" };

  async function run<T>(name: string, fn: () => Promise<T>) {
    setBusy(name);
    try {
      return await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
      await mutate();
      return undefined;
    } finally {
      setBusy(null);
    }
  }

  async function generate(privateKey?: string) {
    const res = await run("keys", () => api<{ publicKey: string }>("/api/apple-ads/connection/keys", { method: "POST", body: privateKey ? { privateKey } : { force: true } }));
    if (res) {
      toast.success(privateKey ? "Private key imported" : "Key pair generated");
      setOwnKey(null);
      await mutate();
    }
  }

  async function save() {
    const res = await run("save", () => api<ConnectionResponse>("/api/apple-ads/connection", { method: "PUT", body: { clientId: form.clientId, teamId: form.teamId, keyId: form.keyId } }));
    if (res) {
      setIds(null);
      await mutate(res, { revalidate: false });
      await test();
    }
  }

  async function test() {
    const res = await run("test", () => api<ConnectionResponse>("/api/apple-ads/connection/test", { method: "POST" }));
    if (res) {
      await mutate(res, { revalidate: false });
      toast.success(res.orgs.length ? `Connected. ${res.orgs.length} organization${res.orgs.length === 1 ? "" : "s"} found.` : "Connected, but this API user has no organizations.");
      if (res.connection.connected) {
        setDemo(false);
        await revalidate("/api/apple-ads/");
      }
    }
  }

  async function chooseOrg(orgId: string) {
    const res = await run("org", () => api<ConnectionResponse>("/api/apple-ads/connection", { method: "PUT", body: { orgId } }));
    if (res) {
      await mutate(res, { revalidate: false });
      setDemo(false);
      await revalidate("/api/apple-ads/");
      toast.success(`Using ${res.connection.orgName ?? "organization"}`);
    }
  }

  async function disconnect() {
    const res = await run("disconnect", () => api<ConnectionResponse>("/api/apple-ads/connection?keepKeys=1", { method: "DELETE" }));
    if (res) {
      setIds(null);
      await mutate(res, { revalidate: false });
      await revalidate("/api/apple-ads/");
    }
  }

  const idsFilled = form.clientId.trim() && form.teamId.trim() && form.keyId.trim();

  async function linkPlatformKey() {
    const res = await run("platform", () => api<ConnectionResponse>("/api/apple-ads/connection/platform", { method: "POST" }));
    if (res) {
      await mutate(res, { revalidate: false });
      await revalidate("/api/apple-ads/");
      toast.success(res.connection.connected ? `Connected to ${res.connection.orgName ?? "Apple Ads"}` : "Platform key linked — choose an organization below");
    }
  }

  return (
    <DetailSheet
      open={open}
      onOpenChange={(o) => !o && openSheet(null)}
      width="sm:max-w-[640px]"
      title="Connect Apple Ads"
      description="OAuth client credentials for the Apple Ads Campaign Management API. Credentials belong to this workspace; the private key is stored encrypted."
      actions={
        c?.configured &&
        canManage && (
          <Button variant="ghost" size="sm" disabled={busy !== null} onClick={() => setConfirm("disconnect")}>
            <Unplug aria-hidden className="size-3.5" />
            Disconnect
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-2 px-6 pt-6">
        <p className="caption-style text-subtle">Uses Campaign Management API v5, which Apple sunsets on Jan 26, 2027.</p>
        {!canManage && (
          <p role="note" className="border-border bg-secondary text-soft rounded-lg border p-3 text-[13px]">
            Only workspace admins can connect or change Apple Ads. You can still browse reports and the demo preview.
          </p>
        )}
      </div>
      {data?.platformAvailable && !c?.configured && (
        <div className="mx-6 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line-strong bg-secondary p-3">
          <p className="text-soft min-w-0 flex-1 text-[13px]">Your platform Apple Ads key is set up. Use the same API user for this workspace instead of creating a new key.</p>
          <Button variant="primary" size="sm" disabled={busy !== null} onClick={() => void linkPlatformKey()}>
            Use the platform key
          </Button>
        </div>
      )}
      <ol className="flex flex-col gap-6 p-6">
        <Step n={1} title="Invite an API user">
          <p className="text-soft">
            In Apple Ads, sign in as an account admin and open <b className="font-medium text-foreground">Account Settings → User Management → Invite Users</b>. Invite an Apple ID you control with the{" "}
            <b className="font-medium text-foreground">API Account Manager</b> role (or API Account Read Only for reporting only), then accept the invitation from that Apple ID.
          </p>
          <a href="https://ads.apple.com" target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "self-start")}>
            Open Apple Ads
            <ExternalLink aria-hidden className="size-3" />
          </a>
        </Step>

        <Step n={2} title="Create a key pair" done={!!c?.publicKey}>
          <p className="text-soft">Open ASO generates an EC P-256 key pair for this workspace and keeps the private key encrypted on the server. You upload only the public key.</p>
          {c?.publicKey && (
            <div className="relative">
              <pre className="bg-secondary border-line-strong caption-style text-soft overflow-x-auto rounded-lg border p-3 pr-12 leading-[1.5]">{c.publicKey.trim()}</pre>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Copy public key"
                className="absolute top-2 right-2"
                onClick={() => navigator.clipboard.writeText(c.publicKey ?? "").then(() => toast.success("Public key copied"))}
              >
                <Copy aria-hidden className="size-3.5" />
              </Button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant={c?.publicKey ? "secondary" : "primary"} size="sm" disabled={busy !== null || !canManage} onClick={() => (c?.publicKey ? setConfirm("regenerate") : generate())}>
              {busy === "keys" ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <KeyRound aria-hidden className="size-3.5" />}
              {c?.publicKey ? "Regenerate key pair" : "Generate key pair"}
            </Button>
            <Button variant="ghost" size="sm" disabled={!canManage} onClick={() => setOwnKey(ownKey === null ? "" : null)}>
              {ownKey === null ? "Use an existing private key" : "Cancel"}
            </Button>
          </div>
          {ownKey !== null && (
            <div className="flex flex-col gap-2">
              <textarea
                aria-label="Private key PEM"
                value={ownKey}
                onChange={(e) => setOwnKey(e.target.value)}
                placeholder="-----BEGIN EC PRIVATE KEY-----"
                rows={5}
                className="bg-secondary border-line-strong focus-visible:border-ring caption-style w-full rounded-lg border p-3 font-mono outline-none"
              />
              <Button variant="muted" size="sm" className="self-start" disabled={busy !== null || ownKey.trim().length < 40} onClick={() => generate(ownKey)}>
                Import private key
              </Button>
            </div>
          )}
        </Step>

        <Step n={3} title="Upload the public key and copy the IDs" done={!!(c?.clientId && c.teamId && c.keyId)}>
          <p className="text-soft">
            Sign in to Apple Ads as the API user, open <b className="font-medium text-foreground">Account Settings → API</b>, paste the public key and save. Apple then shows a clientId, teamId and keyId. Paste them here.
          </p>
          <div className="grid gap-3">
            <Field label="Client ID" htmlFor="ads-client">
              <Input id="ads-client" value={form.clientId} placeholder="SEARCHADS.xxxxxxxx-…" onChange={(e) => setIds({ ...form, clientId: e.target.value })} />
            </Field>
            <Field label="Team ID" htmlFor="ads-team">
              <Input id="ads-team" value={form.teamId} placeholder="SEARCHADS.xxxxxxxx-…" onChange={(e) => setIds({ ...form, teamId: e.target.value })} />
            </Field>
            <Field label="Key ID" htmlFor="ads-key">
              <Input id="ads-key" value={form.keyId} placeholder="xxxxxxxx-xxxx-…" onChange={(e) => setIds({ ...form, keyId: e.target.value })} />
            </Field>
          </div>
          <Button variant="primary" size="sm" className="self-start" disabled={busy !== null || !canManage || !idsFilled || !c?.hasPrivateKey} onClick={save}>
            {busy === "save" ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <PlugZap aria-hidden className="size-3.5" />}
            Save and test connection
          </Button>
        </Step>

        <Step n={4} title="Choose the organization" done={!!c?.connected}>
          {c?.lastError && (
            <p role="alert" className="border-(--tag-red-border) bg-(--tag-red-bg) text-(--tag-red-text) rounded-lg border p-3 text-[13px]">
              {c.lastError}
            </p>
          )}
          {data?.orgs.length ? (
            <Select value={c?.orgId ?? undefined} onValueChange={chooseOrg} disabled={busy !== null || !canManage}>
              <SelectTrigger aria-label="Organization">
                <SelectValue placeholder="Choose an organization" />
              </SelectTrigger>
              <SelectContent>
                {data.orgs.map((o) => (
                  <SelectItem key={o.orgId} value={o.orgId}>
                    {o.orgName} · {o.currency} · {o.roleNames.join(", ") || "no role"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-soft">Test the connection to load the organizations this API user can access. Currency is taken from the organization.</p>
          )}
          <Button variant="secondary" size="sm" className="self-start" disabled={busy !== null || !canManage || !c?.configured} onClick={test}>
            {busy === "test" ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <RefreshCw aria-hidden className="size-3.5" />}
            Test connection
          </Button>
          {c?.connected && (
            <p className="text-trend flex items-center gap-2 text-[13px]">
              <CheckCircle2 aria-hidden className="size-3.5" />
              Connected to {c.orgName ?? c.orgId} ({c.currency})
            </p>
          )}
        </Step>
      </ol>
      <ConfirmDialog
        open={confirm !== null}
        title={confirm === "disconnect" ? "Disconnect Apple Ads?" : "Replace the key pair?"}
        description={
          confirm === "disconnect"
            ? "Credentials and the selected organization are removed. The key pair is kept so you can reconnect with the same public key."
            : "The connection stops working until you upload the new public key in Apple Ads → Account Settings → API."
        }
        confirmLabel={confirm === "disconnect" ? "Disconnect" : "Replace key pair"}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const action = confirm;
          setConfirm(null);
          if (action === "disconnect") disconnect();
          else generate();
        }}
      />
    </DetailSheet>
  );
}
