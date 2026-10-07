import { z } from "zod";
import { removeCredentials, saveCredentials } from "@/lib/posthog/client";
import { posthogStatus } from "@/lib/posthog/status";
import { body, json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

const input = z.object({
  region: z.enum(["us", "eu", "custom"]),
  host: z.string().trim().max(500).nullish(),
  projectId: z.union([z.string(), z.number().int().positive()]).transform((v) => String(v)),
  apiKey: z.string().trim().max(500).nullish(),
});

export const PUT = route(async (req) => {
  const check = await saveCredentials(await body(req, input));
  return json({ status: posthogStatus(), check });
});

export const DELETE = route(() => {
  removeCredentials();
  return json({ status: posthogStatus() });
});
