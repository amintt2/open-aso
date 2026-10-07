import { redirect } from "next/navigation";
import { listApps } from "@/lib/aso/apps";
import { requireWorkspace } from "@/lib/server/context";
import Welcome from "@/components/shell/welcome";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { workspaceId } = await requireWorkspace();
  const apps = await listApps(workspaceId);
  if (apps.length) redirect(`/apps/${apps[0].id}/keywords`);
  return <Welcome />;
}
