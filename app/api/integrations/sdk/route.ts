import { requestOrigin, sdkSnippets } from "@/lib/integrations/sdk";
import { json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const params = new URL(req.url).searchParams;
  const origin = requestOrigin(req);
  return json({ origin, snippets: await sdkSnippets(origin, params.get("bundleId")) });
});
