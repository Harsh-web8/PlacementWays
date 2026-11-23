import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";

export async function migrationPlan(directory) {
  const files = (await readdir(directory, { withFileTypes: true }))
    .filter(entry => entry.isFile() && entry.name.endsWith(".sql"))
    .map(entry => entry.name)
    .sort();
  const ids = new Set();
  if (!files.length) throw new Error("No migrations found.");
  return Promise.all(files.map(async (file) => {
    const id = /^(\d{14})_[a-z0-9_]+\.sql$/.exec(file)?.[1];
    if (!id || ids.has(id)) throw new Error(`Invalid or duplicate migration version in ${file}.`);
    ids.add(id);
    const sql = await readFile(new URL(file, directory), "utf8");
    return { file, sha256: createHash("sha256").update(sql.replace(/\r\n/g, "\n")).digest("hex") };
  }));
}

export function stagingDatabaseRef(env) {
  if (env.DEPLOYMENT_ENV !== "staging" || env.STAGING_DB_ISOLATED !== "true") {
    throw new Error("Set DEPLOYMENT_ENV=staging and confirm STAGING_DB_ISOLATED=true.");
  }
  const ref = env.STAGING_SUPABASE_PROJECT_REF;
  if (!/^[a-z0-9]{20}$/.test(ref ?? "")) throw new Error("Set the project ref for the confirmed placementways-staging project.");
  const expected = `https://${ref}.supabase.co`;
  if (![expected, `${expected}/`].includes(env.NEXT_PUBLIC_SUPABASE_URL)) {
    throw new Error("The Supabase API URL differs from the intended staging project.");
  }
  if (env.SUPABASE_PROJECT_ID && env.SUPABASE_PROJECT_ID !== ref) {
    throw new Error("SUPABASE_PROJECT_ID would select a different project.");
  }
  return ref;
}

export function verifyLinkedStagingDatabase(env, linkedRef) {
  const ref = stagingDatabaseRef(env);
  if (linkedRef?.trim() !== ref) throw new Error("The Supabase CLI link differs from the intended staging project.");
  return ref;
}
