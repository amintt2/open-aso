import { json } from "@/lib/server/http";
import { testConnection } from "@/lib/apple-ads/connection";
import { adsRoute } from "@/lib/apple-ads/http";

export const POST = adsRoute(async () => json(await testConnection()));
