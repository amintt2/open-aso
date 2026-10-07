import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { APIError } from "better-auth/api";
import { createPersonalWorkspace, isAdminEmail } from "@/lib/auth";
import { db } from "@/lib/server/db";
import { HttpError } from "@/lib/server/http";
import {
  PLANS,
  workspaceLimits,
  workspacePlan,
  workspaceUsage,
  type PlanId,
} from "@/lib/server/plans";
import type { WorkspaceRole } from "@/lib/server/context";

export const MEMBER_LIMIT = 50;

export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
  memberCount: number;
  createdAt: string;
};

export type PendingInvite = {
  id: string;
  workspaceName: string;
  inviterName: string;
  role: WorkspaceRole;
};

export type WorkspaceMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: WorkspaceRole;
  createdAt: string;
};

export type WorkspaceInvite = {
  id: string;
  email: string;
  role: WorkspaceRole;
  expiresAt: string;
  createdAt: string;
  inviterName: string;
};

export type WorkspaceDetails = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  role: WorkspaceRole;
  userId: string;
  plan: PlanId;
  planLabel: string;
  limits: Awaited<ReturnType<typeof workspaceLimits>>;
  usage: Awaited<ReturnType<typeof workspaceUsage>>;
  memberLimit: number;
  members: WorkspaceMember[];
  invitations: WorkspaceInvite[];
  workspaceCount: number;
};

export async function authCall<T>(fn: (h: Headers) => Promise<T>): Promise<T> {
  try {
    return await fn(await headers());
  } catch (error) {
    if (error instanceof APIError)
      throw new HttpError(
        Number(error.statusCode) || 400,
        error.message || "Request failed",
      );
    throw error;
  }
}

export async function userWorkspaces(userId: string) {
  return db.all<WorkspaceSummary>(
    `SELECT o."id", o."name", o."slug", m."role", o."createdAt",
            (SELECT count(*) FROM "member" x WHERE x."organizationId" = o."id") AS "memberCount"
       FROM "member" m JOIN "organization" o ON o."id" = m."organizationId"
      WHERE m."userId" = ?
      ORDER BY m."createdAt" ASC`,
    [userId],
  );
}

export async function pendingInvitesFor(email: string) {
  return db.all<PendingInvite>(
    `SELECT i."id", o."name" AS "workspaceName", u."name" AS "inviterName", coalesce(i."role", 'member') AS "role"
       FROM "invitation" i
       JOIN "organization" o ON o."id" = i."organizationId"
       JOIN "user" u ON u."id" = i."inviterId"
      WHERE lower(i."email") = lower(?) AND i."status" = 'pending' AND i."expiresAt" > now()
      ORDER BY i."createdAt" DESC`,
    [email],
  );
}

export async function workspaceMembers(workspaceId: string) {
  return db.all<WorkspaceMember>(
    `SELECT m."id", m."userId", u."name", u."email", u."image", m."role", m."createdAt"
       FROM "member" m JOIN "user" u ON u."id" = m."userId"
      WHERE m."organizationId" = ?
      ORDER BY CASE m."role" WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, m."createdAt" ASC`,
    [workspaceId],
  );
}

export async function workspaceInvites(workspaceId: string) {
  return db.all<WorkspaceInvite>(
    `SELECT i."id", i."email", coalesce(i."role", 'member') AS "role", i."expiresAt", i."createdAt", u."name" AS "inviterName"
       FROM "invitation" i JOIN "user" u ON u."id" = i."inviterId"
      WHERE i."organizationId" = ? AND i."status" = 'pending' AND i."expiresAt" > now()
      ORDER BY i."createdAt" DESC`,
    [workspaceId],
  );
}

export async function workspaceDetails(
  workspaceId: string,
  userId: string,
  role: WorkspaceRole,
): Promise<WorkspaceDetails> {
  const org = await db.get<{
    id: string;
    name: string;
    slug: string;
    createdAt: string;
  }>(
    `SELECT "id", "name", "slug", "createdAt" FROM "organization" WHERE "id" = ?`,
    [workspaceId],
  );
  if (!org) throw new HttpError(404, "Workspace not found");
  const [plan, limits, usage, members, invitations, count] = await Promise.all([
    workspacePlan(workspaceId),
    workspaceLimits(workspaceId),
    workspaceUsage(workspaceId),
    workspaceMembers(workspaceId),
    role === "member" ? Promise.resolve([]) : workspaceInvites(workspaceId),
    db.get<{ n: number }>(
      `SELECT count(*) AS n FROM "member" WHERE "userId" = ?`,
      [userId],
    ),
  ]);
  return {
    ...org,
    role,
    userId,
    plan,
    planLabel: PLANS[plan].label,
    limits,
    usage,
    memberLimit: MEMBER_LIMIT,
    members,
    invitations,
    workspaceCount: count?.n ?? 0,
  };
}

