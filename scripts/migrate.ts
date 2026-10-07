import { db, pool } from "@/lib/server/db";

db.ready()
  .then(async () => {
    const tables = await db.all<{ table_name: string }>("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
    console.log(`migrated: ${tables.map((t) => t.table_name).join(", ")}`);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool().end());
