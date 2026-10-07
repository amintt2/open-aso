import { isAdminEmail } from "@/lib/auth";
import { db } from "./db";
import { HttpError } from "./http";

export type PlanId = "free" | "pro" | "unlimited";

export type Limits = { apps: number; keywords: number; competitors: number; countriesPerScan: number; aiRequestsPerDay: number };

export const PLANS: Record<PlanId, { label: string; limits: Limits }> = {
  free: { label: "Free", limits: { apps: 2, keywords: 150, competitors: 5, countriesPerScan: 15, aiRequestsPerDay: 10 } },
  pro: { label: "Pro", limits: { apps: 20, keywords: 3000, competitors: 50, countriesPerScan: 66, aiRequestsPerDay: 200 } },
  unlimited: { label: "Unlimited", limits: { apps: 1e9, keywords: 1e9, competitors: 1e9, countriesPerScan: 66, aiRequestsPerDay: 1e9 } },
};

export async function workspacePlan(workspaceId: string): Promise<PlanId> {
  const row = await db.get<{ plan: PlanId }>("SELECT plan FROM workspace_plans WHERE workspace_id = ?", [workspaceId]);
  if (row && row.plan in PLANS) return row.plan;
  const owners = await db.all<{ email: string }>(
    `SELECT u."email" FROM "member" m JOIN "user" u ON u."id" = m."userId" WHERE m."organizationId" = ? AND m."role" = 'owner'`,
    [workspaceId],
  );
  return owners.some((o) => isAdminEmail(o.email)) ? "unlimited" : "free";
}

export async function setWorkspacePlan(workspaceId: string, plan: PlanId) {
  await db.run(
    "INSERT INTO workspace_plans (workspace_id, plan, updated_at) VALUES (?, ?, now()) ON CONFLICT (workspace_id) DO UPDATE SET plan = excluded.plan, updated_at = excluded.updated_at",
    [workspaceId, plan],
  );
}

export async function workspaceLimits(workspaceId: string) {
  return PLANS[await workspacePlan(workspaceId)].limits;
}

export async function workspaceUsage(workspaceId: string) {
  const row = await db.get<{ apps: number; keywords: number; competitors: number }>(
    `SELECT (SELECT count(*) FROM apps WHERE workspace_id = ?) AS apps,
            (SELECT count(*) FROM keywords k JOIN apps a ON a.id = k.app_id WHERE a.workspace_id = ?) AS keywords,
            (SELECT count(*) FROM competitors c JOIN apps a ON a.id = c.app_id WHERE a.workspace_id = ?) AS competitors`,
    [workspaceId, workspaceId, workspaceId],
  );
  return row ?? { apps: 0, keywords: 0, competitors: 0 };
}

export async function assertWithinLimit(workspaceId: string, resource: "apps" | "keywords" | "competitors", adding = 1) {
  const [limits, usage] = await Promise.all([workspaceLimits(workspaceId), workspaceUsage(workspaceId)]);
  if (usage[resource] + adding > limits[resource])
    throw new HttpError(402, `Your plan allows ${limits[resource]} ${resource}. You're using ${usage[resource]}. Upgrade or remove some first.`);
}
