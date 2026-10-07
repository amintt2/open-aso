import { refreshAppStoreData } from "@/lib/aso/apps";
import { idParam, json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (_req, { params }) => json(await refreshAppStoreData(await idParam(params))));
