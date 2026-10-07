"use client";

import { ExternalLink, MousePointerClick } from "lucide-react";
import Button from "@/components/_ui/button";
import SettingsCard from "@/components/settings/settings-card";
import CopyField, { CodeBlock } from "@/components/integrations/copy-field";
import { CLAUDE_CONNECTORS_APP, CLAUDE_CONNECTORS_WEB, cursorDeepLink, HOSTED_ORIGIN, installCommands } from "./install";

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

export default function ConnectCard({ url, origin, enabled }: { url: string; origin: string; enabled: boolean }) {
  const cmd = installCommands(url);
  const hosted = origin === HOSTED_ORIGIN;
  return (
    <SettingsCard
      id="connect"
      title="Connect your assistant"
      description="Add Open ASO as a remote MCP server. Your assistant opens an Open ASO sign-in page where you pick the workspace and approve; no token to copy."
    >
      {!enabled && <p className="caption-style text-(--tag-amber-text)">The server is off. Enable it above, or connected assistants get an error on every call.</p>}
      <CopyField label="Server URL" value={url} />
      <div className="grid gap-3 md:grid-cols-2">
        <Step title="Claude Desktop & claude.ai" description="Opens Settings → Connectors. Choose Add custom connector, paste the server URL and click Connect.">
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="md" onClick={() => open(CLAUDE_CONNECTORS_APP)}>
              <MousePointerClick aria-hidden className="size-3.5" />
              Open Claude Desktop
            </Button>
            <Button variant="secondary" size="md" onClick={() => window.open(CLAUDE_CONNECTORS_WEB, "_blank", "noopener,noreferrer")}>
              <ExternalLink aria-hidden className="size-3.5" />
              Claude on the web
            </Button>
          </div>
        </Step>
        <Step title="Cursor" description="Installs the server in Cursor. Cursor then asks you to sign in to Open ASO.">
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="md" onClick={() => open(cursorDeepLink(url))}>
              <MousePointerClick aria-hidden className="size-3.5" />
              Add to Cursor
            </Button>
          </div>
        </Step>
        <Step title="Claude Code" description="Run in a terminal, then /mcp inside Claude Code to sign in. Add --scope user to use it in every project.">
          <CodeBlock title="Terminal" language="shell" code={cmd.claudeCode} />
        </Step>
        <Step title="Codex" description="Run in a terminal. Codex opens the sign-in page; if it doesn't, run codex mcp login open-aso.">
          <CodeBlock title="Terminal" language="shell" code={cmd.codex} />
        </Step>
      </div>
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
