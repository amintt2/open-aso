"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import Button from "@/components/_ui/button";
import { authClient } from "@/lib/auth-client";

function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-4">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3 14.7 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.7H12z" />
    </svg>
  );
}

const ERRORS: Record<string, string> = {
  signup_disabled: "Sign-ups are closed right now. Ask for an invitation.",
  unable_to_create_user: "Sign-ups are closed right now. Ask for an invitation.",
};

export default function LoginCard({ next, error, devLogin }: { next: string; error: string | null; devLogin: boolean }) {
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<string | null>(error ? (ERRORS[error] ?? "Sign-in failed. Please try again.") : null);

  async function signIn() {
    setLoading(true);
    setFailure(null);
    const res = await authClient.signIn.social({ provider: "google", callbackURL: next, errorCallbackURL: "/login" });
    if (res.error) {
      setFailure(res.error.message ?? "Sign-in failed. Please try again.");
      setLoading(false);
    }
  }

  async function devSignIn(form: FormData) {
    setLoading(true);
    setFailure(null);
    const email = String(form.get("email") ?? "");
    const password = "open-aso-dev-password";
    const signedIn = await authClient.signIn.email({ email, password });
    if (signedIn.error) {
      const created = await authClient.signUp.email({ email, password, name: email.split("@")[0] });
      if (created.error) {
        setFailure(created.error.message ?? "Dev sign-in failed");
        setLoading(false);
        return;
      }
    }
    window.location.href = next;
  }

  return (
    <div className="border-line-strong bg-card shadow-overlay flex w-full max-w-[380px] flex-col items-center gap-6 rounded-2xl border px-6 py-8 text-center">
      <span className="bg-primary flex size-11 items-center justify-center rounded-xl shadow-[inset_0px_1px_0px_rgba(255,255,255,0.2)]">
        <Sparkles aria-hidden className="size-5 text-white" />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="text-[20px]">Open ASO</h1>
        <p className="text-subtle">Keyword research, rank tracking, App Store Connect and Apple Ads for your apps.</p>
      </div>
      <Button variant="secondary" size="md" className="h-10 w-full" onClick={() => void signIn()} disabled={loading}>
        {loading ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <GoogleMark />}
        Continue with Google
      </Button>
      {devLogin && (
        <form action={devSignIn} className="border-border flex w-full flex-col gap-2 border-t pt-5">
          <span className="eyebrow-style text-faint">Dev login</span>
          <input name="email" type="email" required placeholder="dev@example.com" className="border-line-strong bg-secondary h-9 rounded-lg border px-3 text-[14px]" />
          <Button type="submit" variant="muted" size="md" disabled={loading}>
            Sign in (dev only)
          </Button>
        </form>
      )}
      {failure && (
        <p role="alert" className="caption-style text-danger">
          {failure}
        </p>
      )}
      <p className="caption-style text-subtle">By continuing you agree to keep your App Store credentials yours — they are encrypted at rest and only used for your workspace.</p>
    </div>
  );
}
