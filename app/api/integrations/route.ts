import { integrationsStatus } from "@/lib/integrations/status";
import { json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const GET = route(() => json(integrationsStatus()));
