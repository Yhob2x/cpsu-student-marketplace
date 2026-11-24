#!/usr/bin/env bash
# Backs up BOTH the database and uploaded photos. Run nightly from cron, then test a restore.
set -euo pipefail
umask 077
: "${DB_NAME:?DB_NAME is required}"
: "${UPLOAD_DIR:?UPLOAD_DIR is required}"
: "${BACKUP_RECIPIENT:?An age encryption recipient is required}"
command -v age >/dev/null || { echo 'age is required for encrypted backups' >&2; exit 1; }
DEST=${DEST:-/var/backups/cpsu-marketplace}; STAMP=$(date +%F-%H%M)
install -d -m 0700 "$DEST"
DB_TMP=$(mktemp "$DEST/.db-$STAMP.XXXXXX")
MEDIA_TMP=$(mktemp "$DEST/.media-$STAMP.XXXXXX")
trap 'rm -f "$DB_TMP" "$MEDIA_TMP"' EXIT
mysqldump --single-transaction --routines "$DB_NAME" | gzip | age -r "$BACKUP_RECIPIENT" > "$DB_TMP"
tar -czf - -C "$(dirname "$UPLOAD_DIR")" "$(basename "$UPLOAD_DIR")" | age -r "$BACKUP_RECIPIENT" > "$MEDIA_TMP"
mv "$DB_TMP" "$DEST/db-$STAMP.sql.gz.age"
mv "$MEDIA_TMP" "$DEST/media-$STAMP.tar.gz.age"
find "$DEST" -maxdepth 1 -type f \( -name 'db-*.sql.gz.age' -o -name 'media-*.tar.gz.age' \) -mtime +30 -delete
echo "Backup written to $DEST ($STAMP)"
