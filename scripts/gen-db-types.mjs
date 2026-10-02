#!/usr/bin/env node
// Generates src/types/database.ts from a migrated PostgreSQL database, in the
// same shape as `supabase gen types typescript`, so the typed Supabase client
// knows every table, column, enum and relationship.
//
//   npm run db:test:setup   # (once) builds the local test DB from migrations
//   npm run db:types
//
// Once you use the Supabase CLI, you can swap this for the official command:
//   npx supabase gen types typescript --local > src/types/database.ts
// The output is intentionally compatible.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../src/types/database.ts");
const connectionString =
  process.env.DATABASE_URL ?? "postgresql://postgres@localhost:5432/placementways_test";

const client = new pg.Client({ connectionString });
await client.connect();

const q = async (sql, params = []) => (await client.query(sql, params)).rows;

const enums = await q(`
  select t.typname as name, array_agg(e.enumlabel::text order by e.enumsortorder) as labels
  from pg_type t
  join pg_enum e on e.enumtypid = t.oid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
  group by t.typname order by t.typname`);

const relations = await q(`
  select c.relname as name, c.relkind as kind
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'v')
  order by c.relname`);

const columns = await q(`
  select table_name, column_name, data_type, udt_name, is_nullable,
         column_default, is_identity, is_generated
  from information_schema.columns
  where table_schema = 'public'
  order by table_name, ordinal_position`);

const fks = await q(`
  select con.conname as name,
         src.relname as source,
         (select array_agg(a.attname::text order by k.ord)
            from unnest(con.conkey) with ordinality as k(attnum, ord)
            join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum) as columns,
         tgt.relname as target,
         (select array_agg(a.attname::text order by k.ord)
            from unnest(con.confkey) with ordinality as k(attnum, ord)
            join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.attnum) as ref_columns,
         con.conkey as conkey, con.conrelid as conrelid
  from pg_constraint con
  join pg_class src on src.oid = con.conrelid
  join pg_namespace sn on sn.oid = src.relnamespace
  join pg_class tgt on tgt.oid = con.confrelid
  join pg_namespace tn on tn.oid = tgt.relnamespace
  where con.contype = 'f' and sn.nspname = 'public' and tn.nspname = 'public'
  order by src.relname, con.conname`);

// Unique (non-partial) column sets per table => one-to-one detection.
const uniques = await q(`
  select c.relname as table_name,
         (select array_agg(a.attname::text order by a.attname::text)
            from unnest(i.indkey) as k(attnum)
            join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum) as cols
  from pg_index i
  join pg_class c on c.oid = i.indrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and i.indisunique and i.indpred is null`);

const functions = await q(`
  select p.proname as name, p.pronargs as nargs, p.pronargdefaults as defaults,
         pg_get_function_result(p.oid) as returns,
         p.proname || '_' || p.oid as specific_name
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
    and pg_get_function_result(p.oid) <> 'trigger'
  order by p.proname`);

// IN parameters for functions that take arguments (e.g. RPCs called from the
// admin dashboard), keyed by the same "name_oid" specific_name as above so a
// function can be matched to its argument list without re-resolving the oid.
const parameters = await q(`
  select specific_name, parameter_name, data_type, udt_name, ordinal_position
  from information_schema.parameters
  where specific_schema = 'public' and parameter_mode = 'IN'
  order by specific_name, ordinal_position`);

await client.end();

const enumNames = new Set(enums.map((e) => e.name));

function baseTsType(col) {
  const udt = col.udt_name.startsWith("_") ? col.udt_name.slice(1) : col.udt_name;
  const isArray = col.data_type === "ARRAY";
  let ts;
  if (enumNames.has(udt)) ts = `Database["public"]["Enums"]["${udt}"]`;
  else if (["uuid", "text", "varchar", "bpchar", "citext", "date", "timestamp", "timestamptz", "time"].includes(udt)) ts = "string";
  else if (["int2", "int4", "int8", "float4", "float8", "numeric"].includes(udt)) ts = "number";
  else if (udt === "bool") ts = "boolean";
  else if (["json", "jsonb"].includes(udt)) ts = "Json";
  else ts = "unknown";
  return isArray ? `${ts}[]` : ts;
}

const byTable = new Map();
for (const c of columns) {
  if (!byTable.has(c.table_name)) byTable.set(c.table_name, []);
  byTable.get(c.table_name).push(c);
}

