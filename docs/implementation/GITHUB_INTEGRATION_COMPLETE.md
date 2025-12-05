# GitHub Integration - Complete Implementation

## Overview
Complete end-to-end GitHub integration for the Content Optimizer agent, enabling automated PR creation with repository selection UI.

**Status:** ✅ **COMPLETE**  
**Date:** December 4, 2025

---

## Architecture Flow

```
User → Integrations Page → GitHub OAuth → Token Encrypted
                                              ↓
User → Agents Lab → Deploy Content Optimizer → Select Repo & Branch
                                              ↓
Config Saved → AgentSchedule.config: { githubRepo, githubBranch }
                                              ↓
Agent Runs → github.service.ts → Fetch Config → Create PR
```

---

## Implementation Components

### 1. GitHub Repository API
**File:** `app/api/github/repos/route.ts`

**Purpose:** Fetch user's GitHub repositories with write access

**Features:**
- Authenticates via NextAuth session
- Fetches repos from GitHub API with push permissions
- Returns simplified repo data: name, full_name, default_branch, permissions
- Filters to only writable repositories

**Endpoint:** `GET /api/github/repos`

**Response:**
```json
{
  "success": true,
  "data": {
    "repos": [
      {
        "id": 123,
        "name": "repo-name",
        "fullName": "owner/repo-name",
        "defaultBranch": "main",
        "private": false,
        "permissions": { "push": true }
      }
    ],
    "total": 5
  }
}
```

---

### 2. Repository Selector UI
**File:** `components/dashboard/deploy-agent-dialog.tsx`

**Features:**
- Auto-fetches repos on dialog mount
- Shows connection status (connected/not connected)
- Repository dropdown with GitHub icon
- Branch dropdown (auto-populated with default branch)
- Validation: requires both repo + branch for Content Optimizer
- Warning message if GitHub not connected

**UI Elements:**
- `<Select>` for repository selection
- `<Select>` for branch selection (disabled until repo selected)
- `<AlertCircle>` warning for disconnected state
- Loading state while fetching repos

---

### 3. Deployment Handler with Config
**File:** `app/dashboard/agents-lab/page.tsx`

**Updated:** `handleDeployAgent()` function

**Changes:**
- Accepts optional `repoConfig: { repo: string; branch: string }`
- Saves config to database via `/api/agents/deployed` POST
- Config stored in `AgentSchedule.config` JSON field
- Format: `{ githubRepo: "owner/repo", githubBranch: "main" }`

**Persistence:**
```typescript
await fetch('/api/agents/deployed', {
  method: 'POST',
  body: JSON.stringify({
    brandProfileId: profile.id,
    agentType: 'content_optimizer',
    cronExpression: '0 9 * * *',
    config: {
      githubRepo: 'EmiCorleone/mudramvp',
      githubBranch: 'main'
    }
  })
})
```

---

### 4. PR Creation Service
**File:** `lib/services/github.service.ts`

**Updated:** `createOptimizationPR()` function

**Changes:**
- Removed reference to non-existent `deployedAgents` table
- Now reads config from `AgentSchedule` table
- Validates repo config exists before creating PR
- Provides clear error messages for missing configuration

**Error Handling:**
- ✅ GitHub integration not found
- ✅ Agent not configured with repository
- ✅ Invalid repository format
- ✅ API errors with detailed messages

**Process:**
1. Fetch `BrandProfile` with `user.githubIntegration`
2. Fetch `AgentSchedule` where `agentType = 'content_optimizer'`
3. Extract `githubRepo` and `githubBranch` from config
4. Parse `owner/repo` format
5. Create PR via GitHub API with encrypted token

---

## Database Schema

### AgentSchedule Table
```prisma
model AgentSchedule {
  id             Int       @id @default(autoincrement())
  brandProfileId Int
  agentType      String    // 'content_optimizer'
  isEnabled      Boolean   @default(true)
  cronExpression String
  config         Json?     // { githubRepo, githubBranch }
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@unique([brandProfileId, agentType])
  @@index([brandProfileId])
}
```

**Config JSON Structure:**
```json
{
  "githubRepo": "owner/repository-name",
  "githubBranch": "main"
}
```

---

## User Flow

### Initial Setup (One-Time)
1. Navigate to **Settings → Integrations**
2. Click **Install** on GitHub card
3. OAuth redirect to `github.com/login/oauth/authorize`
4. Grant permissions: `repo`, `read:user`, `user:email`
5. Callback stores encrypted token in `GitHubIntegration` table

