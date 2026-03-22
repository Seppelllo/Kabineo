#!/bin/bash
set -euo pipefail

# Restore from backup
BACKUP_DIR="$1"
if [ -z "$BACKUP_DIR" ]; then
    echo "Usage: ./restore.sh <backup_dir>"
    exit 1
fi

if [ ! -d "$BACKUP_DIR" ]; then
    echo "Error: Backup directory '$BACKUP_DIR' does not exist."
    exit 1
fi

echo "Restoring from $BACKUP_DIR..."

# Restore database
if [ -f "$BACKUP_DIR/database.sql" ]; then
    echo "Restoring database..."
    cat "$BACKUP_DIR/database.sql" | docker compose exec -T postgres psql -U dms dms
    echo "Database restored."
else
    echo "Warning: No database.sql found in backup."
fi

# Restore documents
if [ -d "$BACKUP_DIR/documents" ]; then
    echo "Restoring documents..."
    docker compose cp "$BACKUP_DIR/documents" api:/data/
    echo "Documents restored."
else
    echo "Warning: No documents directory found in backup."
fi

echo "Restore completed from: $BACKUP_DIR"
