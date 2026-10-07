export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (!process.env.DATABASE_URL) return;
  const { db } = await import("@/lib/server/db");
  for (let attempt = 1; ; attempt++) {
    try {
      await db.ready();
      break;
    } catch (error) {
      if (attempt >= 10) throw error;
      console.error(`Database not ready (attempt ${attempt}):`, error instanceof Error ? error.message : error);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  if (process.env.OPEN_ASO_DISABLE_SCHEDULER === "1") return;
  const { startKeywordScheduler } = await import("@/lib/keywords/scheduler");
  startKeywordScheduler();
}
