# Production Deployment Checklist

## Immediate Fix (Deploy this weekend)

### 1. Add CSV to deployment
```bash
# Ensure CSV is in git
git add backend/csv/combined.csv
git commit -m "Add production streamer data"
git push

# In your deployment process, ensure CSV is copied:
# Dockerfile: COPY backend/csv/ /app/csv/
# Or: rsync backend/csv/ production:/app/csv/
```

### 2. Environment Variables
```bash
# Ensure production has:
ENABLE_STARTUP_DATA_TASKS=true
NODE_ENV=production
```

### 3. Verify startup seeding
- Check logs for: "Auto-seed complete. Created: X, Updated: Y"
- If CSV missing, you'll see: "CSV not found at /path/to/csv; skipping auto-seed"

## Long-term Architecture (Next 2-4 weeks)

### 1. Real-time Scraping
- Implement `ScraperService` with actual API calls
- Add rate limiting and error handling
- Schedule with cron jobs or task queues

### 2. Data Quality
- Add validation rules
- Implement fraud detection
- Monitor data freshness

### 3. Monitoring
- Track scraping success/failure rates
- Alert on data staleness
- Monitor API rate limits

## Success Metrics
- ✅ Production shows 10,000+ streamers
- ✅ Data updates automatically
- ✅ No manual intervention needed
- ✅ Monitoring in place

## Rollback Plan
If issues occur:
1. Revert to previous deployment
2. Use manual CSV import endpoint
3. Check logs for specific errors