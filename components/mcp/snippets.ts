export type Snippet = { id: string; label: string; title: string; language: string; code: string; note: string };

const PLACEHOLDER = "<YOUR_TOKEN>";

function isLocalUrl(url: string) {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".localhost");
  } catch {
    return true;
  }
}

function json(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function buildSnippets(url: string, auth: { required: boolean; token: string | null }): Snippet[] {
  const token = auth.token ?? PLACEHOLDER;
  const bearer = `Bearer ${token}`;
  const insecureRemote = url.startsWith("http://") && !isLocalUrl(url);
  const remoteArgs = ["-y", "mcp-remote", url, ...(insecureRemote ? ["--allow-http"] : []), ...(auth.required ? ["--header", "Authorization:${OPEN_ASO_AUTH}"] : [])];
  const remoteEnv = auth.required ? { OPEN_ASO_AUTH: bearer } : undefined;
  const headers = auth.required ? { Authorization: bearer } : undefined;
  const toml = (list: string[]) => `[${list.map((a) => JSON.stringify(a)).join(", ")}]`;

  return [
    {
      id: "claude-code",
      label: "Claude Code",
      title: "Terminal",
      language: "shell",
      code: `claude mcp add --transport http open-aso ${url}${auth.required ? ` --header "Authorization: ${bearer}"` : ""}`,
      note: "Add --scope user to make it available in every project. Run /mcp inside Claude Code to check the connection.",
    },
    {
      id: "claude-desktop",
      label: "Claude Desktop",
      title: "claude_desktop_config.json",
      language: "json",
      code: json({ mcpServers: { "open-aso": { command: "npx", args: remoteArgs, ...(remoteEnv ? { env: remoteEnv } : {}) } } }),
      note: "Settings → Developer → Edit Config, then restart Claude Desktop. Requires Node.js; mcp-remote bridges the HTTP endpoint to stdio.",
    },
    {
      id: "cursor",
      label: "Cursor",
      title: "~/.cursor/mcp.json",
      language: "json",
      code: json({ mcpServers: { "open-aso": { url, ...(headers ? { headers } : {}) } } }),
      note: "Use .cursor/mcp.json in a project instead to scope it to that workspace.",
    },
    {
      id: "vscode",
      label: "VS Code",
      title: ".vscode/mcp.json",
      language: "json",
      code: json(
        auth.required
          ? {
              inputs: [{ type: "promptString", id: "open-aso-token", description: "Open ASO MCP token", password: true }],
              servers: { "open-aso": { type: "http", url, headers: { Authorization: "Bearer ${input:open-aso-token}" } } },
            }
          : { servers: { "open-aso": { type: "http", url } } },
      ),
      note: auth.required ? "VS Code asks for the token once and stores it securely, so this file is safe to commit." : "Open the Chat view in Agent mode and pick the Open ASO tools.",
    },
    {
      id: "codex",
      label: "Codex",
      title: "~/.codex/config.toml",
      language: "toml",
      code: [
        "[mcp_servers.open-aso]",
        `command = "npx"`,
        `args = ${toml(remoteArgs)}`,
        ...(remoteEnv ? [`env = { OPEN_ASO_AUTH = ${JSON.stringify(bearer)} }`] : []),
      ].join("\n"),
      note: "Restart Codex after editing. Requires Node.js for mcp-remote.",
    },
  ];
}
