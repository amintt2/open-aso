export const FULL_SCOPE = "mcp";
export const READ_SCOPE = "mcp:read";
export const SUPPORTED_SCOPES = [FULL_SCOPE, READ_SCOPE] as const;

const SUPPORTED = new Set<string>(SUPPORTED_SCOPES);

export function parseScopes(value: unknown): string[] {
  return [...new Set(String(value ?? "").split(/\s+/).filter(Boolean))];
}

export function registrationScopes(value: unknown): string[] | null {
  const requested = parseScopes(value);
  if (!requested.length) return [...SUPPORTED_SCOPES];
  const scopes = requested.filter((s) => SUPPORTED.has(s));
  return scopes.length ? scopes : null;
}

export function grantScopes(requested: unknown, registered: string[]): string[] | null {
  const asked = parseScopes(requested);
  const known = registered.filter((s) => SUPPORTED.has(s));
  const granted = asked.length ? asked.filter((s) => known.includes(s)) : known;
  return granted.length ? granted : null;
}

export function canWrite(scopes: string[]) {
  return scopes.includes(FULL_SCOPE);
}

export function describeScopes(scopes: string[]) {
  const items: { kind: "read" | "write"; text: string }[] = [
    { kind: "read", text: "Read this workspace's apps, tracked keywords, rankings, competitors, reviews, App Store Connect metadata, Apple Ads and analytics" },
  ];
  if (canWrite(scopes))
    items.push({
      kind: "write",
      text: "Use write tools (track keywords, edit App Store Connect metadata, change Apple Ads bids, budgets and keywords) when a workspace admin has allowed them. Store and Ads changes are dry runs until confirmed.",
    });
  return items;
}
