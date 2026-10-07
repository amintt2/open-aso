import { z } from "zod";
import { HttpError, route } from "@/lib/server/http";
import type { WorkspaceContext } from "@/lib/server/context";
import { AppleAdsError } from "./auth";
import { RANGE_OPTIONS, type RangeDays } from "./types";

export function adsRoute<Ctx = unknown>(handler: (req: Request, ctx: Ctx) => Promise<Response> | Response) {
  return route<Ctx>(async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      if (error instanceof AppleAdsError) throw new HttpError(error.status >= 500 ? 502 : error.status, `Apple Ads: ${error.message}`);
      throw error;
    }
  });
}

export function searchOpts(req: Request) {
  const params = new URL(req.url).searchParams;
  const raw = Number(params.get("days") ?? 30);
  const days = (RANGE_OPTIONS as number[]).includes(raw) ? (raw as RangeDays) : 30;
  return { days, demo: params.get("demo") === "1", refresh: params.get("refresh") === "1" };
}

export const writeFlags = {
  dryRun: z.boolean().optional(),
  demo: z.boolean().optional(),
};

export const idString = z.union([z.string().regex(/^\d+$/), z.number().int().positive()]).transform(String);

export async function segment(params: Promise<Record<string, string>>, name: string) {
  const value = (await params)[name];
  if (!value || !/^\d+$/.test(value)) throw new HttpError(400, `Invalid ${name}`);
  return value;
}

export function writeAccess<T extends { dryRun?: boolean; demo?: boolean }>(ctx: WorkspaceContext, input: T): T & { userId: string } {
  if (!input.demo && !input.dryRun && ctx.role === "member") throw new HttpError(403, "Only workspace admins can change Apple Ads campaigns. Previews and demo mode stay available.");
  return { ...input, userId: ctx.userId };
}
