import { z } from "zod";
import { requireWorkspace } from "@/lib/server/context";
import { body, json, route } from "@/lib/server/http";
import { publicSettings, setSetting, type SettingKey } from "@/lib/server/settings";

const WRITABLE: SettingKey[] = ["ai.anthropicKey", "ai.model"];

export const GET = route(async () => {
  const { workspaceId } = await requireWorkspace();
  return json(await publicSettings(workspaceId));
});

export const PUT = route(async (req) => {
  const { workspaceId } = await requireWorkspace("admin");
  const input = await body(req, z.record(z.string(), z.string().nullable()));
  for (const [key, value] of Object.entries(input)) if (WRITABLE.includes(key as SettingKey)) await setSetting(workspaceId, key as SettingKey, value);
  return json(await publicSettings(workspaceId));
});
