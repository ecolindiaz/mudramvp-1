# GitHub Integration - Repository Selection Setup Guide

## Overview
This guide explains how to configure GitHub integration to allow users to select specific repositories instead of granting access to all repositories.

## Why GitHub Apps vs OAuth Apps?

### OAuth Apps (Current - All Repositories)
- ❌ Requests access to ALL user repositories
- ❌ All-or-nothing permission model
- ❌ Users can't choose which repos to share
- ❌ Less secure (broad access)

### GitHub Apps (Recommended - Selected Repositories)
- ✅ Users select specific repositories during installation
- ✅ Fine-grained permissions
- ✅ Can be installed on organization repos
- ✅ More secure (minimal access principle)
- ✅ Better audit trail

## Setup Instructions

### Step 1: Create a GitHub App

1. Navigate to GitHub Settings
   - Personal: `https://github.com/settings/apps`
   - Organization: `https://github.com/organizations/YOUR_ORG/settings/apps`

2. Click **"New GitHub App"**

3. Configure the App:

   **Basic Information:**
   - **GitHub App name:** `mudra-content-optimizer` (or your preferred name)
   - **Homepage URL:** `https://mudramvp.vercel.app`
   - **Callback URL:** `https://mudramvp.vercel.app/api/auth/github/installation/callback`
   - **Setup URL (optional):** `https://mudramvp.vercel.app/dashboard/integrations?github=setup`
   - **Webhook:** Uncheck "Active" (not needed for this use case)

   **Repository Permissions:**
   - **Contents:** Read and write (to create PRs and modify files)
   - **Pull requests:** Read and write (to create PRs)
   - **Metadata:** Read-only (automatically selected)

   **User Permissions:**
   - **Email addresses:** Read-only

   **Where can this GitHub App be installed?**
   - Select: "Any account" (allows users to install on their personal or org repos)

4. Click **"Create GitHub App"**

5. Save the following credentials:
   - **App ID** (shown on app settings page)
   - **Client ID** (shown on app settings page)
   - **Client Secret** (click "Generate a new client secret")

6. Generate a Private Key:
   - Scroll down to "Private keys"
   - Click "Generate a private key"
   - Save the `.pem` file securely

### Step 2: Update Environment Variables

Add the following to your `.env.local` and `.env.production`:

```bash
# GitHub App Configuration (replaces OAuth App)
GITHUB_APP_ID=123456
GITHUB_APP_NAME=mudra-content-optimizer
GITHUB_CLIENT_ID=Iv1.a1b2c3d4e5f6g7h8
GITHUB_CLIENT_SECRET=your_client_secret_here
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nYour\nPrivate\nKey\nHere\n-----END RSA PRIVATE KEY-----"

# Public (exposed to frontend)
NEXT_PUBLIC_GITHUB_APP_NAME=mudra-content-optimizer
```

**Note:** The private key must be in one line with `\n` for newlines.

### Step 3: Update Vercel Environment Variables

In your Vercel project dashboard:

1. Go to **Settings → Environment Variables**
2. Add the same variables from Step 2
3. For `GITHUB_PRIVATE_KEY`, paste the entire key content (Vercel handles multiline)
4. Redeploy your application

### Step 4: Implementation Changes

The following code changes are needed to support GitHub App installations:

#### A. Installation Callback Route

Create `app/api/auth/github/installation/callback/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const installationId = searchParams.get('installation_id');
  const setupAction = searchParams.get('setup_action');

  if (setupAction === 'install' && installationId) {
    try {
      const session = await getServerSession(authOptions);
      
      if (!session?.user?.email) {
        return NextResponse.redirect(
          new URL('/dashboard/integrations?error=unauthorized', req.url)
        );
      }

      // Get user from database
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
      });

      if (!user) {
        return NextResponse.redirect(
          new URL('/dashboard/integrations?error=user_not_found', req.url)
        );
      }

      // Get installation access token
      const { token, repositories } = await getInstallationToken(installationId);

      // Store in database
      await prisma.githubIntegration.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          accessToken: token, // Will be encrypted by service
          installationId: parseInt(installationId),
          githubUserId: '', // Will be populated on first use
          githubUsername: '', // Will be populated on first use
          scope: 'installation',
        },
        update: {
          accessToken: token,
          installationId: parseInt(installationId),
        },
      });

      return NextResponse.redirect(
        new URL('/dashboard/integrations?github=connected', req.url)
      );
    } catch (error) {
      console.error('GitHub installation callback error:', error);
      return NextResponse.redirect(
        new URL('/dashboard/integrations?error=installation_failed', req.url)
      );
    }
  }

  return NextResponse.redirect(
    new URL('/dashboard/integrations?error=invalid_request', req.url)
  );
}

async function getInstallationToken(installationId: string) {
  // Generate JWT for GitHub App authentication
  const jwt = generateGitHubAppJWT();

  // Get installation access token
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
      },
    }
  );

  const data = await response.json();
  
  return {
    token: data.token,
    repositories: data.repositories || [],
  };
}

function generateGitHubAppJWT() {
  // Implementation using jsonwebtoken package
  const jwt = require('jsonwebtoken');
  
  const payload = {
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60, // 1 minute expiration
    iss: process.env.GITHUB_APP_ID,
  };

  const privateKey = process.env.GITHUB_PRIVATE_KEY?.replace(/\\n/g, '\n');
  
  return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
}
```

