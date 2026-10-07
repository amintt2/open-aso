import { eventInput, recordEvent } from "@/lib/analytics/ingest";
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
  const input = await body(req, eventInput);
  await recordEvent(workspaceId, input);
  return json({ ok: true });
});
