#!/usr/bin/env bash
# Runs the database test-suite against a throw-away local PostgreSQL database.
#
#   ./supabase/tests/run.sh
#
# Requires a local PostgreSQL server you can connect to as a superuser.
# Override the connection with PGHOST / PGPORT / PGUSER / PGPASSWORD.
# This NEVER touches Supabase: it creates (and drops) a database named
# placementways_test on the server you point it at.
set -euo pipefail
cd "$(dirname "$0")/../.."

DB=placementways_test
PSQL="psql -X -q -v ON_ERROR_STOP=1"

$PSQL -d postgres -c "drop database if exists $DB" -c "create database $DB"

echo "==> stub (auth schema, roles, helpers)"
$PSQL -d $DB -f supabase/tests/00_supabase_stub.sql

for f in supabase/migrations/*.sql; do
  echo "==> migration $(basename "$f")"
  $PSQL -d $DB -f "$f"
done

echo "==> seed (run twice to prove idempotency)"
$PSQL -d $DB -f supabase/seed.sql
$PSQL -d $DB -f supabase/seed.sql

for f in supabase/tests/*.test.sql; do
  echo "==> test $(basename "$f")"
  $PSQL -d $DB -f "$f" 2>&1 | grep -v '^$' || { echo "TEST FILE FAILED: $f"; exit 1; }
done

echo
echo "All database tests passed."
