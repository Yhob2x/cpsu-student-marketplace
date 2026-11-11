#!/usr/bin/env bash
# Backs up BOTH the database and uploaded photos. Run nightly from cron, then test a restore.
set -euo pipefail
DEST=${DEST:-/var/backups/cpsu-marketplace}; STAMP=$(date +%F-%H%M)
mkdir -p "$DEST"
mysqldump --single-transaction --routines "$DB_NAME" | gzip > "$DEST/db-$STAMP.sql.gz"
tar -czf "$DEST/media-$STAMP.tar.gz" -C "$(dirname "$UPLOAD_DIR")" "$(basename "$UPLOAD_DIR")"
find "$DEST" -type f -mtime +30 -delete
echo "Backup written to $DEST ($STAMP)"
