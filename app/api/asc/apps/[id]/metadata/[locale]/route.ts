import { z } from "zod";
import { updateMetadata } from "@/lib/asc/metadata";
import { METADATA_LIMITS } from "@/lib/asc/types";
import { body, idParam, json, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string; locale: string }> };

const text = (max: number) => z.string().max(max).optional();
const url = z.union([z.literal(""), z.url()]).optional();

const schema = z.object({
  name: text(METADATA_LIMITS.name),
  subtitle: text(METADATA_LIMITS.subtitle),
  privacyPolicyUrl: url,
  privacyChoicesUrl: url,
  keywords: text(METADATA_LIMITS.keywords),
  description: text(METADATA_LIMITS.description),
  promotionalText: text(METADATA_LIMITS.promotionalText),
  whatsNew: text(METADATA_LIMITS.whatsNew),
  marketingUrl: url,
  supportUrl: url,
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  const id = await idParam(params);
  const { locale } = await params;
  const patch = await body(req, schema);
  return json(await updateMetadata(id, decodeURIComponent(locale), patch));
});
