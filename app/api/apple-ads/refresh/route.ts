import { json } from "@/lib/server/http";
import { requireWorkspace } from "@/lib/server/context";
import { refresh } from "@/lib/apple-ads/service";
import { adsRoute } from "@/lib/apple-ads/http";

export const POST = adsRoute(async () => {
  const { workspaceId } = await requireWorkspace();
  await refresh(workspaceId);
  return json({ ok: true });
});
