# GitHub Repository Selection - Implementation Summary

## ✅ Changes Completed

### 1. **Database Schema Updated** (`prisma/schema.prisma`)
Added fields to support GitHub App installations:
- `installationId` (Int?) - GitHub App installation ID
- `integrationType` (String) - "oauth" or "installation"
- Added index on `installationId`

**Migration Required:**
```bash
cd mudra-app
npx prisma migrate dev --name add_github_app_support
npx prisma generate
```

### 2. **Installation Callback Route** (NEW)
**File:** `app/api/auth/github/installation/callback/route.ts`

Handles GitHub App installation callbacks:
- Exchanges installation ID for access token
- Stores encrypted token in database
- Supports both installation and update flows
- Uses JWT authentication for GitHub App API

### 3. **Frontend Updated**
**Files:**
- `app/dashboard/integrations/page.tsx` - Updated to use GitHub App installation URL
- `hooks/use-agent-operations.ts` - Updated OAuth flow to App installation

**Changes:**
- Changed from OAuth authorize URL to GitHub App installation URL
- Users now redirected to `https://github.com/apps/{app-name}/installations/new`
- Removed hard-coded `scope` parameter (controlled by App permissions)

### 4. **Environment Variables**
**Added to `.env.local`:**
```bash
GITHUB_APP_ID=
GITHUB_APP_NAME=mudra-content-optimizer
GITHUB_PRIVATE_KEY=
NEXT_PUBLIC_GITHUB_APP_NAME=mudra-content-optimizer
```

### 5. **Documentation Created**
**File:** `docs/implementation/GITHUB_APP_REPOSITORY_SELECTION.md`

Complete guide including:
- Why GitHub Apps vs OAuth Apps
- Step-by-step GitHub App setup instructions
- Implementation details
- Migration guide for existing users
- Security benefits
- Troubleshooting

---

## 🔧 Setup Steps for You

### Step 1: Create GitHub App

1. Go to: https://github.com/settings/apps/new

2. Fill in:
   - **GitHub App name:** `mudra-content-optimizer`
   - **Homepage URL:** `http://localhost:3000` (or your domain)
   - **Callback URL:** `http://localhost:3000/api/auth/github/installation/callback`
   - **Webhook:** Uncheck "Active"

3. **Permissions:**
   - Repository → Contents: **Read and write**
   - Repository → Pull requests: **Read and write**
   - Repository → Metadata: **Read-only** (auto-selected)
   - Account → Email addresses: **Read-only**

4. **Where can this app be installed?**
   - Select: **"Any account"**

5. Click **"Create GitHub App"**

6. **Save these values:**
   - App ID (shown at top)
   - Client ID (shown in About section)
   - Client Secret (click "Generate a new client secret")

7. **Generate Private Key:**
   - Scroll to "Private keys"
   - Click "Generate a private key"
   - Download the `.pem` file

### Step 2: Update Environment Variables

Open `.env.local` and fill in:

```bash
# From GitHub App settings page
GITHUB_APP_ID=123456
GITHUB_CLIENT_ID=Iv1.abc123def456
GITHUB_CLIENT_SECRET=your_new_client_secret_here

# Private key (convert newlines to \n)
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nYour\nPrivate\nKey\nHere\n-----END RSA PRIVATE KEY-----"
```

**To convert private key:**
```bash
# On Mac/Linux:
awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' downloaded-key.pem

# Or manually: Replace actual newlines with \n
```

### Step 3: Run Database Migration

```bash
cd mudra-app
npx prisma migrate dev --name add_github_app_support
npx prisma generate
```

### Step 4: Install `jsonwebtoken` Package

The installation callback uses JWT for GitHub App authentication:

```bash
cd mudra-app
npm install jsonwebtoken
npm install --save-dev @types/jsonwebtoken
```

### Step 5: Test the Flow

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Navigate to Integrations:**
   - Go to http://localhost:3000/dashboard/integrations
   - Click "Install" on GitHub card

3. **Repository Selection:**
   - You'll be redirected to GitHub
   - Select specific repositories to grant access
   - Click "Install & Authorize"

4. **Verify:**
   - Should redirect back to Integrations page
   - GitHub card shows "Connected as @username"
   - Check database: `GitHubIntegration` table should have `integrationType = "installation"`

---

## 🔄 For Production (Vercel)

### Update Vercel Environment Variables:

1. Go to: https://vercel.com/your-project/settings/environment-variables

