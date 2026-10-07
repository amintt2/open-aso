"use client";

import { useRef, useState } from "react";
import { CheckCircle2, ExternalLink, FileKey2, Loader2, PlugZap, Unplug, X } from "lucide-react";
import { toast } from "sonner";
import Button, { buttonVariants } from "@/components/_ui/button";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/_ui/sheet";
import { api, revalidate } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { InlineError } from "./asc-error";
import { errorMessage, useAscStatus } from "./use-asc";

type Result = { ok: boolean; sampleApp: string | null };

export const textareaClass =
  "border-line-strong bg-secondary text-foreground placeholder:text-subtle focus-visible:border-ring w-full min-w-0 rounded-lg border px-3 py-2.5 text-[14px] leading-[1.4] outline-none transition-[border-color] duration-150 disabled:cursor-not-allowed disabled:opacity-50";

export default function ASCSetupSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { status, mutate } = useAscStatus();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[480px] max-w-[100vw]">
        {open && <SetupForm key={status?.keyId ?? "new"} initialIssuer={status?.issuerId ?? ""} initialKey={status?.keyId ?? ""} hasKey={!!status?.configured} onDone={() => { void mutate(); onOpenChange(false); }} />}
      </SheetContent>
    </Sheet>
  );
}

function SetupForm({ initialIssuer, initialKey, hasKey, onDone }: { initialIssuer: string; initialKey: string; hasKey: boolean; onDone: () => void }) {
  const [issuerId, setIssuerId] = useState(initialIssuer);
  const [keyId, setKeyId] = useState(initialKey);
  const [privateKey, setPrivateKey] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState<"test" | "save" | "disconnect" | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const canSubmit = issuerId.trim().length >= 8 && keyId.trim().length >= 4 && (privateKey.trim().length > 0 || hasKey);

  async function onFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    setPrivateKey(text);
    setFileName(file.name);
    const match = file.name.match(/AuthKey_([A-Z0-9]+)\.p8$/i);
    if (match && !keyId) setKeyId(match[1]);
    setResult(null);
  }

  async function submit(dryRun: boolean) {
    setBusy(dryRun ? "test" : "save");
    setError(null);
    setResult(null);
    try {
      const res = await api<Result>("/api/asc/credentials", {
        method: "PUT",
        body: { issuerId: issuerId.trim(), keyId: keyId.trim(), privateKey: privateKey.trim() || null, dryRun },
      });
      setResult(res);
      if (!dryRun) {
        await revalidate("/api/asc");
        toast.success("App Store Connect connected");
        onDone();
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    setBusy("disconnect");
    try {
      await api("/api/asc/credentials", { method: "DELETE" });
      await revalidate("/api/asc");
      toast.success("App Store Connect disconnected");
      onDone();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <PlugZap aria-hidden className="text-soft size-4" />
          App Store Connect
        </SheetTitle>
        <SheetClose asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Close">
            <X aria-hidden className="size-4" />
          </Button>
        </SheetClose>
      </SheetHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        <SheetDescription className="p-style text-soft leading-[1.45]">
          Create a team API key in App Store Connect → Users and Access → Integrations → App Store Connect API with the App Manager role. The key stays on this machine and is only sent to Apple.
        </SheetDescription>
        <a href="https://appstoreconnect.apple.com/access/integrations/api" target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "link", size: "none" }), "w-fit text-[13px]")}>
          Open API keys in App Store Connect
          <ExternalLink aria-hidden className="size-3" />
        </a>
        <Field label="Issuer ID" htmlFor="asc-issuer" required hint="Shown above the keys table, e.g. 69a6de70-…">
          <Input id="asc-issuer" value={issuerId} onChange={(e) => setIssuerId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" autoComplete="off" spellCheck={false} />
        </Field>
        <Field label="Key ID" htmlFor="asc-key" required>
          <Input id="asc-key" value={keyId} onChange={(e) => setKeyId(e.target.value.toUpperCase())} placeholder="ABC123DEFG" autoComplete="off" spellCheck={false} />
        </Field>
        <Field
          label="Private key (.p8)"
          htmlFor="asc-p8"
          required={!hasKey}
          hint={hasKey ? "A key is saved. Leave empty to keep it." : "Paste the contents of AuthKey_XXXX.p8 or upload the file."}
          trailing={
            <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
              <FileKey2 aria-hidden className="size-3.5" />
              Upload .p8
            </Button>
          }
        >
          <textarea
            id="asc-p8"
            value={privateKey}
            onChange={(e) => {
              setPrivateKey(e.target.value);
              setFileName(null);
            }}
            rows={7}
            placeholder={hasKey ? "•••••• saved ••••••" : "-----BEGIN PRIVATE KEY-----"}
            spellCheck={false}
            autoComplete="off"
            className={cn(textareaClass, "font-mono text-[12px]")}
          />
          <input ref={fileRef} type="file" accept=".p8,text/plain" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
        </Field>
        {fileName && <p className="caption-style text-subtle">Loaded {fileName}</p>}
        {error != null && <InlineError error={error} />}
        {result?.ok && (
          <div className="border-(--tag-green-border) bg-(--tag-green-bg) text-(--tag-green-text) flex items-center gap-2 rounded-lg border px-3 py-2.5">
            <CheckCircle2 aria-hidden className="size-3.5 shrink-0" />
            <p>Connection works{result.sampleApp ? ` — found “${result.sampleApp}”` : ""}.</p>
          </div>
        )}
        {hasKey && (
          <div className="border-border mt-auto flex flex-col gap-3 border-t pt-5">
            {confirmDisconnect ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-soft flex-1">Remove the saved credentials from this machine?</p>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDisconnect(false)}>
                  Cancel
                </Button>
                <Button variant="muted" size="sm" className="text-danger" disabled={busy !== null} onClick={() => void disconnect()}>
                  {busy === "disconnect" ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <Unplug aria-hidden className="size-3.5" />}
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="w-fit" onClick={() => setConfirmDisconnect(true)}>
                <Unplug aria-hidden className="size-3.5" />
                Disconnect App Store Connect
              </Button>
            )}
          </div>
        )}
      </div>
      <SheetFooter>
        <Button variant="secondary" size="md" disabled={!canSubmit || busy !== null} onClick={() => void submit(true)}>
          {busy === "test" && <Loader2 aria-hidden className="size-3.5 animate-spin" />}
          Test connection
        </Button>
        <Button variant="primary" size="md" disabled={!canSubmit || busy !== null} onClick={() => void submit(false)}>
          {busy === "save" && <Loader2 aria-hidden className="size-3.5 animate-spin" />}
          Save &amp; connect
        </Button>
      </SheetFooter>
    </>
  );
}
