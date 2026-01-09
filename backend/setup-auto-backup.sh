#!/bin/bash

# Setup automatic database backups using cron
# Runs daily at 2 AM

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKUP_SCRIPT="$SCRIPT_DIR/backup-database.sh"

echo "⚙️  Setting up automatic database backups"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Make backup script executable
chmod +x "$BACKUP_SCRIPT"
echo "✅ Made backup script executable"

# Check if cron job already exists
CRON_JOB="0 2 * * * cd $SCRIPT_DIR && ./backup-database.sh >> $HOME/Mielo-DB-Backups/backup.log 2>&1"

if crontab -l 2>/dev/null | grep -q "backup-database.sh"; then
  echo "⚠️  Cron job already exists"
  echo ""
  echo "Current cron jobs for database backup:"
  crontab -l | grep "backup-database.sh"
else
  # Add cron job
  (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
  echo "✅ Added cron job for daily backups at 2 AM"
fi

echo ""
echo "📅 Backup schedule: Daily at 2:00 AM"
echo "📁 Backup location: $HOME/Mielo-DB-Backups/"
echo "📝 Log file: $HOME/Mielo-DB-Backups/backup.log"
echo "🗑️  Retention: 30 days"
echo ""

# Create initial backup
echo "Creating initial backup..."
"$BACKUP_SCRIPT"

echo ""
echo "✅ Setup complete!"
echo ""
echo "Commands:"
echo "  • Manual backup:  ./backup-database.sh"
echo "  • Restore backup: ./restore-database.sh"
echo "  • View schedule:  crontab -l | grep backup"
echo "  • Remove auto-backup: crontab -e  (then delete the line)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
