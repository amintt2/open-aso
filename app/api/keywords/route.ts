import { z } from "zod";
import { setKeywordsLiked } from "@/lib/keywords/history";
import { body, json, route } from "@/lib/server/http";

export const PATCH = route(async (req) => {
  const input = await body(
    req,
    z.object({
      ids: z.array(z.number().int()).min(1).max(1000),
      liked: z.boolean(),
    }),
  );
  setKeywordsLiked(input.ids, input.liked);
  return json({ ok: true });
});
