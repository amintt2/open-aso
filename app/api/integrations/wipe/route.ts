import { z } from "zod";
import { assertConfirmation, wipeAll } from "@/lib/integrations/data";
import { body, json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  const { confirm } = await body(req, z.object({ confirm: z.string() }));
  assertConfirmation(confirm);
  wipeAll();
  return json({ ok: true });
});
