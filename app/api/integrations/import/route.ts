import { importAll, importPayload } from "@/lib/integrations/data";
import { HttpError, json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  const mode = new URL(req.url).searchParams.get("mode") === "replace" ? "replace" : "merge";
  const raw = await req.json().catch(() => {
    throw new HttpError(400, "The file is not valid JSON");
  });
  const parsed = importPayload.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, "This file is not an Open ASO export");
  return json({ ok: true, mode, imported: importAll(parsed.data, mode) });
});
