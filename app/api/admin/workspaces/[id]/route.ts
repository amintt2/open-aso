import { z } from "zod";
import { requireAdmin } from "@/lib/server/context";
import { body, HttpError, json, route } from "@/lib/server/http";
import { setWorkspacePlan } from "@/lib/server/plans";
import { workspaceExists } from "@/lib/workspace/service";

export const PATCH = route<{ params: Promise<{ id: string }> }>(
  async (req, { params }) => {
    await requireAdmin();
    const { id } = await params;
    const input = await body(
      req,
      z.object({ plan: z.enum(["free", "pro", "unlimited"]) }),
    );
    if (!(await workspaceExists(id)))
      throw new HttpError(404, "Workspace not found");
    await setWorkspacePlan(id, input.plan);
    return json({ ok: true });
  },
);
