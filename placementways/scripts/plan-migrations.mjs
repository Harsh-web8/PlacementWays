import { readFile } from "node:fs/promises";
import { migrationPlan, verifyLinkedStagingDatabase } from "./lib/staging-migrations.mjs";

try {
  const flags = process.argv.slice(2);
  if (flags.some(flag => flag !== "--verify-staging-link")) throw new Error("Only --verify-staging-link is supported.");
  if (flags.includes("--verify-staging-link")) {
    const linkedRef = await readFile(new URL("../supabase/.temp/project-ref", import.meta.url), "utf8")
      .catch(() => { throw new Error("Link the Supabase CLI to the confirmed staging project first."); });
    const ref = verifyLinkedStagingDatabase(process.env, linkedRef);
    console.log(`Local link and API URL match staging project ref ${ref}.`);
  }
  const migrations = await migrationPlan(new URL("../supabase/migrations/", import.meta.url));
  for (const migration of migrations) console.log(`${migration.sha256}  ${migration.file}`);
  console.log(`Planned migration files: ${migrations.length}. SHA-256 uses LF line endings. This was a local file check.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
