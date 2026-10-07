import { z } from "zod";
import { recentIntegrationEvents } from "@/lib/integrations/log";
import { requireWorkspace } from "@/lib/server/context";
import { json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

const provider = z.enum(["revenuecat", "superwall", "sdk"]);

export const GET = route(async (req) => {
  const { workspaceId } = await requireWorkspace();
  const params = new URL(req.url).searchParams;
  return json(
    await recentIntegrationEvents(
      workspaceId,
      provider.parse(params.get("provider")),
      Math.min(100, Number(params.get("limit")) || 25),
    ),
  );
});
