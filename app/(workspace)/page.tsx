import { listApps } from "@/lib/aso/apps";
import { requireWorkspace } from "@/lib/server/context";
import HomeView from "@/components/dashboard/home-view";
import Welcome from "@/components/shell/welcome";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { workspaceId } = await requireWorkspace();
  const apps = await listApps(workspaceId);
  return apps.length ? <HomeView /> : <Welcome />;
}
