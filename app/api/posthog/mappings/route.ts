import { mappedApps } from "@/lib/posthog/apps";
import { json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const GET = route(() => json(mappedApps()));
