import { z } from "zod";
import { auth } from "@/lib/auth";
import { requireUser } from "@/lib/server/context";
import { body, json, route } from "@/lib/server/http";
import { authCall, slugFor } from "@/lib/workspace/service";

export const POST = route(async (req) => {
  await requireUser();
  const input = await body(
    req,
    z.object({ name: z.string().trim().min(1).max(80) }),
  );
  const created = await authCall((headers) =>
    auth.api.createOrganization({
      headers,
      body: { name: input.name, slug: slugFor(input.name) },
    }),
  );
  return json({ id: created?.id ?? null }, { status: 201 });
});