const uniqueByTable = new Map();
for (const u of uniques) {
  if (!u.cols) continue; // expression index (e.g. lower(name)) -- not a plain column set
  if (!uniqueByTable.has(u.table_name)) uniqueByTable.set(u.table_name, []);
  uniqueByTable.get(u.table_name).push(u.cols.join(","));
}

function relationshipsFor(table) {
  return fks
    .filter((f) => f.source === table)
    .map((f) => {
      const isOne = (uniqueByTable.get(table) ?? []).includes([...f.columns].sort().join(","));
      return `        {
          foreignKeyName: "${f.name}"
          columns: [${f.columns.map((c) => `"${c}"`).join(", ")}]
          isOneToOne: ${isOne}
          referencedRelation: "${f.target}"
          referencedColumns: [${f.ref_columns.map((c) => `"${c}"`).join(", ")}]
        }`;
    });
}

function block(cols, fn) {
  return cols.map(fn).join("\n");
}

let tables = "";
let views = "";
for (const rel of relations) {
  const cols = byTable.get(rel.name) ?? [];
  const nullable = (c) => c.is_nullable === "YES";
  const row = block(cols, (c) => `          ${c.column_name}: ${baseTsType(c)}${nullable(c) ? " | null" : ""}`);
  if (rel.kind === "r") {
    const optionalOnInsert = (c) => nullable(c) || c.column_default !== null || c.is_identity === "YES" || c.is_generated !== "NEVER";
    const insert = block(cols, (c) => `          ${c.column_name}${optionalOnInsert(c) ? "?" : ""}: ${baseTsType(c)}${nullable(c) ? " | null" : ""}`);
    const update = block(cols, (c) => `          ${c.column_name}?: ${baseTsType(c)}${nullable(c) ? " | null" : ""}`);
    const rels = relationshipsFor(rel.name);
    tables += `      ${rel.name}: {
        Row: {
${row}
        }
        Insert: {
${insert}
        }
        Update: {
${update}
        }
        Relationships: [${rels.length ? "\n" + rels.join(",\n") + "\n      " : ""}]
      }
`;
  } else {
    views += `      ${rel.name}: {
        Row: {
${row}
        }
        Relationships: []
      }
`;
  }
}

const paramsByFn = new Map();
for (const p of parameters) {
  if (!paramsByFn.has(p.specific_name)) paramsByFn.set(p.specific_name, []);
  paramsByFn.get(p.specific_name).push(p);
}

function fnReturnType(returns) {
  if (returns.startsWith("SETOF ")) {
    const inner = fnReturnType(returns.slice("SETOF ".length));
    return inner === "unknown" ? "unknown[]" : `${inner}[]`;
  }
  switch (returns) {
    case "boolean":
      return "boolean";
    case "void":
      return "undefined";
    case "uuid":
    case "text":
    case "character varying":
      return "string";
    case "integer":
    case "bigint":
    case "smallint":
    case "numeric":
    case "real":
    case "double precision":
      return "number";
    case "jsonb":
    case "json":
      return "Json";
    default:
      return "unknown";
  }
}

const fnBlock = functions
  .map((f) => {
    const params = paramsByFn.get(f.specific_name) ?? [];
    const args = params.length
      ? `{\n${block(params, (p) => `          ${p.parameter_name}${p.ordinal_position > f.nargs - f.defaults ? "?" : ""}: ${baseTsType(p)} | null`)}\n        }`
      : "Record<PropertyKey, never>";
    return `      ${f.name}: {
        Args: ${args}
        Returns: ${fnReturnType(f.returns)}
      }`;
  })
  .join("\n");

const enumBlock = enums
  .map((e) => `      ${e.name}: ${e.labels.map((l) => `"${l}"`).join(" | ")}`)
  .join("\n");

const file = `// AUTO-GENERATED by scripts/gen-db-types.mjs -- DO NOT EDIT BY HAND.
// Regenerate after every migration:  npm run db:types

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
${tables.trimEnd()}
    }
    Views: {
${views.trimEnd()}
    }
    Functions: {
${fnBlock}
    }
    Enums: {
${enumBlock}
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]
`;

writeFileSync(out, file);
console.log(`Wrote ${out} (${relations.length} relations, ${enums.length} enums)`);
