import { getScreenshots } from "@/lib/asc/metadata";
import { HttpError, idParam, json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const id = await idParam(params);
  const search = new URL(req.url).searchParams;
  const locale = search.get("locale");
  if (!locale) throw new HttpError(400, "locale is required");
  return json(await getScreenshots(id, locale, { refresh: search.get("refresh") === "1" }));
});
