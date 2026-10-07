import { redirect } from "next/navigation";
import { Toaster } from "sonner";
import { getSession } from "@/lib/server/context";
import { db } from "@/lib/server/db";
import { pendingInvitesFor } from "@/lib/workspace/service";
import Sidebar from "@/components/shell/sidebar";
import AddAppDialog from "@/components/shell/add-app-dialog";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const membership = await db.get(`SELECT 1 FROM "member" WHERE "userId" = ? LIMIT 1`, [session.user.id]);
  if (!membership) {
    const [invite] = await pendingInvitesFor(session.user.email);
    if (invite) redirect(`/invite/${invite.id}`);
  }
  return (
    <main className="flex h-dvh max-w-full overflow-hidden">
      <Sidebar />
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</section>
      <AddAppDialog />
      <Toaster theme="dark" position="bottom-right" toastOptions={{ className: "!bg-popover !border-line-strong !text-foreground" }} />
    </main>
  );
}
