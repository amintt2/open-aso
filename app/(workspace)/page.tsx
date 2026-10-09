import { listApps } from "@/lib/aso/apps";
import { mcpEnabled } from "@/lib/mcp/config";
import { mcpConnect } from "@/lib/mcp/connect";
import { listWorkspaceGrants } from "@/lib/oauth/tokens";
import { requireWorkspace } from "@/lib/server/context";
import HomeView from "@/components/dashboard/home-view";
import Welcome from "@/components/shell/welcome";
import type { HomeClaude } from "@/components/mcp/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { workspaceId, userId, role } = await requireWorkspace();
  const [apps, enabled, grants] = await Promise.all([listApps(workspaceId), mcpEnabled(workspaceId), listWorkspaceGrants(workspaceId)]);
  const claude: HomeClaude = { ...mcpConnect(), enabled, canManage: role !== "member", connected: grants.some((g) => g.userId === userId) };
  return apps.length ? <HomeView claude={claude} /> : <Welcome claude={claude} />;
}
