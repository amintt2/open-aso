import { exportWorkspace } from "@/lib/integrations/data";
import { requireWorkspace } from "@/lib/server/context";
import { route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const { workspaceId } = await requireWorkspace("admin");
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(await exportWorkspace(workspaceId)), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="open-aso-export-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
});
