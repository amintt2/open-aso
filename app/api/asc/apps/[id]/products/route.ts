import { listProducts } from "@/lib/asc/pricing";
import { idParam, json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const id = await idParam(params);
  return json(await listProducts(id, { refresh: new URL(req.url).searchParams.get("refresh") === "1" }));
});
