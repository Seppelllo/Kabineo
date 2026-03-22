#!/bin/bash
set -euo pipefail

# Backup database and document storage
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups/$DATE"
mkdir -p "$BACKUP_DIR"

echo "Starting backup to $BACKUP_DIR..."

# Dump PostgreSQL
echo "Dumping database..."
docker compose exec -T postgres pg_dump -U dms dms > "$BACKUP_DIR/database.sql"
echo "Database dump complete."

# Copy document storage
echo "Copying document storage..."
docker compose cp api:/data/documents "$BACKUP_DIR/documents"
echo "Document storage copied."

echo "Backup completed: $BACKUP_DIR"
