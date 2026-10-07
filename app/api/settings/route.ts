import { z } from "zod";
import { publicSettings, setSetting, type SettingKey } from "@/lib/server/settings";
import { body, json, route } from "@/lib/server/http";

export const GET = route(() => json(publicSettings()));

export const PUT = route(async (req) => {
  const input = await body(req, z.record(z.string(), z.string().nullable()));
  for (const [key, value] of Object.entries(input)) setSetting(key as SettingKey, value);
  return json(publicSettings());
});
