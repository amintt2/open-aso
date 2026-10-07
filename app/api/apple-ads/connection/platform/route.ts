import { json } from "@/lib/server/http";
import { HttpError } from "@/lib/server/http";
import { requireWorkspace } from "@/lib/server/context";
import { applyCredentials, knownOrgs } from "@/lib/apple-ads/connection";
import { adsRoute } from "@/lib/apple-ads/http";
import { platformCredentials } from "@/lib/apple-ads/popularity";

export const POST = adsRoute(async () => {
  const { workspaceId, isAdmin } = await requireWorkspace("admin");
  if (!isAdmin) throw new HttpError(403, "Only platform admins can use the platform Apple Ads key");
  const creds = await platformCredentials();
  if (!creds) throw new HttpError(409, "The platform Apple Ads key isn't configured. Set it up in Admin → Platform first.");
  const { connection, orgs } = await applyCredentials(workspaceId, creds);
  return json({ connection, orgs: orgs.length ? orgs : await knownOrgs(workspaceId), canManage: true, platformAvailable: true });
});
