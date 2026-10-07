import { redirect } from "next/navigation";
import { listApps } from "@/lib/aso/apps";
import Welcome from "@/components/shell/welcome";

export const dynamic = "force-dynamic";

export default function Home() {
  const apps = listApps();
  if (apps.length) redirect(`/apps/${apps[0].id}/keywords`);
  return <Welcome />;
}
