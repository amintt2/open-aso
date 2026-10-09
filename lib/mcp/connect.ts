import { mcpResourceUrl, publicOrigin } from "@/lib/oauth/origin";
import { SITE_NAME } from "@/lib/seo";

export type McpConnect = { name: string; url: string; claudeUrl: string };

export function claudeConnectorUrl(name: string, url: string) {
  const query = new URLSearchParams({ modal: "add-custom-connector", connectorName: name, connectorUrl: url });
  return `https://claude.ai/new?${query.toString()}#customize/connectors/yours`;
}

export function mcpConnect(req?: Request): McpConnect {
  const url = mcpResourceUrl(publicOrigin(req));
  return { name: SITE_NAME, url, claudeUrl: claudeConnectorUrl(SITE_NAME, url) };
}
