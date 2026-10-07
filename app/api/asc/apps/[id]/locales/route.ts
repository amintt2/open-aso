import { z } from "zod";
import { addLocalization, listLocalizations } from "@/lib/asc/metadata";
import { body, idParam, json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, { params }) => json(await listLocalizations(await idParam(params))));

export const POST = route<Ctx>(async (req, { params }) => {
  const id = await idParam(params);
  const input = await body(req, z.object({ locale: z.string().min(2).max(10), name: z.string().max(30).optional(), subtitle: z.string().max(30).optional() }));
  const { locale, ...init } = input;
  return json(await addLocalization(id, locale, init), { status: 201 });
});
