import { z } from "zod";
import { body, json } from "@/lib/server/http";
import { requireWorkspace } from "@/lib/server/context";
import { disconnect, getConnection, knownOrgs, saveConnection } from "@/lib/apple-ads/connection";
import { adsRoute } from "@/lib/apple-ads/http";
import { platformCredentials } from "@/lib/apple-ads/popularity";

export const GET = adsRoute(async () => {
  const { workspaceId, role, isAdmin } = await requireWorkspace();
  const [connection, orgs, platform] = await Promise.all([getConnection(workspaceId), knownOrgs(workspaceId), isAdmin ? platformCredentials() : null]);
  return json({ connection, orgs, canManage: role !== "member", platformAvailable: !!platform && role !== "member" });
});

export const PUT = adsRoute(async (req) => {
  const { workspaceId } = await requireWorkspace("admin");
  const input = await body(
    req,
    z.object({
      clientId: z.string().trim().min(1).max(200).optional(),
      teamId: z.string().trim().min(1).max(200).optional(),
      keyId: z.string().trim().min(1).max(200).optional(),
      orgId: z.string().regex(/^\d+$/).nullable().optional(),
    }),
  );
  const connection = await saveConnection(workspaceId, input);
  return json({ connection, orgs: await knownOrgs(workspaceId), canManage: true });
});

export const DELETE = adsRoute(async (req) => {
  const { workspaceId } = await requireWorkspace("admin");
  const keepKeys = new URL(req.url).searchParams.get("keepKeys") !== "0";
  return json({ connection: await disconnect(workspaceId, keepKeys), orgs: [], canManage: true });
});
