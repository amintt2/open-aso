import {
  issueToken,
  revokeToken as revokeWorkspaceToken,
  tokenInfo,
} from "@/lib/server/tokens";

export function maskSecret(value: string | undefined) {
  if (!value) return null;
  const prefix = value.includes("_")
    ? value.slice(0, value.indexOf("_") + 1)
    : "";
  return `${prefix.slice(0, 8)}••••${value.slice(-4)}`;
}

export const INTEGRATION_TOKEN_KINDS = ["revenuecat", "sdk"] as const;

export type IntegrationTokenKind = (typeof INTEGRATION_TOKEN_KINDS)[number];

export function rotateToken(workspaceId: string, kind: IntegrationTokenKind) {
  return issueToken(workspaceId, kind);
}

export function revokeToken(workspaceId: string, kind: IntegrationTokenKind) {
  return revokeWorkspaceToken(workspaceId, kind);
}

export async function tokenHint(
  workspaceId: string,
  kind: IntegrationTokenKind,
) {
  return (await tokenInfo(workspaceId, kind))?.hint ?? null;
}
