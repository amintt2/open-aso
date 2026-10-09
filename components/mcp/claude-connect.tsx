"use client";

import { useState } from "react";
import { ChevronRight, ExternalLink, PlugZap } from "lucide-react";
import { toast } from "sonner";
import Button, { buttonVariants } from "@/components/_ui/button";
import CopyField from "@/components/integrations/copy-field";
import { api, revalidate } from "@/lib/client/api";
import type { HomeClaude } from "./types";

export const CLAUDE_CONNECT_HINT = "One click: Claude opens with the connector pre-filled, you sign in, and you're ready.";

export function AddToClaudeButton({ href, size = "md", onOpen }: { href: string; size?: "sm" | "md"; onOpen?: () => void }) {
  return (
    <a className={buttonVariants({ variant: "primary", size })} href={href} target="_blank" rel="noopener" onClick={onOpen}>
      <PlugZap aria-hidden className="size-3.5" />
      Add to Claude
      <ExternalLink aria-hidden className="size-3 opacity-70" />
    </a>
  );
}

export function useClaudeConnect(claude: HomeClaude) {
  const [enabled, setEnabled] = useState(claude.enabled);
  async function onOpen() {
    if (enabled || !claude.canManage) return;
    try {
      await api("/api/mcp/settings", { method: "PUT", body: { enabled: true } });
      setEnabled(true);
      revalidate("/api/mcp");
      toast.success("MCP server enabled for this workspace");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not enable the MCP server");
    }
  }
  return { enabled, onOpen };
}

export function RawUrl({ url }: { url: string }) {
  return (
    <details className="group">
      <summary className="caption-style text-subtle hover:text-foreground flex cursor-pointer list-none items-center gap-1 transition-colors duration-150 [&::-webkit-details-marker]:hidden">
        <ChevronRight aria-hidden className="size-3.5 transition-transform duration-150 group-open:rotate-90" />
        Server URL for Cursor, ChatGPT or Claude Code
      </summary>
      <div className="mt-3 flex flex-col gap-2">
        <CopyField label="MCP server URL" value={url} />
        <Button variant="link" size="none" href="/mcp#connect" className="caption-style self-start">
          All setup options
        </Button>
      </div>
    </details>
  );
}

export function ClaudeConnectBanner({ claude }: { claude: HomeClaude }) {
  const { enabled, onOpen } = useClaudeConnect(claude);
  return (
    <section aria-labelledby="claude-connect-title" className="border-border bg-card flex flex-col gap-4 rounded-xl border p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="claude-connect-title">Use {claude.name} from Claude</h2>
          <p className="caption-style text-subtle max-w-[560px]">Ask Claude about your keywords, rankings, reviews and Apple Ads in plain language. Read-only unless an admin allows write tools.</p>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
          <AddToClaudeButton href={claude.claudeUrl} onOpen={onOpen} />
          <p className="caption-style text-subtle max-w-[320px] md:text-right">{CLAUDE_CONNECT_HINT}</p>
        </div>
      </div>
      {!enabled && !claude.canManage && <p className="caption-style text-(--tag-amber-text)">The MCP server is off for this workspace. Ask a workspace admin to enable it in MCP Server before connecting.</p>}
      <RawUrl url={claude.url} />
    </section>
  );
}
