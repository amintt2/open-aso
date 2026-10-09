"use client";

import { MousePointerClick } from "lucide-react";
import Button from "@/components/_ui/button";
import SettingsCard from "@/components/settings/settings-card";
import CopyField, { CodeBlock } from "@/components/integrations/copy-field";
import type { McpConnect } from "@/lib/mcp/connect";
import { AddToClaudeButton, CLAUDE_CONNECT_HINT } from "./claude-connect";
import { CLAUDE_CONNECTORS_APP, cursorConfig, cursorDeepLink, HOSTED_ORIGIN, installCommands } from "./install";

function open(href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.click();
}

function Step({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="border-border flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-col gap-1">
        <h3>{title}</h3>
        <p className="caption-style text-subtle">{description}</p>
      </div>
      {children}
    </div>
  );
}

export default function ConnectCard({ connect, enabled, onOpenClaude }: { connect: McpConnect; enabled: boolean; onOpenClaude: () => void }) {
  const { url } = connect;
  const cmd = installCommands(url);
  const hosted = new URL(url).origin === HOSTED_ORIGIN;
  return (
    <SettingsCard
      id="connect"
      title="Connect your assistant"
      description="Add Open ASO as a remote MCP server. Your assistant opens an Open ASO sign-in page where you pick the workspace and approve; no token to copy."
    >
      {!enabled && <p className="caption-style text-(--tag-amber-text)">The server is off. Enable it above, or connected assistants get an error on every call.</p>}
      <CopyField label="Server URL" value={url} />
      <div className="grid gap-3 md:grid-cols-2">
        <Step title="Claude & Claude Desktop" description={`${CLAUDE_CONNECT_HINT} Claude warns that the connector was suggested by an external link; click Continue.`}>
          <div className="flex flex-wrap gap-2">
            <AddToClaudeButton href={connect.claudeUrl} onOpen={onOpenClaude} />
            <Button variant="secondary" size="md" onClick={() => open(CLAUDE_CONNECTORS_APP)}>
              <MousePointerClick aria-hidden className="size-3.5" />
              Desktop app (paste URL)
            </Button>
          </div>
        </Step>
        <Step title="Cursor" description="Installs the server in Cursor, which then asks you to sign in. Or add this to ~/.cursor/mcp.json.">
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="md" onClick={() => open(cursorDeepLink(url))}>
              <MousePointerClick aria-hidden className="size-3.5" />
              Add to Cursor
            </Button>
          </div>
          <CodeBlock title="~/.cursor/mcp.json" language="json" code={cursorConfig(url)} />
        </Step>
        <Step title="Claude Code" description="Run in a terminal, then /mcp inside Claude Code to sign in. Add --scope user to use it in every project.">
          <CodeBlock title="Terminal" language="shell" code={cmd.claudeCode} />
        </Step>
        <Step title="Codex" description="Run in a terminal. Codex opens the sign-in page; if it doesn't, run codex mcp login open-aso.">
          <CodeBlock title="Terminal" language="shell" code={cmd.codex} />
        </Step>
      </div>
      <p className="caption-style text-subtle">ChatGPT and other clients that support remote MCP with OAuth: add a custom connector and paste the server URL above.</p>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3>Plugins with ASO skills</h3>
          <p className="caption-style text-subtle">
            The plugins add slash commands (/open-aso:keywords, /open-aso:audit, …) and workflow skills on top of the tools.
            {!hosted && ` They connect to ${HOSTED_ORIGIN}; on this instance use the commands above instead.`}
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <CodeBlock title="Claude Code" language="slash commands" code={cmd.claudePlugin} />
          <CodeBlock title="Codex" language="shell" code={cmd.codexPlugin} />
        </div>
      </div>
    </SettingsCard>
  );
}
