# 🔄 Local → Production Database Sync

This system keeps your production database in sync with local changes.

## 🚀 Quick Start

### 1. Check Status
```bash
npm run sync:status
# Shows: Local: 10,973 | Production: 0 | Difference: 10,973
```

### 2. Initial Full Sync
```bash
npm run sync:full
# Syncs all data to production (one-time setup)
```

### 3. Keep in Sync
```bash
npm run sync:watch
# Runs continuous sync every 5 minutes
```

## 📋 Available Commands

| Command | Description | When to Use |
|---------|-------------|-------------|
| `npm run sync:status` | Check database counts | Daily check |
| `npm run sync:full` | Sync all data | Initial setup, major changes |
| `npm run sync:incremental` | Sync only recent changes | After making changes |
| `npm run sync:watch` | Continuous auto-sync | Development workflow |
| `npm run sync:diff` | Show recent changes | Before syncing |

## 🔧 Configuration

Edit your `.env` file:

```bash
# Production Sync Settings
PRODUCTION_API_URL="https://api.miela.cc"
PRODUCTION_API_KEY="your-secure-api-key"
SYNC_INTERVAL_MS=300000    # 5 minutes
SYNC_BATCH_SIZE=50         # Streamers per batch
ENABLE_AUTO_SYNC=true      # Auto-sync on startup
```

## 💼 Workflow Examples

### Daily Development
```bash
# Morning: Check status
npm run sync:status

# Work on your database locally...
# Add/edit streamers in your local DB

# Afternoon: Sync changes
npm run sync:incremental

# Or just run watch mode once:
npm run sync:watch
```

### Major Database Changes
```bash
# Before: Check what you have
npm run sync:diff

# Make your changes locally...

# After: Full sync
npm run sync:full
```

## 🛡️ Safety Features

- **Incremental sync**: Only sends changed records
- **Batch processing**: Won't overwhelm production
- **Rate limiting**: Respects API limits
- **Error handling**: Continues on single record failures
- **Status monitoring**: Always know sync state

## 🔍 Troubleshooting

### "Authentication failed"
1. Check `PRODUCTION_API_KEY` in `.env`
2. Verify production credentials
3. Test: `curl https://api.miela.cc/health`

### "No changes to sync"
- Your databases are already in sync! ✅
- Check with: `npm run sync:status`

### "Sync failed"
1. Check production API is running
2. Verify network connection
3. Check logs for specific errors

## 🎯 Best Practices

1. **Run sync:status daily** - Know your sync state
2. **Use watch mode during development** - Automatic sync
3. **Test changes locally first** - Then sync to production
4. **Monitor production after sync** - Verify data integrity
5. **Keep backups** - Before major syncs

## 📊 Monitoring

The sync system logs everything:
- ✅ Successful syncs
- ⚠️ Partial failures
- ❌ Complete failures
- 📈 Performance metrics

Check logs in your application dashboard.