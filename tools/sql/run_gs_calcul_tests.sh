#!/bin/sh
# Essaie la migration 20261209 (GS Calcul) sur un PostgreSQL LOCAL jetable (jamais sur Supabase). Usage : sh tools/sql/run_gs_calcul_tests.sh
set -e
cd "$(dirname "$0")"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1); D=/var/tmp/pg_gs_test; P=5545
su postgres -c "$BIN/pg_ctl -D $D stop -m immediate" >/dev/null 2>&1 || true
rm -rf $D; mkdir -p $D; chown postgres $D
su postgres -c "$BIN/initdb -D $D -A trust" >/dev/null
su postgres -c "$BIN/pg_ctl -D $D -o '-p $P -k /tmp' -l $D/log -w start" >/dev/null
trap 'su postgres -c "$BIN/pg_ctl -D $D stop -m immediate" >/dev/null 2>&1 || true' EXIT
su postgres -c "cd $(pwd) && $BIN/psql -h /tmp -p $P -d postgres -v ON_ERROR_STOP=1 -q -f test_gs_calcul.sql" 2>&1 | sed "s/^psql:[^ ]* NOTICE:  //"
