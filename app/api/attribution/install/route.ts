import { after } from "next/server";
import { logIntegrationEvent } from "@/lib/integrations/log";
import {
  drainPendingAttribution,
  installInput,
  recordInstall,
  resolvePendingAttribution,
} from "@/lib/analytics/ingest";
import { bearer, workspaceForToken } from "@/lib/server/tokens";
import { HttpError, body, json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  const workspaceId = await workspaceForToken("sdk", bearer(req));
  if (!workspaceId)
    throw new HttpError(
      401,
      "Unauthorized: send the workspace's SDK token as Authorization: Bearer <token>",
    );
  const input = await body(req, installInput);
  try {
    const result = await recordInstall(workspaceId, input);
    after(async () => {
      if (result.attribution === "pending")
        await resolvePendingAttribution(workspaceId, result.installId);
      await drainPendingAttribution();
    });
    return json(
      { ok: true, ...result },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    if (error instanceof HttpError)
      await logIntegrationEvent(
        workspaceId,
        "sdk",
        "error",
        "install",
        error.message,
      );
    throw error;
  }
});
