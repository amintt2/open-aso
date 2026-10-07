import { requireCredentials, testConnection } from "@/lib/posthog/client";
import { posthogStatus } from "@/lib/posthog/status";
import { json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const GET = route(() => json(posthogStatus()));

export const POST = route(async () => json({ status: posthogStatus(), check: await testConnection(requireCredentials()) }));
