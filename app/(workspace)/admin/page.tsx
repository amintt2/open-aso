import { redirect } from "next/navigation";
import AdminView from "@/components/admin/admin-view";
import { requireAdmin } from "@/lib/server/context";

export const dynamic = "force-dynamic";

export default async function Page() {
  const ok = await requireAdmin().then(
    () => true,
    () => false,
  );
  if (!ok) redirect("/");
  return <AdminView />;
}
