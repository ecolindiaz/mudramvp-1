# "Stuck on Starting" - Troubleshooting Guide

## Problem
Next.js shows `✓ Starting...` but never completes, and the container may restart repeatedly.

---

## Quick Fixes (Try These First)

### Fix 1: Rebuild Without Cache
```powershell
cd mudra-app
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml build --no-cache
docker-compose -f docker-compose.dev.yml up
```

### Fix 2: Generate Prisma Client
```powershell
docker-compose -f docker-compose.dev.yml run --rm app npx prisma generate
docker-compose -f docker-compose.dev.yml up
```

### Fix 3: Clear Next.js Cache
```powershell
# Delete .next directory on host
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
docker-compose -f docker-compose.dev.yml up
```

---

## Detailed Diagnostics

### Step 1: Check Container Logs
```powershell
docker logs mudra-app-dev --tail 100
```

**What to look for:**
- ❌ **Error messages** (missing modules, syntax errors)
- ❌ **"Exited"** or restarts
- ✅ **"Ready in Xms"** (means it worked!)

### Step 2: Check Environment Variables
```powershell
docker exec mudra-app-dev printenv | findstr "DATABASE NEXTAUTH NODE_ENV"
```

**Required variables:**
- `DATABASE_URL` - Should point to Supabase
- `NEXTAUTH_URL` - Should be http://localhost:3000
- `NEXTAUTH_SECRET` - Should exist
- `NODE_ENV` - Should be "development"

### Step 3: Test Database Connection
```powershell
docker exec mudra-app-dev npx prisma db pull
```

**Expected:** No errors
**If fails:** Database URL is wrong or unreachable

### Step 4: Check Prisma Client
```powershell
docker exec mudra-app-dev ls node_modules/.prisma/client
```

**Expected:** Should list files (index.js, schema.prisma, etc.)
**If empty/missing:** Run `npx prisma generate`

### Step 5: Check for Import Errors
```powershell
# Run Next.js with verbose output
docker-compose -f docker-compose.dev.yml run --rm app npm run dev
```

Watch for:
- ❌ `Cannot find module ...`
- ❌ `SyntaxError: ...`  
- ❌ `Error: Circular dependency`

---

## Common Causes & Solutions

### Cause 1: Missing Prisma Client
**Symptom:** Hangs at "Starting..." with no error

**Solution:**
```powershell
docker-compose -f docker-compose.dev.yml run --rm app sh
# Inside container:
npx prisma generate
exit
```

Then restart container.

---

### Cause 2: Database Connection Failure
**Symptom:** Hangs for 30+ seconds, then may timeout

**Solution:**
1. Check `.env.docker` has correct `DATABASE_URL`
2. Test connection:
```powershell
docker exec mudra-app-dev npx prisma db pull
```

3. If fails, update DATABASE_URL:
```env
# Use DIRECT connection (not pooler)
DATABASE_URL=postgresql://postgres.xxx:password@db.xxx.supabase.co:5432/postgres?sslmode=require
```

---

### Cause 3: Import/Module Errors
**Symptom:** Hangs at "Starting...", no error in logs

**Solution:**
1. Check for circular dependencies in your code
2. Look for dynamic imports that may fail
3. Run this to see actual error:
```powershell
docker-compose -f docker-compose.dev.yml run --rm app node --loader ts-node/esm app/layout.tsx
```

---

### Cause 4: Middleware Hanging
**Symptom:** Starts, then hangs on first request

**Solution:**
Temporarily disable middleware:
```powershell
# Rename middleware.ts
Rename-Item middleware.ts middleware.ts.bak

# Restart
docker-compose -f docker-compose.dev.yml up
```

If it works, the issue is in `middleware.ts`:
- Check for infinite loops
- Check for async operations without timeout
- Check for missing return statements

---

### Cause 5: Next.js Cache Corruption
**Symptom:** Worked before, suddenly hangs

**Solution:**
```powershell
# On host
Remove-Item -Recurse -Force .next

# In container (if running)
docker exec mudra-app-dev rm -rf .next

# Restart
docker-compose -f docker-compose.dev.yml restart
```

---

### Cause 6: Node Modules Conflict
**Symptom:** Works locally, fails in Docker

**Solution:**
```powershell
# Clear and rebuild
docker-compose -f docker-compose.dev.yml down
docker volume prune -f
docker-compose -f docker-compose.dev.yml build --no-cache
docker-compose -f docker-compose.dev.yml up
```

---

## Debug Mode (Advanced)

### Run in Debug Mode
```powershell
docker-compose -f docker-compose.dev.yml run --rm app sh -c "NODE_OPTIONS='--inspect=0.0.0.0:9229' npm run dev"
```

Then:
1. Open Chrome: `chrome://inspect`
2. Click "Configure" → Add `localhost:9229`
3. Click "inspect" under Remote Target
4. See actual error in DevTools console

---

## Complete Reset (Nuclear Option)

If nothing works:
```powershell
# Stop everything
docker-compose -f docker-compose.dev.yml down -v

# Remove all Docker artifacts
docker system prune -a --volumes

# Rebuild from scratch
docker-compose -f docker-compose.dev.yml build --no-cache
docker-compose -f docker-compose.dev.yml up
```

---

## Still Stuck?

### Manual Container Inspection
```powershell
# Start container in interactive mode
docker-compose -f docker-compose.dev.yml run --rm app sh

# Inside container, try:
npx prisma generate
npm run dev

# Watch for actual error messages
```

### Check These Files
1. **middleware.ts** - Look for infinite loops
2. **app/layout.tsx** - Check imports
3. **prisma/schema.prisma** - Verify it's valid
4. **.env.docker** - Check all required vars exist

### Get Full Error Stack
```powershell
# Run with full error output
docker-compose -f docker-compose.dev.yml run --rm app sh -c "DEBUG=* npm run dev 2>&1 | tee /tmp/error.log"
```

---

## Expected Success Output

When it works, you should see:
```
   ▲ Next.js 15.3.3
   - Local:        http://localhost:3000
   - Network:      http://0.0.0.0:3000
   - Environments: .env.local, .env

 ✓ Starting...
 ✓ Ready in 3.2s
 ○ Compiling / ...
 ✓ Compiled / in 1.5s
```

---

## Quick Diagnostic Checklist

- [ ] Container logs show actual error (not just "Starting...")
- [ ] DATABASE_URL is accessible from container
- [ ] Prisma client is generated (`node_modules/.prisma/client` exists)
- [ ] No syntax errors in app code
- [ ] middleware.ts doesn't have infinite loops
- [ ] .next cache is not corrupted
- [ ] Environment variables are loaded (.env.docker)
- [ ] Node modules are installed correctly

---

## Contact Points

If you're still stuck, provide:
1. Full output of: `docker logs mudra-app-dev`
2. Output of: `docker exec mudra-app-dev printenv`
3. Output of: `docker exec mudra-app-dev npx prisma db pull`
4. Any error messages from Chrome DevTools (if using debug mode)

---

**Last Updated**: October 17, 2025
