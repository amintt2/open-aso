import { Toaster } from "sonner";
import Sidebar from "@/components/shell/sidebar";
import AddAppDialog from "@/components/shell/add-app-dialog";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex h-dvh max-w-full overflow-hidden">
      <Sidebar />
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</section>
      <AddAppDialog />
      <Toaster theme="dark" position="bottom-right" toastOptions={{ className: "!bg-popover !border-line-strong !text-foreground" }} />
    </main>
  );
}
