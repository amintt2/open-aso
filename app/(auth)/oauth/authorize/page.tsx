import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ConsentCard, { ConsentError } from "@/components/oauth/consent-card";
import { findClient } from "@/lib/oauth/http";
import { describeScopes, FULL_SCOPE, grantScopes } from "@/lib/oauth/scopes";
import { getSession } from "@/lib/server/context";
import { db } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Connect an assistant · Open ASO", robots: { index: false } };

type Search = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function hostOf(uri: string) {
  try {
    const url = new URL(uri);
    return url.host || `${url.protocol}//${url.pathname.split("/")[0]}`;
  } catch {
    return uri;
  }
}

export default async function AuthorizePage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const clientId = one(sp.client_id);
  const redirectUri = one(sp.redirect_uri);
  const codeChallenge = one(sp.code_challenge);
  const method = one(sp.code_challenge_method) || "plain";

  if (!clientId || !redirectUri) return <ConsentError title="Invalid request" detail="The app didn't send the required OAuth parameters (client_id and redirect_uri)." />;
  const client = await findClient(clientId);
  if (!client) return <ConsentError title="Unknown app" detail="This app isn't registered with Open ASO. Remove the connector and add it again." />;
  if (!client.redirect_uris.includes(redirectUri)) return <ConsentError title="Invalid redirect" detail="The redirect URI isn't registered for this app." />;
  if (one(sp.response_type) !== "code") return <ConsentError title="Unsupported request" detail="Only the authorization code flow (response_type=code) is supported." />;
  if (method !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(codeChallenge)) return <ConsentError title="Unsupported request" detail="Open ASO requires PKCE with S256." />;
  const scopes = grantScopes(one(sp.scope), client.scopes);
  if (!scopes) return <ConsentError title="Unsupported permissions" detail="The app asked for permissions Open ASO doesn't offer." />;

  const session = await getSession();
  if (!session) {
    const query = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (v === undefined ? [] : [[k, one(v)]])));
    redirect(`/login?next=${encodeURIComponent(`/oauth/authorize?${query.toString()}`)}`);
  }

  const workspaces = await db.all<{ id: string; name: string; role: string }>(
    `SELECT o.id, o.name, m.role FROM "member" m JOIN "organization" o ON o.id = m."organizationId" WHERE m."userId" = ? ORDER BY o.name`,
    [session.user.id],
  );
  if (!workspaces.length) return <ConsentError title="No workspace" detail="Your account isn't a member of any Open ASO workspace yet." />;
  const active = (session.session as { activeOrganizationId?: string | null }).activeOrganizationId;

  return (
    <ConsentCard
      client={{ clientId: client.client_id, name: client.client_name, logoUri: client.logo_uri?.startsWith("https://") ? client.logo_uri : null, redirectHost: hostOf(redirectUri) }}
      request={{ redirectUri, state: one(sp.state), scope: scopes.join(" "), codeChallenge, resource: one(sp.resource) }}
      permissions={describeScopes(scopes)}
      canChooseReadOnly={scopes.includes(FULL_SCOPE)}
      workspaces={workspaces}
      defaultWorkspaceId={workspaces.some((w) => w.id === active) ? active! : workspaces[0].id}
      viewer={{ email: session.user.email }}
    />
  );
}