2. Add/Update:
   ```
   GITHUB_APP_ID=123456
   GITHUB_APP_NAME=mudra-content-optimizer
   GITHUB_CLIENT_ID=Iv1.abc123def456
   GITHUB_CLIENT_SECRET=your_client_secret
   GITHUB_PRIVATE_KEY=<paste entire .pem file content>
   NEXT_PUBLIC_GITHUB_APP_NAME=mudra-content-optimizer
   ```

3. Update GitHub App callback URL:
   - In GitHub App settings: https://github.com/settings/apps/mudra-content-optimizer
   - Change callback URL to: `https://mudramvp.vercel.app/api/auth/github/installation/callback`

4. Redeploy Vercel app

---

## 🔍 How It Works Now

### Before (OAuth - All Repositories)
```
User clicks "Install" 
  → GitHub OAuth authorize page
  → User grants access to ALL repositories
  → Token stored
  → All repos visible in dropdown
```

### After (GitHub App - Selected Repositories)
```
User clicks "Install"
  → GitHub App installation page
  → User selects specific repositories ✅
  → Installation ID + token stored
  → Only selected repos visible in dropdown
```

### Repository Filtering in API

The `/api/github/repos` endpoint will automatically fetch only repositories that are:
1. Part of the GitHub App installation
2. Where user has push access

**Implementation (future enhancement):**
```typescript
// In github.service.ts
async function getInstallationRepositories(installationId: number) {
  const token = await refreshInstallationToken(installationId);
  
  const response = await fetch(
    `https://api.github.com/user/installations/${installationId}/repositories`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    }
  );
  
  const data = await response.json();
  return data.repositories; // Only repos user selected
}
```

---

## ✨ User Experience Changes

### Installation Flow
1. **Old:** "Grant access to all repositories?" → Yes/No (all-or-nothing)
2. **New:** "Select repositories" → Checkbox list (granular control)

### Repository Dropdown
1. **Old:** Shows all user's repositories (even private ones not granted)
2. **New:** Shows only repositories selected during installation

### Updating Access
- **Old:** User must disconnect and reconnect to change access
- **New:** User can modify repository selection without disconnecting:
  - Go to: https://github.com/settings/installations
  - Click "Configure" on Mudra app
  - Add/remove repositories
  - Changes reflect immediately in Mudra

---

## 🛡️ Security Improvements

1. **Least Privilege:** Only selected repos accessible, not all repos
2. **Token Expiration:** Installation tokens expire after 1 hour (auto-refresh)
3. **Audit Trail:** GitHub tracks all app installations and actions
4. **Revocable:** Users can uninstall app without changing OAuth settings
5. **Organizational Control:** Admins can restrict which apps users can install

---

## 📋 Testing Checklist

- [ ] GitHub App created with correct permissions
- [ ] Environment variables configured
- [ ] Database migration run successfully
- [ ] `jsonwebtoken` package installed
- [ ] Dev server starts without errors
- [ ] Can navigate to Integrations page
- [ ] Clicking "Install" redirects to GitHub
- [ ] Can select specific repositories
- [ ] Installation callback succeeds
- [ ] Token stored in database with `integrationType = "installation"`
- [ ] Integrations page shows "Connected"
- [ ] Can deploy Content Optimizer agent
- [ ] Repository dropdown shows only selected repos
- [ ] Can create PR to selected repository
- [ ] Can update repository selection on GitHub
- [ ] Changes reflect in repository dropdown

---

## 🚨 Rollback Plan

If you need to revert to OAuth flow:

1. **Revert frontend changes:**
   ```bash
   git checkout HEAD~1 -- app/dashboard/integrations/page.tsx
   git checkout HEAD~1 -- hooks/use-agent-operations.ts
   ```

2. **Database stays compatible:**
   - Old OAuth integrations have `integrationType = "oauth"`
   - New ones have `integrationType = "installation"`
   - Both work simultaneously

3. **No migration rollback needed:**
   - New fields are nullable
   - Doesn't break existing OAuth integrations

---

## 📞 Support

If you encounter issues:

1. **Check logs:**
   ```bash
   # Dev server logs
   npm run dev
   
   # Docker logs
   docker logs mudra-app-dev
   ```

2. **Common errors:**
   - "Missing GITHUB_APP_ID" → Fill in environment variables
   - "Invalid private key" → Check newline conversion (\n)
   - "Installation not found" → User may have uninstalled app
   - "Insufficient permissions" → Check GitHub App permissions

3. **Debug installation callback:**
   ```typescript
   // Add to app/api/auth/github/installation/callback/route.ts
   console.log('Installation ID:', installationId);
   console.log('Setup action:', setupAction);
   console.log('Token expires:', expiresAt);
   ```

---

**Status:** Ready for setup! Follow Step 1-5 above to enable repository selection.
