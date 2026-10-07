import { headers } from "next/headers";
import { auth, isAdminEmail } from "@/lib/auth";
import { db } from "./db";
import { HttpError } from "./http";
import { bindWorkspace } from "./request-context";

export type WorkspaceRole = "owner" | "admin" | "member";

export type WorkspaceContext = {
  userId: string;
  email: string;
  name: string;
  workspaceId: string;
  role: WorkspaceRole;
  isAdmin: boolean;
};

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireUser() {
  const session = await getSession();
  if (!session) throw new HttpError(401, "Sign in required");
  return session;
}

export async function requireWorkspace(minRole: WorkspaceRole = "member"): Promise<WorkspaceContext> {
  const session = await requireUser();
  let workspaceId = (session.session as { activeOrganizationId?: string | null }).activeOrganizationId ?? null;
  let member = workspaceId
    ? await db.get<{ role: WorkspaceRole; organizationId: string }>(`SELECT role, "organizationId" FROM "member" WHERE "userId" = ? AND "organizationId" = ?`, [session.user.id, workspaceId])
    : undefined;
  if (!member) {
    member = await db.get<{ role: WorkspaceRole; organizationId: string }>(`SELECT role, "organizationId" FROM "member" WHERE "userId" = ? ORDER BY "createdAt" ASC LIMIT 1`, [session.user.id]);
    if (!member) throw new HttpError(403, "You are not a member of any workspace");
    workspaceId = member.organizationId;
    await db.run(`UPDATE "session" SET "activeOrganizationId" = ? WHERE "id" = ?`, [workspaceId, session.session.id]);
  }
  const rank: Record<WorkspaceRole, number> = { member: 0, admin: 1, owner: 2 };
  if (rank[member.role] < rank[minRole]) throw new HttpError(403, "You don't have permission to do this in this workspace");
  bindWorkspace(member.organizationId);
  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
    workspaceId: member.organizationId,
    role: member.role,
    isAdmin: isAdminEmail(session.user.email),
  };
}

export async function requireAdmin() {
  const ctx = await requireWorkspace();
  if (!ctx.isAdmin) throw new HttpError(403, "Admin only");
  return ctx;
}
