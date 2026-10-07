import { getAscStatus } from "@/lib/asc/status";
import { json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const refresh = new URL(req.url).searchParams.get("refresh") === "1";
  return json(await getAscStatus({ refresh }));
});
