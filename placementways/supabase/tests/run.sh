#!/usr/bin/env bash
# Runs the database test-suite against a throw-away local PostgreSQL database.
#
#   ./supabase/tests/run.sh
#
# Requires a local PostgreSQL server you can connect to as a superuser.
# Point PGHOST / PGPORT / PGUSER / PGPASSWORD at a dedicated local instance.
# The suite recreates placementways_test on that instance.
set -euo pipefail
cd "$(dirname "$0")/../.."

DB=placementways_test
export PGHOST="${PGHOST:-127.0.0.1}"
case "$PGHOST" in
  localhost|127.0.0.1|::1) ;;
  *) echo "A disposable loopback PostgreSQL instance is required." >&2; exit 1 ;;
esac
unset PGHOSTADDR PGSERVICE
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
