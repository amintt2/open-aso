import { json } from "@/lib/server/http";
import { refresh } from "@/lib/apple-ads/service";
import { adsRoute } from "@/lib/apple-ads/http";

export const POST = adsRoute(() => {
  refresh();
  return json({ ok: true });
});
