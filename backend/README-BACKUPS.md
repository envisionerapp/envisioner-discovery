# Database Backup System

Automatic and manual database backup system for Mielo.

## Features

- ✅ **Automatic daily backups** at 2 AM
- ✅ **30-day retention** (old backups automatically deleted)
- ✅ **Compressed backups** (gzip) to save space
- ✅ **Safe storage** in `~/Mielo-DB-Backups/`
- ✅ **Easy restore** with interactive menu
- ✅ **Backup logs** for monitoring

## Setup (One-Time)

Run this once to set up automatic daily backups:

```bash
./setup-auto-backup.sh
```

This will:
1. Make scripts executable
2. Add a cron job for daily backups at 2 AM
3. Create an initial backup
4. Set up the backup directory

## Manual Commands

### Create a backup now
```bash
./backup-database.sh
```

### Restore from backup
```bash
./restore-database.sh
```

This will show you a list of available backups to choose from.

### View backup schedule
```bash
crontab -l | grep backup
```

### Remove automatic backups
```bash
crontab -e
# Delete the line containing "backup-database.sh"
```

## Backup Location

All backups are stored in:
```
~/Mielo-DB-Backups/
```

Backup files are named:
```
mielo_backup_YYYYMMDD_HHMMSS.sql.gz
```

Example:
```
mielo_backup_20250103_020000.sql.gz
```

## Backup Schedule

- **Frequency**: Daily
- **Time**: 2:00 AM
- **Retention**: 30 days
- **Compression**: gzip
- **Log**: `~/Mielo-DB-Backups/backup.log`

## Restore Process

1. Run `./restore-database.sh`
2. Select a backup from the list
3. Confirm restoration
4. Database will be restored

⚠️ **Warning**: Restoring will replace the current database!

## Monitoring

Check backup logs:
```bash
tail -f ~/Mielo-DB-Backups/backup.log
```

List all backups:
```bash
ls -lht ~/Mielo-DB-Backups/
```

Check disk usage:
```bash
du -sh ~/Mielo-DB-Backups/
```

## Troubleshooting

### Backup fails with "command not found: pg_dump"

Install PostgreSQL client tools:
```bash
brew install postgresql
```

### Permission denied

Make scripts executable:
```bash
chmod +x backup-database.sh restore-database.sh setup-auto-backup.sh
```

### Cron job not running

Check cron logs:
```bash
# macOS
log show --predicate 'eventMessage contains "cron"' --last 24h

# Linux
grep CRON /var/log/syslog
```

## Migration Safety

Before any database migration:
1. **Create a manual backup**: `./backup-database.sh`
2. **Run the migration**
3. **Test the application**
4. If issues occur, restore: `./restore-database.sh`

## Best Practices

1. **Before major changes**: Always create a manual backup
2. **After important data updates**: Create a manual backup
3. **Weekly review**: Check that backups are running
4. **Monthly test**: Test restore process with a recent backup
5. **Keep offsite copy**: Periodically copy backups to external storage

## Off-site Backup (Recommended)

For extra safety, periodically copy backups to:

1. **External drive**:
   ```bash
   cp ~/Mielo-DB-Backups/*.gz /Volumes/BackupDrive/Mielo/
   ```

2. **Cloud storage** (Dropbox, Google Drive, etc.):
   ```bash
   cp ~/Mielo-DB-Backups/*.gz ~/Dropbox/Mielo-Backups/
   ```

3. **Git LFS** (for small databases):
   ```bash
   # Not recommended for large databases
   git lfs track "*.sql.gz"
   ```

## Support

For issues or questions, check the backup logs:
```bash
cat ~/Mielo-DB-Backups/backup.log
```
