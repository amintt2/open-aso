import { listAscApps } from "@/lib/asc/apps";
import { json, route } from "@/lib/server/http";

export const GET = route(async () => json(await listAscApps()));
