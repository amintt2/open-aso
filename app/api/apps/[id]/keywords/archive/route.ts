import { z } from "zod";
import { archiveKeywords, listKeywords } from "@/lib/aso/keywords";
import { archiveCandidates, archiveNoise } from "@/lib/keywords/prune";
import { requireWorkspace } from "@/lib/server/context";
import { body, HttpError, idParam, json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const { workspaceId } = await requireWorkspace();
  const country = new URL(req.url).searchParams.get("country") ?? undefined;
  return json(await archiveCandidates(workspaceId, await idParam(params), country));
});

export const POST = route<Ctx>(async (req, { params }) => {
  const { workspaceId } = await requireWorkspace();
  const appId = await idParam(params);
  const input = await body(
    req,
    z.object({
      ids: z.array(z.number().int().positive()).max(5000).optional(),
      country: z.string().length(2).optional(),
      all: z.boolean().optional(),
      mode: z.enum(["candidates", "exact"]).default("candidates"),
    }),
  );
  const country = input.country?.toLowerCase();
  if (input.mode === "exact") {
    if (!input.ids?.length && !country) throw new HttpError(400, "Pass ids or a country to archive");
    const owned = await listKeywords(workspaceId, appId, country);
    const allowed = input.ids ? new Set(input.ids) : null;
    const ids = owned.filter((k) => !allowed || allowed.has(k.id)).map((k) => k.id);
    return json({ archived: await archiveKeywords(workspaceId, ids, "manual") });
  }
  if (!input.ids?.length && !country && !input.all) throw new HttpError(400, "Pass ids, a country or all: true");
  const result = await archiveNoise(workspaceId, appId, { country, ids: input.ids, apply: true });
  return json({ archived: result.archived });
});
