"use client";

import { reloadTo } from "@/lib/workspace/navigate";
import { useState } from "react";
import { Loader2, MailX, Users } from "lucide-react";
import Button from "@/components/_ui/button";
import { Input } from "@/components/_ui/input";
import { WorkspaceMark } from "@/components/shell/user-avatar";
import { api } from "@/lib/client/api";
import { authClient } from "@/lib/auth-client";
import { ROLE_LABEL, type WorkspaceRole } from "@/lib/workspace/types";

type Invite = {
  id: string;
  email: string;
  role: WorkspaceRole;
  state: string;
  workspaceId: string;
  workspaceName: string;
  inviterName: string;
  inviterEmail: string;
};

const DEV_PASSWORD = "open-aso-dev-password";

function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-4">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3 14.7 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.7H12z"
      />
    </svg>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-line-strong bg-card shadow-overlay flex w-full max-w-[400px] flex-col items-center gap-6 rounded-2xl border px-6 py-8 text-center">
      {children}
    </div>
  );
}

const STATE_COPY: Record<string, string> = {
  accepted: "This invitation has already been accepted.",
  rejected: "This invitation was declined.",
  canceled: "This invitation was cancelled by the workspace.",
  expired: "This invitation has expired. Ask for a new link.",
};

export default function InviteCard({
  invite,
  viewer,
  alreadyMember,
  devLogin,
}: {
  invite: Invite | null;
  viewer: { email: string; name: string } | null;
  alreadyMember: boolean;
  devLogin: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  if (!invite || invite.state !== "pending")
    return (
      <Shell>
        <span className="bg-secondary flex size-11 items-center justify-center rounded-xl">
          <MailX aria-hidden className="text-subtle size-5" />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="text-[20px]">
            {invite ? `Join ${invite.workspaceName}` : "Invitation not found"}
          </h1>
          <p className="text-subtle">
            {invite
              ? (STATE_COPY[invite.state] ??
                "This invitation is no longer valid.")
              : "The link may be mistyped, or the invitation was removed."}
          </p>
        </div>
        <Button variant="secondary" size="md" href="/">
          Go to Open ASO
        </Button>
      </Shell>
    );

  const here = `/invite/${invite.id}`;
  const matches =
    viewer && viewer.email.toLowerCase() === invite.email.toLowerCase();

  async function act(kind: string, fn: () => Promise<void>) {
    setBusy(kind);
    setFailure(null);
    try {
      await fn();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Something went wrong");
      setBusy(null);
    }
  }

  const google = () =>
    act("google", async () => {
      const res = await authClient.signIn.social({
        provider: "google",
        callbackURL: here,
        errorCallbackURL: here,
      });
      if (res.error) throw new Error(res.error.message ?? "Sign-in failed");
    });

  const devSignIn = (form: FormData) =>
    act("dev", async () => {
      const email = String(form.get("email") ?? "");
      const signedIn = await authClient.signIn.email({
        email,
        password: DEV_PASSWORD,
      });
      if (signedIn.error) {
        const created = await authClient.signUp.email({
          email,
          password: DEV_PASSWORD,
          name: email.split("@")[0],
        });
        if (created.error)
          throw new Error(created.error.message ?? "Dev sign-in failed");
      }
      reloadTo(here);
    });

  const accept = () =>
    act("accept", async () => {
      await api(`/api/workspace/invitations/${invite.id}/accept`, {
        method: "POST",
      });
      reloadTo("/");
    });

  const decline = () =>
    act("decline", async () => {
      await api(`/api/workspace/invitations/${invite.id}/decline`, {
        method: "POST",
      });
      reloadTo("/");
    });

  const open = () =>
    act("open", async () => {
      const res = await authClient.organization.setActive({
        organizationId: invite.workspaceId,
      });
      if (res.error)
        throw new Error(res.error.message ?? "Could not open the workspace");
      reloadTo("/");
    });

  const signOut = () =>
    act("signout", async () => {
      await authClient.signOut();
      reloadTo(here);
    });

  return (
    <Shell>
      <WorkspaceMark
        name={invite.workspaceName}
        className="size-11 rounded-xl text-[18px]"
      />
      <div className="flex flex-col gap-2">
        <span className="eyebrow-style text-faint">Workspace invitation</span>
        <h1 className="text-[20px] text-balance">
          Join {invite.workspaceName}
        </h1>
        <p className="text-subtle text-pretty">
          {invite.inviterName || invite.inviterEmail} invited{" "}
          <span className="text-foreground">{invite.email}</span> to collaborate
          as {ROLE_LABEL[invite.role].toLowerCase()}.
        </p>
      </div>

      {!viewer && (
        <>
          <Button
            variant="secondary"
            size="md"
            className="h-10 w-full"
            onClick={() => void google()}
            disabled={!!busy}
          >
            {busy === "google" ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <GoogleMark />
            )}
            Continue with Google
          </Button>
          <p className="caption-style text-subtle">
            Sign in with {invite.email} to accept.
          </p>
          {devLogin && (
            <form
              action={devSignIn}
              className="border-border flex w-full flex-col gap-2 border-t pt-5"
            >
              <span className="eyebrow-style text-faint">Dev login</span>
              <Input
                name="email"
                type="email"
                required
                defaultValue={invite.email}
                aria-label="E-mail"
              />
              <Button type="submit" variant="muted" size="md" disabled={!!busy}>
                {busy === "dev" && (
                  <Loader2 aria-hidden className="size-3.5 animate-spin" />
                )}
                Sign in (dev only)
              </Button>
            </form>
          )}
        </>
      )}

      {viewer && alreadyMember && (
        <>
          <p className="text-subtle">
            You&apos;re already a member of this workspace.
          </p>
          <Button
            variant="primary"
            size="md"
            className="h-10 w-full"
            onClick={() => void open()}
            disabled={!!busy}
          >
            {busy === "open" ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <Users aria-hidden className="size-4" />
            )}
            Open workspace
          </Button>
        </>
      )}

      {viewer && !alreadyMember && matches && (
        <div className="flex w-full flex-col gap-2">
          <Button
            variant="primary"
            size="md"
            className="h-10 w-full"
            onClick={() => void accept()}
            disabled={!!busy}
          >
            {busy === "accept" ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <Users aria-hidden className="size-4" />
            )}
            Accept and join
          </Button>
          <Button
            variant="ghost"
            size="md"
            className="h-10 w-full"
            onClick={() => void decline()}
            disabled={!!busy}
          >
            {busy === "decline" && (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            )}
            Decline
          </Button>
          <p className="caption-style text-subtle">
            Signed in as {viewer.email}
          </p>
        </div>
      )}

      {viewer && !alreadyMember && !matches && (
        <div className="flex w-full flex-col gap-3">
          <p className="text-subtle text-pretty">
            You&apos;re signed in as{" "}
            <span className="text-foreground">{viewer.email}</span>, but this
            invitation is for{" "}
            <span className="text-foreground">{invite.email}</span>.
          </p>
          <Button
            variant="secondary"
            size="md"
            className="h-10 w-full"
            onClick={() => void signOut()}
            disabled={!!busy}
          >
            {busy === "signout" && (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            )}
            Sign out and switch account
          </Button>
          <Button variant="ghost" size="md" href="/">
            Back to my workspace
          </Button>
        </div>
      )}

      {failure && (
        <p role="alert" className="caption-style text-danger">
          {failure}
        </p>
      )}
    </Shell>
  );
}
