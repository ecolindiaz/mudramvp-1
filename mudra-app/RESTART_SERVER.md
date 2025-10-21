# Restart Dev Server

The Prisma client has been updated to handle SQLite paths correctly.

**Stop the current server** (press Ctrl+C in the terminal where npm run dev is running)

**Then restart:**
```bash
npm run dev
```

## What Was Fixed

Updated `lib/prisma.ts` to automatically convert relative SQLite paths to absolute paths:
- Before: `file:./prisma/dev.db` (failed in API routes)
- After: `file:C:/Users/hongc/Projects/mudramvp/mudra-app/prisma/dev.db` (works everywhere)

This fixes "Error code 14: Unable to open the database file" errors.

## After Restart

Test the campaign system:
1. Go to http://localhost:3000/dashboard/campaigns
2. Click "New Campaign"
3. Generate a campaign
4. Should save to Drafts tab ✅
5. Click to edit, save changes
6. Mark as published → moves to Published tab

The database persistence should now work!

