import { redirect } from "next/navigation";
import LoginCard from "@/components/auth/login-card";
import { getSession } from "@/lib/server/context";
import { devLoginEnabled } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (await getSession()) redirect(safeNext);
  return <LoginCard next={safeNext} error={error ?? null} devLogin={devLoginEnabled()} />;
}
