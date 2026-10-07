import fs from "node:fs";
import { parseArgs } from "node:util";
import { exportWorkspace } from "@/lib/integrations/data";
import { db, pool } from "@/lib/server/db";

const { values } = parseArgs({ options: { email: { type: "string" }, out: { type: "string" } } });

async function main() {
  if (!values.email || !values.out) throw new Error("Usage: scripts/export-workspace.ts --email <user> --out <file.json>");
  const row = await db.get<{ organizationId: string }>(
    `SELECT m."organizationId" FROM "member" m JOIN "user" u ON u."id" = m."userId" WHERE lower(u."email") = lower(?) ORDER BY m."createdAt" ASC LIMIT 1`,
    [values.email],
  );
  if (!row) throw new Error(`No workspace for ${values.email}`);
  const data = await exportWorkspace(row.organizationId);
  fs.writeFileSync(values.out, JSON.stringify(data, null, 2));
  console.log(`Exported workspace ${row.organizationId} to ${values.out}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool().end());
