import { deleteLocalization } from "@/lib/asc/metadata";
import { idParam, json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string; locale: string }> };

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const id = await idParam(params);
  const { locale } = await params;
  return json(await deleteLocalization(id, decodeURIComponent(locale)));
});
