export const HOSTED_ORIGIN = "https://aso.french-web.com";
export const PLUGIN_REPO = "amintt2/open-aso";
export const CLAUDE_CONNECTORS_APP = "claude://claude.ai/customize/connectors?modal=add-custom-connector";

export function cursorDeepLink(url: string) {
  const config = btoa(JSON.stringify({ url }));
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=open-aso&config=${encodeURIComponent(config)}`;
}

export function cursorConfig(url: string) {
  return JSON.stringify({ mcpServers: { "open-aso": { url } } }, null, 2);
}

export function installCommands(url: string) {
  return {
    claudeCode: `claude mcp add --transport http open-aso ${url}`,
    codex: `codex mcp add open-aso --url ${url}`,
    claudePlugin: `/plugin marketplace add ${PLUGIN_REPO}\n/plugin install open-aso@open-aso`,
    codexPlugin: `codex plugin marketplace add ${PLUGIN_REPO}\ncodex plugin add open-aso@open-aso`,
  };
}
