export function publicOrigin(req?: Request) {
  const configured = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  if (req) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    if (host) return `${proto ?? new URL(req.url).protocol.replace(":", "")}://${host}`;
    return new URL(req.url).origin;
  }
  return "http://localhost:3000";
}

export function mcpResourceUrl(origin: string) {
  return `${origin}/api/mcp`;
}

export function resourceMetadataUrl(origin: string) {
  return `${origin}/.well-known/oauth-protected-resource`;
}
