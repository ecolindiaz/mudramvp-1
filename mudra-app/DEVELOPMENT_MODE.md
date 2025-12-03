# Development Mode - Unlimited Analysis

## Overview
Development mode allows you to run unlimited analyses without cooldown restrictions. This is perfect for testing and development.

## Status: ✅ ENABLED

Development mode is currently **ENABLED** in your environment.

## How It Works

When `DEVELOPMENT_MODE=true` is set:
- ✅ **No cooldown** between analysis runs
- ✅ **Unlimited analyses** - run as many as you want
- ✅ **Countdown badge shows "DEV"** instead of timer
- ✅ **Analysis restrictions bypassed** automatically

## Configuration

### Environment Variables

**`.env.local` (Local Development):**
```bash
DEVELOPMENT_MODE=true  # ✅ Currently enabled
```

**`.env.docker` (Docker Development):**
```bash
DEVELOPMENT_MODE=true  # ✅ Currently enabled
```

### Toggle Development Mode

**To Enable (Unlimited Analysis):**
```bash
# Edit .env.local or .env.docker
DEVELOPMENT_MODE=true

# Restart the server
npm run dev  # OR
docker compose restart
```

**To Disable (Enforce Cooldowns):**
```bash
# Edit .env.local or .env.docker
DEVELOPMENT_MODE=false  # OR remove the line

# Restart the server
```

## Visual Indicator

When development mode is active, you'll see:
- **Badge:** "⚡ DEV" instead of countdown timer
- **Tooltip:** "Development mode - unlimited analysis"
- **Console logs:** "[GEO Core] ⚡ Development mode enabled - skipping cooldown"

## Code Changes

### Files Modified

1. **`lib/utils/dev-mode.ts`**
   - Added `DEVELOPMENT_MODE` environment variable check
   - Updated `shouldEnforceAnalysisRestrictions()` to bypass when enabled

2. **`lib/services/unified-analysis.service.ts`**
   - Added development mode check before cooldown validation
   - Logs when development mode bypasses cooldown

3. **`.env.local` & `.env.docker`**
   - Added `DEVELOPMENT_MODE=true` flag

## Usage

### Run Analysis Anytime

With development mode enabled:

```bash
# From Dashboard
Click "Analyze Website" → Analysis runs immediately (no waiting)

# Via API
curl -X POST http://localhost:3000/api/analysis/unified \
  -H "Content-Type: application/json" \
  -d '{
    "brandProfileId": 1,
    "skipCooldown": false  # Not needed - DEVELOPMENT_MODE bypasses this
  }'
```

### Multiple Runs

You can now run analyses back-to-back:

```bash
# Run 1
POST /api/analysis/unified → Success ✅

# Run 2 (immediately after)
POST /api/analysis/unified → Success ✅

# Run 3 (immediately after)
POST /api/analysis/unified → Success ✅
```

## Production Mode

When deploying to production (Vercel):

1. **DO NOT** set `DEVELOPMENT_MODE=true` in production environment variables
2. Cooldowns will automatically be enforced
3. Default cooldown: 5 minutes between analyses

## Troubleshooting

### Development Mode Not Working?

**Check environment variable:**
```bash
# Docker
docker exec mudra-app-dev printenv | grep DEVELOPMENT_MODE

# Local (in code)
console.log('DEVELOPMENT_MODE:', process.env.DEVELOPMENT_MODE)
```

**Expected output:**
```bash
DEVELOPMENT_MODE=true
```

### Still Seeing Cooldown Errors?

1. Verify `.env.docker` or `.env.local` has `DEVELOPMENT_MODE=true`
2. Restart the server: `docker compose restart` or `npm run dev`
3. Clear Next.js cache: `rm -rf .next && npm run dev`
4. Check console logs for "⚡ Development mode enabled"

## Related Files

- `lib/utils/dev-mode.ts` - Development mode utilities
- `lib/services/unified-analysis.service.ts` - Analysis service with cooldown logic
- `components/dashboard/countdown-badge.tsx` - Visual indicator component
- `.env.local` - Local environment configuration
- `.env.docker` - Docker environment configuration

## Quick Reference

```bash
# Enable Development Mode
echo "DEVELOPMENT_MODE=true" >> .env.docker
docker compose restart

# Disable Development Mode
# Remove DEVELOPMENT_MODE line from .env.docker
docker compose restart

# Check Status
docker exec mudra-app-dev printenv | grep DEVELOPMENT_MODE

# View Logs
docker logs mudra-app-dev --tail 50
```

---

**Status:** Development mode is **ENABLED** ✅  
**Cooldowns:** **DISABLED** ⚡  
**Analyses:** **UNLIMITED** 🚀
