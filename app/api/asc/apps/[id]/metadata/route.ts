import { getAppMetadata, getMetadata } from "@/lib/asc/metadata";
import { idParam, json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const id = await idParam(params);
  const search = new URL(req.url).searchParams;
  const locale = search.get("locale");
  if (locale) return json(await getMetadata(id, locale));
  return json(await getAppMetadata(id, { refresh: search.get("refresh") === "1" }));
});
