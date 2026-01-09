# Avatar Cron Job System

Automated system for updating streamer avatars across all platforms in the Mielo database.

## 🚀 Quick Start

```bash
# Install the cron job (interactive installer)
bash scripts/installAvatarCron.sh

# Monitor progress
npx ts-node scripts/avatarCronMonitor.ts

# Test run manually
npx ts-node scripts/avatarCronJob.ts
```

## 📁 Files Overview

- **`avatarCronJob.ts`** - Main cron job script that runs automatically
- **`installAvatarCron.sh`** - Interactive installer for setting up cron jobs
- **`avatarCronMonitor.ts`** - Monitoring and reporting tool
- **`avatar-cron-config.json`** - Configuration file for batch sizes and settings

## ⚙️ Configuration

Edit `scripts/avatar-cron-config.json` to customize:

```json
{
  "batchSizes": {
    "TWITCH": 50,    // Process 50 Twitch streamers per batch
    "YOUTUBE": 30,   // Process 30 YouTube streamers per batch
    "KICK": 25,      // Process 25 Kick streamers per batch
    "FACEBOOK": 20,
    "TIKTOK": 20
  },
  "maxRuntimeMinutes": 30,                    // Stop after 30 minutes
  "enabledPlatforms": ["TWITCH", "YOUTUBE", "KICK"], // Which platforms to process
  "logRetentionDays": 7                       // Keep logs for 7 days
}
```

## 🕒 Schedule Options

The installer offers several schedule options:

- **Every 2 hours**: `0 */2 * * *` (recommended for active updates)
- **Every 4 hours**: `0 */4 * * *` (balanced approach)
- **Every 6 hours**: `0 */6 * * *` (conservative)
- **Daily at 3 AM**: `0 3 * * *` (minimal impact)
- **Custom schedule**: Define your own cron pattern

## 📊 Monitoring

### View Current Status
```bash
npx ts-node scripts/avatarCronMonitor.ts
```

### Check Cron Jobs
```bash
crontab -l
```

### View Logs
```bash
# Live tail of cron logs
tail -f logs/avatar-cron/cron.log

# View all avatar logs
ls -la logs/avatar-cron/

# View specific day's log
cat logs/avatar-cron/avatar-cron-2025-09-14.log
```

## 🔧 Manual Operations

### Run One-Time Update
```bash
# Test run (no changes)
npx ts-node scripts/updateAvatars.ts --limit 10 --dry-run

# Update 50 Twitch streamers
npx ts-node scripts/updateAvatars.ts --platform TWITCH --limit 50

# Update all platforms in batches
npx ts-node scripts/updateAllAvatars.ts
```

### Force Update Existing Avatars
```bash
npx ts-node scripts/updateAvatars.ts --force --limit 25
```

### Platform-Specific Updates
```bash
npx ts-node scripts/updateAvatars.ts --platform YOUTUBE --limit 30
npx ts-node scripts/updateAvatars.ts --platform KICK --limit 20
```

## 📈 Expected Performance

Based on testing:
- **Twitch**: ~100% success rate, ~3 seconds per streamer
- **YouTube**: Variable success rate, ~4 seconds per streamer
- **Kick**: Variable success rate, ~5 seconds per streamer

Processing 50 streamers takes approximately 2-3 minutes.

## 🗂️ Log Files

Logs are stored in `logs/avatar-cron/`:

- **`cron.log`** - Cron execution output
- **`avatar-cron-YYYY-MM-DD.log`** - Daily detailed logs
- Old logs are automatically cleaned up after 7 days

## 🚨 Troubleshooting

### Cron Job Not Running
```bash
# Check if cron service is running
sudo launchctl list | grep cron

# View system cron logs (macOS)
log show --predicate 'process == "cron"' --info --last 1h

# Test cron job manually
bash scripts/avatar-cron-wrapper.sh
```

### High Failure Rate
1. Check network connectivity
2. Review platform-specific selectors in `avatarService.ts`
3. Verify rate limits aren't being hit
4. Check browser automation isn't being blocked

### Performance Issues
1. Reduce batch sizes in config
2. Increase delay between batches
3. Run during off-peak hours
4. Monitor system resources

## 🔄 Uninstalling

```bash
# Run installer and choose option 8
bash scripts/installAvatarCron.sh

# Or remove manually
crontab -l | grep -v avatarCron | crontab -
```

## 📋 Best Practices

1. **Start Small**: Test with small batches first
2. **Monitor Progress**: Regular check with monitoring tool
3. **Off-Peak Hours**: Schedule during low-traffic periods
4. **Regular Maintenance**: Clean logs and monitor success rates
5. **Platform Testing**: Test each platform individually first

## 🎯 Current Status

As of the last run:
- **Total Streamers**: 10,973
- **With Avatars**: 264 (2.4%)
- **Remaining**: 10,709 streamers need avatars
- **Est. Time**: ~10-15 hours of processing time remaining

## 🔗 Related Commands

```bash
# View database stats
npx ts-node scripts/avatarCronMonitor.ts

# Check current cron jobs
crontab -l

# Edit cron jobs manually
crontab -e

# Test avatar service directly
npx ts-node -e "
import { avatarService } from './src/services/avatarService';
avatarService.fetchAvatar('username', 'TWITCH').then(console.log);
"
```