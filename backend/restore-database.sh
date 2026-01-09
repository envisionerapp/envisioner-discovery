#!/bin/bash

# Database restore script for Mielo
# Restores PostgreSQL database from backup

set -e

BACKUP_DIR="$HOME/Mielo-DB-Backups"

# Load environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

echo "🔄 Mielo Database Restore"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
  echo "❌ Error: Backup directory not found: $BACKUP_DIR"
  exit 1
fi

# List available backups
echo "📋 Available backups:"
echo ""
BACKUPS=($(ls -1t "$BACKUP_DIR"/mielo_backup_*.sql.gz 2>/dev/null))

if [ ${#BACKUPS[@]} -eq 0 ]; then
  echo "❌ No backups found in $BACKUP_DIR"
  exit 1
fi

# Display backups with numbers
for i in "${!BACKUPS[@]}"; do
  BACKUP_FILE="${BACKUPS[$i]}"
  FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  FILE_DATE=$(echo "$BACKUP_FILE" | grep -oE '[0-9]{8}_[0-9]{6}' | sed 's/_/ /')
  echo "   [$((i+1))] $(basename "$BACKUP_FILE") (${FILE_SIZE}) - $FILE_DATE"
done

echo ""
read -p "Enter backup number to restore (1-${#BACKUPS[@]}) or 'q' to quit: " choice

if [ "$choice" = "q" ] || [ "$choice" = "Q" ]; then
  echo "Cancelled."
  exit 0
fi

# Validate choice
if ! [[ "$choice" =~ ^[0-9]+$ ]] || [ "$choice" -lt 1 ] || [ "$choice" -gt ${#BACKUPS[@]} ]; then
  echo "❌ Invalid choice"
  exit 1
fi

SELECTED_BACKUP="${BACKUPS[$((choice-1))]}"

echo ""
echo "⚠️  WARNING: This will replace the current database!"
echo "   Selected backup: $(basename "$SELECTED_BACKUP")"
echo ""
read -p "Are you sure? Type 'yes' to continue: " confirm

if [ "$confirm" != "yes" ]; then
  echo "Cancelled."
  exit 0
fi

echo ""
echo "🔄 Restoring database..."

# Decompress and restore
gunzip -c "$SELECTED_BACKUP" | psql "$DATABASE_URL"

echo ""
echo "✅ Database restored successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
