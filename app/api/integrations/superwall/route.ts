import { handleSuperwall } from "@/lib/integrations/superwall";
import { json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const POST = route(async (req) =>
  json(
    await handleSuperwall(
      new URL(req.url).searchParams.get("w"),
      req.headers,
      await req.text(),
    ),
  ),
);
