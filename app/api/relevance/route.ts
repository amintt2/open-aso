import { relevanceStatus } from "@/lib/relevance/score";
import { requireWorkspace } from "@/lib/server/context";
import { json, route } from "@/lib/server/http";

export const GET = route(async () => {
  await requireWorkspace();
  return json(relevanceStatus());
});
