import type { Metadata } from "next";
import InviteCard from "@/components/workspace/invite-card";
import { devLoginEnabled } from "@/lib/auth";
import { getSession } from "@/lib/server/context";
import { db } from "@/lib/server/db";
import { invitationPreview } from "@/lib/workspace/service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Join workspace · Open ASO" };

export default async function InvitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [invite, session] = await Promise.all([
    invitationPreview(id),
    getSession(),
  ]);
  const alreadyMember =
    !!invite &&
    !!session &&
    !!(await db.get(
      `SELECT 1 FROM "member" WHERE "organizationId" = ? AND "userId" = ?`,
      [invite.organizationId, session.user.id],
    ));
  return (
    <InviteCard
      invite={
        invite && {
          id: invite.id,
          email: invite.email,
          role: invite.role,
          state: invite.state,
          workspaceId: invite.organizationId,
          workspaceName: invite.workspaceName,
          inviterName: invite.inviterName,
          inviterEmail: invite.inviterEmail,
        }
      }
      viewer={
        session ? { email: session.user.email, name: session.user.name } : null
      }
      alreadyMember={alreadyMember}
      devLogin={devLoginEnabled()}
    />
  );
}
