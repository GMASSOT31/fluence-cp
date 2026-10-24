#!/bin/sh
# Essaie la migration du labo sur un PostgreSQL LOCAL jetable (jamais sur Supabase). Usage : sh tools/sql/run_labo_tests.sh
# Demande les binaires PostgreSQL (/usr/lib/postgresql/*/bin) et l'utilisateur système « postgres ».
set -e
cd "$(dirname "$0")"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1); D=/var/tmp/pg_labo_test; P=5544
su postgres -c "$BIN/pg_ctl -D $D stop -m immediate" >/dev/null 2>&1 || true
rm -rf $D; mkdir -p $D; chown postgres $D
su postgres -c "$BIN/initdb -D $D -A trust" >/dev/null
su postgres -c "$BIN/pg_ctl -D $D -o '-p $P -k /tmp' -l $D/log -w start" >/dev/null
trap 'su postgres -c "$BIN/pg_ctl -D $D stop -m immediate" >/dev/null 2>&1 || true' EXIT
PSQL="su postgres -c \"cd $(pwd) && $BIN/psql -h /tmp -p $P -d postgres -v ON_ERROR_STOP=1 -q"
su postgres -c "cd $(pwd) && $BIN/psql -h /tmp -p $P -d postgres -v ON_ERROR_STOP=1 -q -f stub_schema.sql"
su postgres -c "cd $(pwd) && $BIN/psql -h /tmp -p $P -d postgres -v ON_ERROR_STOP=1 -q -f test_labo.sql" 2>&1
echo "=== TOUS LES CONTROLES SQL PASSENT ==="
