import { json } from "@/lib/server/http";
import { recentChanges } from "@/lib/apple-ads/schema";
import { adsRoute } from "@/lib/apple-ads/http";

export const GET = adsRoute(() => json(recentChanges(100)));
