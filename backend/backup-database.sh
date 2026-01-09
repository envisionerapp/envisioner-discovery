#!/bin/bash

# Database backup script for Mielo
# Backs up PostgreSQL database with timestamp and retention

set -e

# Configuration
BACKUP_DIR="$HOME/Mielo-DB-Backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="mielo_backup_${TIMESTAMP}.sql"
RETENTION_DAYS=30

# Load environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "🗄️  Mielo Database Backup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📅 Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo "📁 Backup directory: $BACKUP_DIR"
echo ""

# Perform backup
echo "🔄 Creating backup..."
pg_dump "$DATABASE_URL" > "$BACKUP_DIR/$BACKUP_FILE"

# Compress backup
echo "📦 Compressing backup..."
gzip "$BACKUP_DIR/$BACKUP_FILE"
COMPRESSED_FILE="${BACKUP_FILE}.gz"

# Get file size
FILE_SIZE=$(du -h "$BACKUP_DIR/$COMPRESSED_FILE" | cut -f1)

echo "✅ Backup created: $COMPRESSED_FILE (${FILE_SIZE})"
echo ""

# Clean up old backups
echo "🧹 Cleaning up old backups (older than $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -name "mielo_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete
REMAINING=$(ls -1 "$BACKUP_DIR"/mielo_backup_*.sql.gz 2>/dev/null | wc -l | tr -d ' ')

echo "📊 Total backups: $REMAINING"
echo ""

# List recent backups
echo "📋 Recent backups:"
ls -lht "$BACKUP_DIR"/mielo_backup_*.sql.gz | head -5 | awk '{print "   " $9 " (" $5 ")"}'
echo ""

echo "✅ Backup complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
