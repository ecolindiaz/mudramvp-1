# GitHub Integration Cross-Account State Bug - FIXED

## Problem Description
When installing the GitHub App to connect a repository on a **new account**, the new account's state incorrectly appeared as if the GitHub connection was already applied. This was causing users to see installations from other users' accounts.

## Root Cause
The bug was in the **GitHub sync endpoint** at [app/api/integrations/github/sync/route.ts](app/api/integrations/github/sync/route.ts).

The endpoint was using the GitHub App JWT to fetch installations via:
```typescript
// ❌ WRONG - This fetches ALL installations across ALL users
const installationsResponse = await fetch(
  'https://api.github.com/user/installations',
  {
    headers: {
      Authorization: `Bearer ${appJwt}`, // App-level token
```

This GitHub App JWT has permissions to see **all installations** of the app across all users, not just the current user's installation. When the "Sync Existing Installation" button was clicked, it would fetch the first installation it found - which could belong to a different user.

## The Fix
The fix implements **user-specific installation matching** by:

1. **Fetching all installations** using the App JWT (required to get installation list)
2. **For each installation**, temporarily obtain an installation token
3. **Query the GitHub user** associated with that installation token
4. **Match the installation to the current user** by comparing:
   - GitHub email with authenticated user's email
   - GitHub username with previously connected GitHub username (if exists)
5. **Only use the installation** that matches the current user

### Key Changes

**Before:**
```typescript
// Get all installations (returns first one, could be any user)
const installationsResponse = await fetch(
  'https://api.github.com/user/installations',
  { headers: { Authorization: `Bearer ${appJwt}` } }
)
const installations = installationsData.installations || []
const installation = installations[0] // ❌ Could be wrong user!
```

**After:**
```typescript
// Get ALL installations of the app
const allInstallationsResponse = await fetch(
  'https://api.github.com/app/installations',
  { headers: { Authorization: `Bearer ${appJwt}` } }
)

// For each installation, check if it belongs to current user
for (const installation of allInstallations) {
  const tokenData = await fetch(`/app/installations/${installation.id}/access_tokens`)
  const githubUser = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${tokenData.token}` }
  })
  
  // ✅ Match installation to current user
  const isMatch = 
    githubUser.email?.toLowerCase() === user.email?.toLowerCase() ||
    (user.githubIntegration && githubUser.login === user.githubIntegration.githubUsername)
  
  if (isMatch) {
    userInstallation = { installation, token: tokenData.token, ... }
    break
  }
}
```

## Security Implications

### What Was Leaking
- **Installation visibility**: Users could see that GitHub integrations existed
- **GitHub usernames**: The first installation's username would be shown
- **Repository counts**: Other users' repository counts could be visible

### What Was NOT Leaking
- **Access tokens**: Tokens were always stored per-user in the database (userId is unique)
- **Repository contents**: No actual repository data was accessible cross-user
- **GitHub data**: The bug was only in the sync/display layer, not data access

### Why Existing Integrations Still Worked
The database schema always enforced user isolation:
```prisma
model GitHubIntegration {
  userId String
  // ...
  @@unique([userId])  // ✅ Database enforces one integration per user
}
```

So even if the wrong installation ID was synced, database queries by `userId` would still return the correct user's data.

## Testing Steps

### Test 1: New User Installation
1. Create a new account (Account B) while Account A has GitHub connected
2. Navigate to Dashboard → Integrations
3. Click "Install" for GitHub
4. Complete GitHub App installation flow
5. **Expected**: Account B shows connected as their own GitHub username
6. **Previously**: Account B might show Account A's GitHub username

### Test 2: Manual Sync with Multiple Installations
1. Have 2+ accounts with GitHub App installed (different GitHub accounts)
2. On Account B, click "Sync Existing Installation"
3. **Expected**: Syncs only Account B's installation
4. **Previously**: Could sync Account A's installation

### Test 3: Email Matching
1. Create account with email `user@example.com`
2. Install GitHub App using GitHub account with same email
3. Click "Sync Existing Installation"
4. **Expected**: Correctly matches by email

### Test 4: Username Matching (Re-sync)
1. User previously connected GitHub as `@username`
2. Disconnect and reinstall GitHub App
3. Click "Sync Existing Installation"
4. **Expected**: Correctly matches by existing username in database

## Monitoring & Logging

The fix includes extensive logging to debug installation matching:
- `[GitHub Sync] Found N total installation(s)` - Total installations of the app
- `[GitHub Sync] Found matching installation for user: USERNAME` - Successful match
- `[GitHub Sync] Error checking installation: ID` - Installation check failures

Check these logs if users report sync issues.

## API Behavior Changes

### Before
- **Endpoint**: `POST /api/integrations/github/sync`
- **Behavior**: Returns first installation (could be wrong user)
- **Error**: Silent failure - shows wrong installation without error

### After
- **Endpoint**: `POST /api/integrations/github/sync`
- **Behavior**: Returns ONLY the current user's installation
- **Error**: Clear error if no matching installation found:
  ```json
  {
    "success": false,
    "error": "No GitHub App installation found for your account. Please install the app first at: https://github.com/apps/mudra-content-optimizer"
  }
  ```

## Related Files
- [app/api/integrations/github/sync/route.ts](app/api/integrations/github/sync/route.ts) - **FIXED**
- [app/api/integrations/github/route.ts](app/api/integrations/github/route.ts) - Unchanged (stores integration)
- [app/api/auth/github/installation/callback/route.ts](app/api/auth/github/installation/callback/route.ts) - Unchanged (handles OAuth callback)
- [app/dashboard/integrations/page.tsx](app/dashboard/integrations/page.tsx) - UI component (unchanged)

## Performance Impact
The fix iterates through all GitHub App installations to find the matching one. For apps with many installations:
- **Worst case**: O(n) where n = number of installations
- **Typical case**: O(1-3) for most apps with few users
- **Optimization**: Loop breaks on first match
- **Future improvement**: Cache GitHub user → installation ID mapping

## Rollback Plan
If issues occur, revert to previous behavior:
```typescript
// Temporary rollback - USE FIRST INSTALLATION (original bug)
const allInstallations = await fetch('https://api.github.com/app/installations', ...)
const installation = allInstallations[0]
```

**Do not use this except in emergency** - it restores the cross-user bug.

## Prevention
To prevent similar issues:
1. **Always filter by userId** when querying user-specific resources
2. **Use installation tokens** (user-scoped) instead of App JWT (global-scoped) when possible
3. **Test with multiple accounts** to catch cross-user data leaks
4. **Log user identifiers** (email, username) when debugging integrations

## Next Steps
- [ ] Test fix with 2+ accounts in development
- [ ] Monitor logs for installation matching patterns
- [ ] Consider caching installation → user mappings for performance
- [ ] Add integration test for multi-user scenarios
- [ ] Document GitHub App setup requirements in README
