import { z } from "zod";
import { auth } from "@/lib/auth";
import { requireWorkspace } from "@/lib/server/context";
import { body, HttpError, json, route } from "@/lib/server/http";
import { authCall, workspaceDetails } from "@/lib/workspace/service";

export const GET = route(async () => {
  const { workspaceId, userId, role } = await requireWorkspace();
  return json(await workspaceDetails(workspaceId, userId, role));
});

export const PATCH = route(async (req) => {
  const { workspaceId, userId, role } = await requireWorkspace("admin");
  const input = await body(
    req,
    z.object({ name: z.string().trim().min(1).max(80) }),
  );
  await authCall((headers) =>
    auth.api.updateOrganization({
      headers,
      body: { organizationId: workspaceId, data: { name: input.name } },
    }),
  );
  return json(await workspaceDetails(workspaceId, userId, role));
});

export const DELETE = route(async (req) => {
  const { workspaceId, userId, role } = await requireWorkspace("owner");
  const input = await body(req, z.object({ confirm: z.string() }));
  const details = await workspaceDetails(workspaceId, userId, role);
  if (input.confirm.trim() !== details.name.trim())
    throw new HttpError(400, "Type the workspace name to confirm");
  if (details.workspaceCount <= 1)
    throw new HttpError(
      400,
      "This is your only workspace. Create another one before deleting it.",
    );
  await authCall((headers) =>
    auth.api.deleteOrganization({
      headers,
      body: { organizationId: workspaceId },
    }),
  );
  return json({ ok: true });
});
