# GitHub Integration Fix - Testing Guide

## Quick Test Commands

### 1. Check Integration Isolation
```powershell
cd mudra-app
node test-github-isolation.js
```

This will show:
- All GitHub integrations in the database
- Duplicate installation IDs (CRITICAL if found)
- User isolation verification
- Email matching validation

### 2. Test Specific User
```powershell
node test-github-isolation.js user@example.com
```

Shows matching criteria for that user's sync.

### 3. Check Current State
```powershell
# Start Prisma Studio to view database
npx prisma studio
```

Navigate to `GitHubIntegration` table and verify:
- Each `userId` appears exactly once
- `installationId` values are unique per user
- `githubUsername` matches the correct GitHub account

## Manual Testing Steps

### Test Case 1: Fresh Installation (No Existing Integration)

**Setup:**
1. Create new user account (Account B)
2. Ensure Account A already has GitHub connected
3. Sign in as Account B

**Steps:**
1. Go to Dashboard → Integrations
2. Click "Install" button for GitHub
3. Complete GitHub App installation on a **different GitHub account**
4. After redirect, verify:
   - ✅ Shows "Connected as @yourGitHubUsername"
   - ✅ Username is YOUR GitHub username (not Account A's)
   - ✅ Click "Disconnect" works without errors

**Expected Result:**
Account B sees ONLY their own GitHub installation.

**Failure Indicator:**
If you see Account A's GitHub username, the bug still exists.

---

### Test Case 2: Sync Existing Installation

**Setup:**
1. Have Account A with GitHub connected
2. Create Account B (NO GitHub connection yet)
3. Manually install the GitHub App on Account B's GitHub account **outside the app**:
   - Go to: https://github.com/apps/mudra-content-optimizer (or your app name)
   - Click "Install" or "Configure"
   - Select repositories
   - DO NOT complete the OAuth flow through the app

**Steps:**
1. Sign in as Account B
2. Go to Dashboard → Integrations
3. Click "Sync Existing Installation"
4. Verify:
   - ✅ Success message appears
   - ✅ Shows "Connected as @accountBGitHubUsername"
   - ✅ Repository count is correct for Account B

**Expected Result:**
Account B's installation is found and connected.

**Failure Indicator:**
If you see:
- Account A's GitHub username
- Wrong repository count
- Error: "No installation found" (when installation exists for B)

---

### Test Case 3: Multiple Active Installations

**Setup:**
1. Account A: GitHub connected to `@usernameA`
2. Account B: GitHub connected to `@usernameB`
3. Both have the GitHub App installed on different GitHub accounts

**Steps:**
1. Sign in as Account A
2. Dashboard → Integrations
3. Verify shows `@usernameA`
4. Click "Sync Existing Installation"
5. Verify still shows `@usernameA` (not changed to B)
6. Sign in as Account B (different browser/incognito)
7. Dashboard → Integrations
8. Verify shows `@usernameB`
9. Click "Sync Existing Installation"
10. Verify still shows `@usernameB` (not changed to A)

**Expected Result:**
Each account sees only their own installation. Sync refreshes their own data.

**Failure Indicator:**
Account A sees Account B's username or vice versa after sync.

---

## Debugging Failed Tests

### Issue: "No installation found" error

**Check:**
```powershell
node test-github-isolation.js user@example.com
```

Look for:
- Is GitHub App installed on the GitHub account?
- Does the GitHub email match the app user email?
- Is there a previous integration with a different username?

**Fix:**
1. Go to https://github.com/settings/installations
2. Configure the app installation
3. Verify the GitHub email matches your app account email
4. Or, ensure the username in the existing integration matches

### Issue: Wrong username appears

**Check database:**
```powershell
npx prisma studio
```

1. Open `GitHubIntegration` table
2. Find your `userId`
3. Check:
   - `githubUsername` - is it correct?
   - `installationId` - is it unique?
   - `email` - does it match your GitHub email?

**Fix:**
```sql
-- Delete incorrect integration
DELETE FROM "GitHubIntegration" WHERE "userId" = 'your-user-id';
```

Then reconnect GitHub properly.

### Issue: Duplicate installation IDs

**This is CRITICAL** - multiple users sharing one installation.

**Check:**
```powershell
node test-github-isolation.js
```

Look for: "Found duplicate installation IDs"

**Fix:**
```sql
-- Keep only the correct user's integration
DELETE FROM "GitHubIntegration" 
WHERE "installationId" = 12345 
AND "userId" != 'correct-user-id';
```

## API Endpoint Testing

### Test Sync Endpoint Directly

```powershell
# Sign in first, then in browser console:
fetch('/api/integrations/github/sync', {
  method: 'POST',
  credentials: 'include'
}).then(r => r.json()).then(console.log)
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "installationId": 12345,
    "username": "yourGitHubUsername",
    "repositories": 5,
    "integrationType": "installation"
  }
}
```

**Error Response (if no installation for your account):**
```json
{
  "success": false,
  "error": "No GitHub App installation found for your account..."
}
```

### Test GET Endpoint

```powershell
# Check connection status
fetch('/api/integrations/github', {
  credentials: 'include'
}).then(r => r.json()).then(console.log)
```

**Expected Response (connected):**
```json
{
  "success": true,
  "connected": true,
  "integration": {
    "githubUsername": "yourUsername",
    "avatarUrl": "https://...",
    "connectedAt": "2026-01-16T..."
  }
}
```

## Monitoring Logs

After deploying the fix, monitor these log patterns:

```
[GitHub Sync] Found N total installation(s)
[GitHub Sync] Found matching installation for user: USERNAME
```

**Red flags:**
- `Found 0 total installations` - App not installed anywhere
- Never seeing "Found matching installation" - Matching logic failing
- Errors: "Failed to fetch installations" - API credentials issue

## Rollback Plan

If the fix causes issues:

1. **Quick rollback** (restores bug but unblocks users):
   ```typescript
   // In sync/route.ts, replace matching logic with:
   const allInstallations = await fetch('https://api.github.com/app/installations', ...)
   const installation = allInstallations[0] // ⚠️ Restores cross-user bug
   ```

2. **Better rollback** (use OAuth instead):
   ```typescript
   // Disable sync button in integrations/page.tsx
   disabled={true} // Hide sync until fixed
   ```

## Success Criteria

✅ Fix is successful when:
1. `node test-github-isolation.js` shows no duplicate installations
2. Each user in Test Case 3 sees only their own username
3. "Sync Existing Installation" finds correct user's installation
4. No errors in console logs during sync
5. Database shows unique `installationId` per user

## Files Changed
- [app/api/integrations/github/sync/route.ts](app/api/integrations/github/sync/route.ts) - Main fix
- [test-github-isolation.js](test-github-isolation.js) - Test script
- [GITHUB_SYNC_FIX.md](GITHUB_SYNC_FIX.md) - Detailed documentation
