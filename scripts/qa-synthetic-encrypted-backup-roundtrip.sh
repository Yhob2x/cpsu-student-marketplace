#!/usr/bin/env bash
# Opt-in, synthetic-only encrypted-archive round trip for Linux staging.
# NEVER reads the real MariaDB instance, upload directory, .env, or backup destination.
set -euo pipefail
umask 077

if [[ "$#" -ne 1 || "$1" != "--run-synthetic-only" ]]; then
  printf '%s\n' "PREVIEW: synthetic age-encrypted SQL+media round trip only." \
    "To execute on an isolated Linux QA host with age installed:" \
    "  bash scripts/qa-synthetic-encrypted-backup-roundtrip.sh --run-synthetic-only" \
    "No MariaDB connection, existing archives, or production files are used."
  exit 0
fi

for command_name in age age-keygen gzip tar mktemp cmp; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'BLOCKED: required QA utility not installed: %s\n' "$command_name" >&2
    exit 1
  fi
done

WORK="$(mktemp -d "${TMPDIR:-/tmp}/cpsu-synthetic-age-XXXXXXXX")"
if [[ ! -d "$WORK" || "$WORK" != *"/cpsu-synthetic-age-"* ]]; then
  printf '%s\n' 'BLOCKED: unsafe temporary workspace' >&2
  exit 1
fi
trap 'rm -rf -- "$WORK"' EXIT
mkdir -p "$WORK/source/uploads" "$WORK/encrypted" "$WORK/restored"
chmod 0700 "$WORK" "$WORK/source" "$WORK/encrypted" "$WORK/restored"

# Completely artificial database fixture (not a dump from any real DB).
printf '%s\n' \
  'CREATE TABLE synthetic_restore_probe (id INT PRIMARY KEY, label VARCHAR(64));' \
  "INSERT INTO synthetic_restore_probe (id,label) VALUES (1,'cpsu-qa-only');" \
  > "$WORK/source/synthetic.sql"
printf '%s\n' 'Synthetic media bytes: QA only, not a real student upload.' \
  > "$WORK/source/uploads/README.txt"

# Disposable recovery identity, created only inside the disposable private QA directory.
age-keygen -o "$WORK/qa-identity.txt" >/dev/null 2>&1
RECIPIENT="$(age-keygen -y "$WORK/qa-identity.txt")"

# Mirrors the two encrypted formats produced by infrastructure/backup/backup.sh.
gzip -c "$WORK/source/synthetic.sql" \
  | age -r "$RECIPIENT" > "$WORK/encrypted/db-synthetic.sql.gz.age"
tar -czf - -C "$WORK/source" uploads \
  | age -r "$RECIPIENT" > "$WORK/encrypted/media-synthetic.tar.gz.age"

# Restore bytes to a brand-new, temp-only directory.
age -d -i "$WORK/qa-identity.txt" "$WORK/encrypted/db-synthetic.sql.gz.age" \
  | gzip -dc > "$WORK/restored/synthetic.sql"
# Only the script-created archive is ever extracted, never third-party content.
age -d -i "$WORK/qa-identity.txt" "$WORK/encrypted/media-synthetic.tar.gz.age" \
  | tar -xzf - -C "$WORK/restored"

cmp "$WORK/source/synthetic.sql" "$WORK/restored/synthetic.sql"
cmp "$WORK/source/uploads/README.txt" "$WORK/restored/uploads/README.txt"

printf '%s\n' \
  'PASS: synthetic SQL + media age encryption, decryption, extraction and byte equality.' \
  'No MariaDB schema was created, modified, imported or dropped.' \
  'No existing backup, real uploaded photo, production key or student record was touched.' \
  'Separate approved disposable-MySQL import rehearsal is still required.'
