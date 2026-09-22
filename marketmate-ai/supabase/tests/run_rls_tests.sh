#!/usr/bin/env bash
# Applies the migrations to a throwaway local Postgres database (with a Supabase
# stub) and runs the isolation tests. Usage: PSQL="psql -U postgres" ./run_rls_tests.sh
set -euo pipefail
cd "$(dirname "$0")"
PSQL=${PSQL:-psql}
DB=marketmate_rls_test
$PSQL -q -c "drop database if exists $DB" -c "create database $DB"
$PSQL -q -d $DB -v ON_ERROR_STOP=1 -f supabase_stub.sql
for f in ../migrations/*.sql; do $PSQL -q -d $DB -v ON_ERROR_STOP=1 -f "$f"; done
$PSQL -d $DB -v ON_ERROR_STOP=1 -f rls_isolation_test.sql
$PSQL -q -c "drop database $DB"