export async function invitationPreview(id: string) {
  const row = await db.get<{
    id: string;
    email: string;
    role: WorkspaceRole;
    status: string;
    expiresAt: string;
    organizationId: string;
    workspaceName: string;
    inviterName: string;
    inviterEmail: string;
  }>(
    `SELECT i."id", i."email", coalesce(i."role", 'member') AS "role", i."status", i."expiresAt", i."organizationId",
            o."name" AS "workspaceName", u."name" AS "inviterName", u."email" AS "inviterEmail"
       FROM "invitation" i
       JOIN "organization" o ON o."id" = i."organizationId"
       JOIN "user" u ON u."id" = i."inviterId"
      WHERE i."id" = ?`,
    [id],
  );
  if (!row) return null;
  const expired = new Date(row.expiresAt).getTime() < Date.now();
  return {
    ...row,
    state:
      row.status !== "pending" ? row.status : expired ? "expired" : "pending",
  };
}

export function slugFor(name: string) {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32) || "workspace";
  return `${base}-${randomUUID().slice(0, 6)}`;
}

export async function ensureHasWorkspace(user: {
  id: string;
  name?: string | null;
  email: string;
}) {
  const row = await db.get(
    `SELECT 1 FROM "member" WHERE "userId" = ? LIMIT 1`,
    [user.id],
  );
  if (row) return null;
  return createPersonalWorkspace(user);
}

export async function setActiveWorkspace(
  sessionId: string,
  workspaceId: string | null,
) {
  await db.run(
    `UPDATE "session" SET "activeOrganizationId" = ? WHERE "id" = ?`,
    [workspaceId, sessionId],
  );
}

export async function adminWorkspaces() {
  const rows = await db.all<{
    id: string;
    name: string;
    slug: string;
    createdAt: string;
    plan: PlanId | null;
    owners: string | null;
    members: number;
    apps: number;
    keywords: number;
    competitors: number;
  }>(
    `SELECT o."id", o."name", o."slug", o."createdAt", p.plan,
            (SELECT string_agg(u."email", ',' ORDER BY m."createdAt") FROM "member" m JOIN "user" u ON u."id" = m."userId" WHERE m."organizationId" = o."id" AND m."role" = 'owner') AS owners,
            (SELECT count(*) FROM "member" m WHERE m."organizationId" = o."id") AS members,
            (SELECT count(*) FROM apps a WHERE a.workspace_id = o."id") AS apps,
            (SELECT count(*) FROM keywords k JOIN apps a ON a.id = k.app_id WHERE a.workspace_id = o."id") AS keywords,
            (SELECT count(*) FROM competitors c JOIN apps a ON a.id = c.app_id WHERE a.workspace_id = o."id") AS competitors
       FROM "organization" o
       LEFT JOIN workspace_plans p ON p.workspace_id = o."id"
      ORDER BY o."createdAt" DESC`,
  );
  return rows.map((r) => {
    const owners = r.owners ? r.owners.split(",") : [];
    const plan: PlanId =
      r.plan && r.plan in PLANS
        ? r.plan
        : owners.some((e) => isAdminEmail(e))
          ? "unlimited"
          : "free";
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      createdAt: r.createdAt,
      plan,
      explicitPlan: !!r.plan,
      owners,
      members: r.members,
      usage: { apps: r.apps, keywords: r.keywords, competitors: r.competitors },
      limits: PLANS[plan].limits,
    };
  });
}

export async function adminUsers() {
  const rows = await db.all<{
    id: string;
    name: string;
    email: string;
    image: string | null;
    createdAt: string;
    workspaces: number;
    lastSeenAt: string | null;
    providers: string | null;
  }>(
    `SELECT u."id", u."name", u."email", u."image", u."createdAt",
            (SELECT count(*) FROM "member" m WHERE m."userId" = u."id") AS workspaces,
            (SELECT max(s."updatedAt") FROM "session" s WHERE s."userId" = u."id") AS "lastSeenAt",
            (SELECT string_agg(DISTINCT a."providerId", ',') FROM "account" a WHERE a."userId" = u."id") AS providers
       FROM "user" u
      ORDER BY u."createdAt" DESC`,
  );
  return rows.map((r) => ({
    ...r,
    providers: r.providers ? r.providers.split(",") : [],
    isAdmin: isAdminEmail(r.email),
  }));
}

export async function workspaceExists(id: string) {
  return !!(await db.get(`SELECT 1 FROM "organization" WHERE "id" = ?`, [id]));
}