#### B. Update GitHub Service

Update `lib/services/github.service.ts` to refresh installation tokens:

```typescript
async function getInstallationAccessToken(installationId: number): Promise<string> {
  const jwt = generateGitHubAppJWT();

  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
      },
    }
  );

  const data = await response.json();
  return data.token;
}
```

#### C. Update Prisma Schema

Add `installationId` to `GitHubIntegration`:

```prisma
model GitHubIntegration {
  id             Int      @id @default(autoincrement())
  userId         String   @unique
  accessToken    String   // Encrypted installation token
  installationId Int?     // GitHub App installation ID
  githubUserId   String
  githubUsername String
  avatarUrl      String?
  scope          String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

#### D. Update Frontend Integration Button

Already updated in the code to use GitHub App installation URL.

### Step 5: User Flow

1. User clicks **"Install"** on GitHub integration card
2. Redirected to GitHub App installation page
3. User selects which repositories to grant access:
   - ✅ All repositories
   - ✅ Only select repositories (user picks from dropdown)
4. User clicks "Install & Authorize"
5. Redirected back to Mudra with installation confirmed
6. When deploying Content Optimizer, only authorized repos appear in dropdown

### Step 6: Testing

1. **Local Testing:**
   ```bash
   # Use ngrok for GitHub callback
   ngrok http 3000
   
   # Update GitHub App callback URL to:
   https://your-ngrok-url.ngrok.io/api/auth/github/installation/callback
   ```

2. **Test Repository Selection:**
   - Install app and select only 1-2 repos
   - Verify only those repos appear in Content Optimizer dropdown
   - Test PR creation to selected repo

3. **Test Uninstall:**
   - Go to GitHub Settings → Applications → Installed GitHub Apps
   - Uninstall Mudra app
   - Verify integration shows disconnected in Mudra

## Migration from OAuth App to GitHub App

### For Existing Users

1. **Notify Users:**
   - Send email about improved repository selection
   - Provide migration deadline (e.g., 30 days)

2. **Handle Both Flows:**
   - Keep OAuth callback for legacy users
   - Add GitHub App callback for new users
   - Detect integration type in database

3. **Database Migration:**
   ```sql
   -- Add column for integration type
   ALTER TABLE "GitHubIntegration" 
   ADD COLUMN "integrationType" VARCHAR(20) DEFAULT 'oauth';
   
   -- Update existing records
   UPDATE "GitHubIntegration" 
   SET "integrationType" = 'oauth' 
   WHERE "installationId" IS NULL;
   ```

4. **Force Migration UI:**
   - Show banner on integrations page for OAuth users
   - "Upgrade to select specific repositories"
   - One-click migration button

## Security Benefits

### OAuth App (Before)
```
User grants access → All repos visible → PR can be created to any repo
```

### GitHub App (After)
```
User selects repos → Only selected repos visible → PR limited to authorized repos
```

**Key Improvements:**
- ✅ Principle of least privilege
- ✅ User control over access
- ✅ Reduced attack surface
- ✅ Easier compliance (GDPR, SOC2)
- ✅ Better user trust

## Troubleshooting

### "App installation not found"
- Check `GITHUB_APP_ID` matches your GitHub App
- Verify installation ID is stored correctly
- Ensure user completed installation flow

### "Insufficient permissions"
- Verify GitHub App has "Contents" and "Pull requests" permissions
- Check repository is in the installation's selected repos
- Confirm user didn't uninstall the app

### "Token expired"
- Installation tokens expire after 1 hour
- Implement token refresh in `github.service.ts`
- Cache tokens with expiration tracking

### "Private key error"
- Ensure private key has proper newlines (`\n`)
- Check key format: `-----BEGIN RSA PRIVATE KEY-----`
- Verify no extra spaces or characters

## Additional Resources

- [GitHub Apps Documentation](https://docs.github.com/en/apps)
- [Creating a GitHub App](https://docs.github.com/en/apps/creating-github-apps)
- [Authenticating with GitHub Apps](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app)
- [Installation Flow](https://docs.github.com/en/apps/using-github-apps/installing-your-own-github-app)

## Next Steps

After completing this setup:

1. ✅ Test installation with 1-2 selected repositories
2. ✅ Verify only selected repos appear in dropdowns
3. ✅ Test PR creation to authorized repos
4. ✅ Test error handling for unauthorized repos
5. ✅ Update user documentation
6. ✅ Add repository management UI (add/remove repos without reinstalling)

---

**Status:** Ready for implementation  
**Priority:** High (security & UX improvement)  
**Effort:** ~4 hours (setup + testing)
