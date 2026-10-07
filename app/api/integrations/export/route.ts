import { exportAll } from "@/lib/integrations/data";
import { route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const GET = route(() => {
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(exportAll()), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="open-aso-export-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
});
