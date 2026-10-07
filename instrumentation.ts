export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.OPEN_ASO_DISABLE_SCHEDULER === "1") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (!process.env.DATABASE_URL) return;
  const { startKeywordScheduler } = await import("@/lib/keywords/scheduler");
  startKeywordScheduler();
}
