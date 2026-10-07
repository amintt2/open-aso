import { authenticateClient, oauthJson, preflight, readParams } from "@/lib/oauth/http";
import { revokeOAuthToken } from "@/lib/oauth/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const OPTIONS = preflight;

export async function POST(req: Request) {
  const params = await readParams(req).catch(() => ({}) as Record<string, string>);
  if (!params.token || !params.client_id) return oauthJson({});
  const client = await authenticateClient(params);
  if (client instanceof Response) return client;
  await revokeOAuthToken(params.token, client.id);
  return oauthJson({});
}
