import { z } from "zod";
import { clearPlatform, generatePlatformKeys, platformStatus, probePlatform, savePlatformIds, testPlatform } from "@/lib/apple-ads/popularity";
import { requireAdmin } from "@/lib/server/context";
import { body, json, route } from "@/lib/server/http";

export const GET = route(async () => {
  await requireAdmin();
  return json(await platformStatus());
});

const Input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("generate"), force: z.boolean().optional() }),
  z.object({
    action: z.literal("save"),
    clientId: z.string().regex(/^SEARCHADS\.[\w-]+$/, "Client ID looks like SEARCHADS.xxxx"),
    teamId: z.string().regex(/^SEARCHADS\.[\w-]+$/, "Team ID looks like SEARCHADS.xxxx"),
    keyId: z.string().min(8),
  }),
  z.object({ action: z.literal("test"), term: z.string().min(1).max(100).optional(), country: z.string().length(2).optional() }),
  z.object({ action: z.literal("clear") }),
  z.object({ action: z.literal("probe"), path: z.string().max(200), payload: z.unknown().optional() }),
]);

export const POST = route(async (req) => {
  await requireAdmin();
  const input = await body(req, Input);
  if (input.action === "generate") return json({ ...(await generatePlatformKeys(input.force)), status: await platformStatus() });
  if (input.action === "save") {
    await savePlatformIds(input);
    return json(await platformStatus());
  }
  if (input.action === "test") return json({ result: await testPlatform(input.term, input.country?.toLowerCase()), status: await platformStatus() });
  if (input.action === "probe") return json(await probePlatform(input.path, input.payload));
  await clearPlatform();
  return json(await platformStatus());
});
