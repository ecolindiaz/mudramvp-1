# Agent Lab Testing Guide

This guide walks you through testing the complete Agent Lab implementation.

## Prerequisites

1. ✅ Prisma schema migrated: `npx prisma db push`
2. ✅ Prisma Client generated: `npx prisma generate`
3. ✅ Mastra dependencies installed: `@mastra/core`, `@e2b/code-interpreter`
4. ✅ Environment variables configured in `.env.local`

## Environment Setup

Ensure these variables are in `mudra-app/.env.local`:

```env
# GitHub OAuth
GITHUB_CLIENT_ID=Ov23li3Acc4cecvAsdml
GITHUB_CLIENT_SECRET=05202cf3577631217f2c3d4b0ae661b5f55db3cb

# Token Encryption
GITHUB_TOKEN_ENCRYPTION_KEY=49e07043c1d5b9a326673ccae4b61f15295d0578abb0bc075c507ca9c2489496

# E2B Sandbox
E2B_API_KEY=e2b_04f07e4cd7ba5339c89786c7ba1e50c79b0a81f8

# Database
DATABASE_URL=postgresql://...
```

## Testing Workflow

### 1. Start Development Server

```powershell
cd mudra-app
npm run dev
```

Server should start on `http://localhost:3000`

### 2. Test Database Tables

Run the test script to verify tables exist:

```powershell
cd mudra-app
node test-agent-execution.js
```

This will:
- ✅ Find or create a test brand profile
- ✅ Deploy a test agent
- ✅ Create an analyze task
- ✅ Show existing optimizations (if any)
- ✅ Provide curl commands for API testing

### 3. Test Agent Deployment API

**Deploy a new agent:**

```powershell
# PowerShell
$body = @{
    brandProfileId = 1
    agentType = "aeo-geo-optimizer"
    agentName = "Test AEO Optimizer"
    githubRepoName = "EmiCorleone/mudramvp"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3000/api/agents/deploy" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body
```

**List deployed agents:**

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/agents/deploy?brandProfileId=1" `
  -Method GET
