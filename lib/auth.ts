import { randomUUID } from "node:crypto";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import { pool, rawDb } from "@/lib/server/db";

export function devLoginEnabled() {
  return process.env.OPEN_ASO_DEV_LOGIN === "1" && process.env.NODE_ENV !== "production";
}

export function adminEmails() {
  return (process.env.OPEN_ASO_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined) {
  return !!email && adminEmails().includes(email.toLowerCase());
}

async function canSignUp(email: string) {
  const mode = process.env.OPEN_ASO_SIGNUPS ?? "open";
  if (mode === "open" || isAdminEmail(email)) return true;
  if (mode === "closed") return false;
  const invite = await rawDb.get(
    `SELECT 1 FROM "invitation" WHERE lower("email") = lower(?) AND "status" = 'pending' AND "expiresAt" > now() LIMIT 1`,
    [email],
  );
  return !!invite;
}

async function createPersonalWorkspace(user: { id: string; name?: string | null; email: string }) {
  const id = randomUUID();
  const base = (user.name || user.email.split("@")[0] || "workspace").trim();
  const slug = `${base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "workspace"}-${id.slice(0, 6)}`;
  await rawDb.run(`INSERT INTO "organization" ("id", "name", "slug", "createdAt") VALUES (?, ?, ?, now())`, [id, `${base}'s workspace`, slug]);
  await rawDb.run(`INSERT INTO "member" ("id", "organizationId", "userId", "role", "createdAt") VALUES (?, ?, ?, 'owner', now())`, [randomUUID(), id, user.id]);
  return id;
}

async function firstWorkspaceId(userId: string) {
  const row = await rawDb.get<{ organizationId: string }>(
    `SELECT "organizationId" FROM "member" WHERE "userId" = ? ORDER BY "createdAt" ASC LIMIT 1`,
    [userId],
  );
  return row?.organizationId ?? null;
}

export const authOptions = {
  appName: "Open ASO",
  database: pool(),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      prompt: "select_account",
    },
  },
  emailAndPassword: { enabled: devLoginEnabled(), autoSignIn: true },
  session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => ((await canSignUp(user.email)) ? undefined : false),
        after: async (user) => {
          const pending = await rawDb.get(`SELECT 1 FROM "invitation" WHERE lower("email") = lower(?) AND "status" = 'pending' LIMIT 1`, [user.email]);
          if (!pending) await createPersonalWorkspace(user);
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const workspaceId = (await firstWorkspaceId(session.userId)) ?? null;
          return { data: { ...session, activeOrganizationId: workspaceId } };
        },
      },
    },
  },
  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      organizationLimit: 10,
      membershipLimit: 50,
      creatorRole: "owner",
      invitationExpiresIn: 60 * 60 * 24 * 7,
    }),
    nextCookies(),
  ],
} satisfies BetterAuthOptions;

export const auth = betterAuth(authOptions);

export { createPersonalWorkspace, firstWorkspaceId };
