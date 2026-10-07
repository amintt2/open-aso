"use client";

import { useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/_ui/button";
import { Input } from "@/components/_ui/input";
import type { IntegrationsStatus } from "@/lib/integrations/status";
import { api, revalidate } from "@/lib/client/api";
import { timeAgo } from "@/lib/client/format";
import CopyField, { CodeBlock } from "./copy-field";
import { EventLog, LocalhostNotice, Section, Step, useOrigin } from "./shared";

export default function SuperwallPanel({ status }: { status: IntegrationsStatus["superwall"] }) {
  const origin = useOrigin();
  const [secret, setSecret] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(value: string | null) {
    setSaving(true);
    try {
      await api("/api/integrations/config", { method: "PUT", body: { superwallSecret: value } });
      await revalidate("/api/integrations");
      setSecret("");
      toast.success(value ? "Signing secret saved" : "Signing secret removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <LocalhostNotice origin={origin} who="Superwall's servers" />
      <Section title="Setup">
        <ol className="flex flex-col gap-6">
          <Step n={1} title="Create a webhook endpoint in Superwall">
            <p className="text-soft">In the Superwall dashboard open Settings → Webhooks (Integrations), add an endpoint with this URL and subscribe to the purchase, renewal, cancellation and refund events.</p>
            <CopyField label="Endpoint URL" value={`${origin}${status.path}`} />
          </Step>
          <Step n={2} title="Paste the signing secret">
            <p className="text-soft">Copy the endpoint&apos;s signing secret (it starts with whsec_). Every delivery is verified with HMAC-SHA256 and rejected if older than 5 minutes.</p>
            {status.secretHint && (
              <div className="bg-secondary border-line-strong flex h-9 items-center justify-between gap-2 rounded-lg border pr-1 pl-3">
                <span className="font-mono text-[13px]">{status.secretHint}</span>
                <Button variant="ghost" size="sm" onClick={() => save(null)} disabled={saving}>
                  <Trash2 aria-hidden className="size-3.5" />
                  Remove
                </Button>
              </div>
            )}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (secret.trim()) void save(secret.trim());
              }}
            >
              <Input type="password" autoComplete="off" spellCheck={false} placeholder={status.secretHint ? "Replace signing secret" : "whsec_…"} value={secret} onChange={(e) => setSecret(e.target.value)} aria-label="Superwall signing secret" />
              <Button type="submit" variant="primary" size="md" disabled={saving || !secret.trim()}>
                <Save aria-hidden className="size-3.5" />
                Save
              </Button>
            </form>
          </Step>
          <Step n={3} title="Tag users with the Open ASO user id">
            <CodeBlock title="Swift" language="swift" code={`Superwall.shared.setUserAttributes(["openAsoId": OpenASO.userId])`} />
            <p className="caption-style text-subtle">Events are matched to apps by bundle id and to installs by this attribute or by the app user id.</p>
          </Step>
        </ol>
      </Section>
      <Section title={`Recent events · ${status.events} stored${status.lastEvent ? ` · last ${timeAgo(status.lastEvent.receivedAt)}` : ""}`}>
        <EventLog provider="superwall" />
      </Section>
    </div>
  );
}