```

### 4. Test Agent Execution API

**Analyze action:**

```powershell
$body = @{
    deployedAgentId = 1
    action = "analyze"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3000/api/agents/execute" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body
```

**Optimize action:**

```powershell
$body = @{
    deployedAgentId = 1
    action = "optimize"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3000/api/agents/execute" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body
```

**Create PR action:**

```powershell
$body = @{
    deployedAgentId = 1
    action = "create_pr"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3000/api/agents/execute" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body
```

### 5. Test GitHub Integration

**Check connection status:**

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/integrations/github" `
  -Method GET
```

**Connect GitHub (requires session):**

```powershell
$body = @{
    accessToken = "ghp_xxxxxxxxxxxxxxxxxxxx"
    githubUserId = "12345"
    githubUsername = "testuser"
    avatarUrl = "https://avatars.githubusercontent.com/u/12345"
    scope = "repo"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3000/api/integrations/github" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body
```

**List repositories:**

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/integrations/github/repositories" `
  -Method GET
```

### 6. Test via Agent Lab UI

1. Navigate to `http://localhost:3000/dashboard/agents-lab`
2. Click "Deploy Agent" button
3. Fill in agent details:
   - Agent Type: AEO/GEO Optimizer
   - Agent Name: Test Agent
   - GitHub Repo: EmiCorleone/mudramvp
4. Click "Deploy"
5. Wait for deployment confirmation
6. Click "Analyze" button on deployed agent
7. Monitor task status in database
8. Click "Optimize" when analysis complete
9. Click "Create PR" when optimizations ready
10. Verify PR created in GitHub

## Verification Checklist

### Database Verification

```sql
-- Check deployed agents
SELECT * FROM "DeployedAgent";

-- Check agent tasks
SELECT * FROM "AgentTask" ORDER BY "createdAt" DESC;

-- Check optimizations
SELECT * FROM "AgentOptimization" ORDER BY "createdAt" DESC;

-- Check GitHub integration
SELECT * FROM "GitHubIntegration";
```

Run in Prisma Studio:

```powershell
cd mudra-app
npx prisma studio
```

### API Response Verification

**Successful deployment response:**
```json
{
  "success": true,
  "agent": {
    "id": 1,
    "agentType": "aeo-geo-optimizer",
    "status": "active",
    "deployedAt": "2024-01-XX..."
  }
}
```

**Successful analyze response:**
```json
{
  "success": true,
  "task": {
    "id": 1,
    "status": "completed",
    "output": {
      "score": 65,
      "recommendations": [...],
      "optimizationsCreated": 5
    }
  }
}
```

**Successful PR creation response:**
```json
{
  "success": true,
  "task": {
    "id": 3,
    "status": "completed",
    "output": {
      "pullRequestUrl": "https://github.com/user/repo/pull/123",
      "optimizationsIncluded": 5
    }
  }
}
```

## Common Issues

### Issue: TypeScript errors for Prisma models

**Symptoms:**
- `Property 'deployedAgent' does not exist on type 'PrismaClient'`
- `Property 'githubIntegration' does not exist on type 'User'`

**Solution:**
1. Restart VS Code TypeScript server:
   - Press `Ctrl+Shift+P`
   - Type "TypeScript: Restart TS Server"
   - Press Enter
2. Or reload VS Code window:
   - Press `Ctrl+Shift+P`
   - Type "Developer: Reload Window"
   - Press Enter

### Issue: "Unauthorized" error

**Symptoms:**
- API returns 401 Unauthorized

**Solution:**
- Ensure you're logged in via NextAuth
- Check session in browser DevTools → Application → Cookies
- Login at `http://localhost:3000/login`

### Issue: "GitHub not connected"

**Symptoms:**
- PR creation fails with "GitHub not connected"

**Solution:**
1. Complete GitHub OAuth flow
2. Or manually insert GitHub integration via Prisma Studio
3. Ensure access token is encrypted with correct key

### Issue: Agent timeout

**Symptoms:**
- Analyze action takes too long or times out

**Solution:**
- Check E2B_API_KEY is valid
- Verify Mastra agent file exists: `mudra-app/mastra/agents/aeo-geo-optimizer.ts`
- Check console logs for [Agent] prefix messages
- Increase timeout in executeAgentTask function

### Issue: No optimizations created

**Symptoms:**
- Analyze completes but no AgentOptimization records

**Solution:**
- Check agent response parsing in analyzeCodebase function
- Verify JSON format from agent matches expected structure
- Look for errors in console logs
- Test with simpler website URL

## Advanced Testing

### Test with Real GitHub Repo

1. Create a test repository on GitHub
2. Enable GitHub OAuth app
3. Connect GitHub account via UI
4. Deploy agent with real repo name
5. Run analyze → optimize → create_pr workflow
6. Verify PR appears in GitHub repository
7. Review code changes in PR diff
8. Merge PR to apply changes

### Test with Multiple Agents

1. Deploy 3 agents for same brand profile
2. Run analyze on all 3 simultaneously
3. Verify task isolation (no cross-contamination)
4. Check each agent has separate optimizations
5. Create PRs from different agents
6. Verify unique branch names

### Load Testing

```powershell
# Deploy 10 agents
for ($i=1; $i -le 10; $i++) {
  $body = @{
    brandProfileId = 1
    agentType = "aeo-geo-optimizer"
    agentName = "Agent $i"
  } | ConvertTo-Json
  
  Invoke-WebRequest -Uri "http://localhost:3000/api/agents/deploy" `
    -Method POST `
    -Headers @{"Content-Type"="application/json"} `
    -Body $body
}

# Trigger analyze on all
for ($i=1; $i -le 10; $i++) {
  $body = @{
    deployedAgentId = $i
    action = "analyze"
  } | ConvertTo-Json
  
  Start-Job -ScriptBlock {
    Invoke-WebRequest -Uri "http://localhost:3000/api/agents/execute" `
      -Method POST `
      -Headers @{"Content-Type"="application/json"} `
      -Body $using:body
  }
}

# Check job status
Get-Job | Wait-Job
Get-Job | Receive-Job
```

## Monitoring

### Watch logs in real-time

```powershell
# In development mode, all logs appear in terminal
npm run dev

# Look for [Agent] prefix in output
# Example:
# [Agent] Starting analysis for https://example.com
# [Agent] Step: Analyzing website structure...
# [Agent] Analysis complete: {...}
```

### Monitor database changes

```powershell
# Keep Prisma Studio open in another window
npx prisma studio

# Refresh tables to see new records:
# - DeployedAgent
# - AgentTask
# - AgentOptimization
# - GitHubIntegration
```

## Success Criteria

✅ Agent deployment creates DeployedAgent record  
✅ Analyze action creates AgentTask with status="completed"  
✅ Analyze creates multiple AgentOptimization records  
✅ Optimize action updates optimizations with afterCode  
✅ Create PR action creates GitHub pull request  
✅ PR includes all applied optimizations  
✅ GitHub integration stores encrypted token  
✅ Repository listing works  
✅ No TypeScript errors  
✅ No runtime errors in console  

## Next Steps

After successful testing:
1. ✅ Mark all backend implementation as complete
2. ⏳ Integrate useAgentOperations hook in UI
3. ⏳ Add GitHub connect button
4. ⏳ Add agent deployment form
5. ⏳ Add action buttons (Analyze, Optimize, Create PR)
6. ⏳ Display agent status and task history
7. ⏳ Show optimizations with code diff
8. ⏳ Deploy to production (Vercel)

## Documentation

- **Architecture:** `AGENT_LAB_INTEGRATION.md`
- **Quick Start:** `AGENT_QUICK_START.md`
- **Complete Summary:** `AGENT_LAB_COMPLETE.md`
- **Project Context:** `.github/copilot-instructions.md`

## Support

If you encounter issues:
1. Check this testing guide first
2. Review error messages in console
3. Verify environment variables
4. Check database state in Prisma Studio
5. Review Prisma migrations
6. Restart development server
7. Restart VS Code TypeScript server

Happy Testing! 🚀