### Agent Deployment (Per Agent)
1. Navigate to **Agents Lab**
2. Click **Deploy Agent** button
3. Select **Content Optimizer** from modal
4. Choose repository from dropdown (auto-populated)
5. Choose branch from dropdown (defaults to repo's default branch)
6. Click **Deploy**
7. Agent configuration saved with repo details

### Automated PR Creation
1. Content Optimizer runs (scheduled or manual)
2. Identifies pages with GEO score < 70%
3. Generates optimization improvements
4. Fetches repo config from `AgentSchedule`
5. Creates GitHub PR using encrypted token
6. PR includes all improvements with code snippets

---

## Environment Variables

### Required
```bash
GITHUB_CLIENT_ID=Ov23li3Acc4cecvAsdml
GITHUB_CLIENT_SECRET=<from GitHub OAuth App>
GITHUB_TOKEN_ENCRYPTION_KEY=<32-byte hex key>
NEXTAUTH_SECRET=<from openssl rand -base64 32>
```

### GitHub OAuth App Settings
- **Homepage URL:** `https://mudramvp.vercel.app`
- **Authorization callback URL:** `https://mudramvp.vercel.app/api/auth/callback/github`
- **Scopes:** `repo`, `read:user`, `user:email`

---

## Security

### Token Encryption
- Algorithm: **AES-256-GCM**
- Key: 32-byte hex from `GITHUB_TOKEN_ENCRYPTION_KEY`
- Storage: IV + encrypted token + auth tag in `GitHubIntegration.accessToken`
- Decryption: Server-side only, never exposed to client

### Permissions
- Filtered to repos with **push access**
- User must own or have write permissions
- PRs created from agent service (server-side)
- No client-side token exposure

---

## Testing Checklist

- [x] GitHub OAuth flow (connect/disconnect)
- [x] Repository fetching from API
- [x] Repository dropdown population
- [x] Branch selection UI
- [x] Config persistence to database
- [x] Config retrieval from database
- [x] PR creation with encrypted token
- [x] Error handling for missing config
- [x] Warning display when GitHub not connected
- [x] TypeScript compilation with no errors

---

## Known Limitations

1. **Branch Selection:** Currently only shows default branch. Future enhancement: fetch all branches per repo.
2. **Multiple Repos:** Agent can only target one repository. Future: support multiple repos per agent.
3. **PR Conflict Handling:** No automatic merge conflict resolution. PRs must be manually reviewed.
4. **Rate Limiting:** GitHub API rate limits not yet handled. May need retry logic for high-volume usage.

---

## Future Enhancements

### Phase 2
- [ ] Fetch all branches for selected repository
- [ ] Add branch search/filter
- [ ] Show repo description in dropdown
- [ ] Display last updated time for repos
- [ ] Add repo permissions indicator

### Phase 3
- [ ] Support multiple repositories per agent
- [ ] Add webhook for PR status updates
- [ ] Automatic PR merge for approved changes
- [ ] GitHub Actions integration for validation
- [ ] Repository health checks before deployment

### Phase 4
- [ ] GitLab integration (similar pattern)
- [ ] Bitbucket integration
- [ ] Self-hosted Git server support

---

## Troubleshooting

### "GitHub not connected" warning
**Solution:** Navigate to Settings → Integrations and connect GitHub account

### "Agent not configured with repository"
**Solution:** Redeploy agent and select repository from dropdown

### "Failed to fetch repositories"
**Solution:** Check GitHub token validity, may need to reconnect OAuth

### "Invalid repository format"
**Error:** `githubRepo` must be in format `owner/repo`  
**Solution:** Ensure repo selection UI populates correct format

### PR creation fails
**Possible causes:**
1. Token expired → Reconnect GitHub
2. Insufficient permissions → Check repo access
3. Branch doesn't exist → Verify branch name
4. API rate limit → Wait and retry

---

## Related Files

**API Routes:**
- `app/api/github/repos/route.ts` - Fetch repositories
- `app/api/integrations/github/route.ts` - OAuth management
- `app/api/agents/deployed/route.ts` - Agent persistence

**Components:**
- `components/dashboard/deploy-agent-dialog.tsx` - Deployment UI
- `app/dashboard/integrations/page.tsx` - OAuth connection UI
- `app/dashboard/agents-lab/page.tsx` - Agent management

**Services:**
- `lib/services/github.service.ts` - PR creation logic
- `lib/services/github.encryption.ts` - Token encryption

**Database:**
- `prisma/schema.prisma` - AgentSchedule, GitHubIntegration models

---

## Success Metrics

✅ **OAuth Integration:** Secure token storage with AES-256-GCM  
✅ **Repository Selection:** Dynamic UI with real repos from GitHub API  
✅ **Config Persistence:** Saved to AgentSchedule.config JSON field  
✅ **PR Creation:** Automated PRs with improvements and code snippets  
✅ **Error Handling:** Clear messages for all failure scenarios  
✅ **Type Safety:** Full TypeScript support with no compilation errors  

**Status:** Production-ready for Content Optimizer agent deployments
