import { handleSuperwall } from "@/lib/integrations/superwall";
import { json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const POST = route(async (req) => json(handleSuperwall(req.headers, await req.text())));
