import { redirect } from "next/navigation";
import { listApps } from "@/lib/aso/apps";
import { requireWorkspace } from "@/lib/server/context";

export const dynamic = "force-dynamic";

const VIEW: Record<string, string> = {
  overview: "revenue",
  sources: "revenue",
  geography: "countries",
  retention: "retention",
  product: "funnel",
};

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { workspaceId } = await requireWorkspace();
  const query = await searchParams;
  const one = (key: string) => (Array.isArray(query[key]) ? query[key][0] : query[key]);
  const apps = await listApps(workspaceId);
  const requested = Number(one("app"));
  const app = apps.find((a) => a.id === requested) ?? apps.find((a) => a.isMine) ?? apps[0];
  if (!app) redirect("/");
  const tab = one("tab") ?? "";
  const days = one("days");
  const next = new URLSearchParams();
  if (days === "7" || days === "90") next.set("days", days);
  if (tab === "keywords") {
    next.set("view", "ads");
    redirect(`/apps/${app.id}/impact?${next.toString()}`);
  }
  if (VIEW[tab]) next.set("view", VIEW[tab]);
  const qs = next.toString();
  redirect(`/apps/${app.id}/traffic${qs ? `?${qs}` : ""}`);
}
