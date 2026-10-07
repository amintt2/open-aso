import { mcpConfig, mcpStats } from "@/lib/mcp/config";
import { json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const GET = route(() => {
  const config = mcpConfig();
  return json({ ...config, authMode: config.tokenSet ? "token" : process.env.OPEN_ASO_PASSWORD ? "blocked" : "localhost", stats: mcpStats() });
});
