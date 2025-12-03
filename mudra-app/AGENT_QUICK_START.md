# Quick Start: Deploy AEO/GEO Agent

## What You Built

Your AEO/GEO optimization agent can now:
1. **Analyze** user websites for AI optimization opportunities
2. **Generate** code changes (schema markup, FAQs, headers)
3. **Create** GitHub pull requests with the changes
4. **Track** all optimizations in the database

## Setup (5 minutes)

### 1. Push Database Changes
```bash
cd mudra-app
npx prisma db push
```

This creates 4 new tables:
- `DeployedAgent` - Track deployed agents
- `AgentTask` - Track agent executions
- `AgentOptimization` - Track code changes
- `GitHubIntegration` - Store GitHub credentials

### 2. Add Environment Variables
```bash
# mudra-app/.env.local

# GitHub OAuth (get from https://github.com/settings/developers)
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_secret_here
NEXT_PUBLIC_GITHUB_CLIENT_ID=your_client_id_here

# Generate encryption key for tokens
GITHUB_TOKEN_ENCRYPTION_KEY=$(openssl rand -hex 32)
```

### 3. Install Dependencies (if needed)
```bash
npm install zod  # Already installed
```

## Usage in Agent Lab

### Option 1: Use the Hook (Recommended)
```tsx
import { useAgentOperations } from '@/hooks/use-agent-operations';

function AgentsLabPage() {
  const {
    agents,
    githubIntegration,
    deployAgent,
    executeAgent,
    connectGitHub,
  } = useAgentOperations();

  // 1. Connect GitHub
  <Button onClick={connectGitHub}>
    Connect GitHub
  </Button>

  // 2. Deploy Agent
  const handleDeploy = async () => {
    await deployAgent(
      'LLMs.txt Indexer',
      'Builds AI-facing index',
      'EmiCorleone/mudramvp',
      'main'
    );
  };

  // 3. Trigger Actions
  <Button onClick={() => executeAgent(agent.id, 'analyze')}>
    Analyze Website
  </Button>
  
  <Button onClick={() => executeAgent(agent.id, 'optimize')}>
    Generate Code
  </Button>
  
  <Button onClick={() => executeAgent(agent.id, 'create_pr')}>
    Create Pull Request
  </Button>
}
```

### Option 2: Direct API Calls
```typescript
// Deploy
const response = await fetch('/api/agents/deploy', {
  method: 'POST',
  body: JSON.stringify({
    agentType: 'aeo-geo-optimizer',
    agentName: 'LLMs.txt Indexer',
    githubRepoName: 'EmiCorleone/mudramvp',
    githubBranch: 'main',
  }),
});

// Execute
await fetch('/api/agents/execute', {
  method: 'POST',
  body: JSON.stringify({
    deployedAgentId: 1,
    action: 'analyze', // or 'optimize', 'create_pr'
  }),
});
```

## Testing the Flow

### 1. Deploy Agent
```bash
# From Agent Lab UI, click "Deploy Agent"
# Or use curl:
curl -X POST http://localhost:3000/api/agents/deploy \
  -H "Content-Type: application/json" \
  -d '{
    "agentType": "aeo-geo-optimizer",
    "agentName": "LLMs.txt Indexer",
    "githubRepoName": "EmiCorleone/mudramvp"
  }'
```

**Check database:**
```sql
SELECT * FROM "DeployedAgent";
-- Should see: status="deploying" then "active"
```

### 2. Analyze Website
```bash
curl -X POST http://localhost:3000/api/agents/execute \
  -H "Content-Type: application/json" \
  -d '{
    "deployedAgentId": 1,
    "action": "analyze"
  }'
```

**Check database:**
```sql
SELECT * FROM "AgentTask" WHERE taskType='analyze';
-- Should see: status="completed", output with AEO score

SELECT * FROM "AgentOptimization";
-- Should see: recommendations like "Add FAQ schema", "Fix headers"
```

### 3. Generate Optimizations
```bash
curl -X POST http://localhost:3000/api/agents/execute \
  -H "Content-Type: application/json" \
  -d '{
    "deployedAgentId": 1,
    "action": "optimize"
  }'
```

**Check database:**
```sql
SELECT * FROM "AgentOptimization" WHERE status='applied';
-- Should see: beforeCode and afterCode populated
```

### 4. Create Pull Request
```bash
curl -X POST http://localhost:3000/api/agents/execute \
  -H "Content-Type: application/json" \
  -d '{
    "deployedAgentId": 1,
    "action": "create_pr"
  }'
```

**Check database:**
```sql
SELECT * FROM "AgentOptimization" WHERE status='pr_created';
-- Should see: pullRequestUrl populated
```

## What Happens Under the Hood

### Analysis Phase
1. Agent uses `analyzeCodebaseTool` from Mastra
2. Fetches website HTML from `brandProfile.companyWebsite`
3. Runs Python script that checks:
   - Schema markup presence
   - FAQ sections
   - Header structure (H2/H3 as questions)
   - Meta descriptions
   - Lists and tables
4. Calculates AEO score (0-100)
5. Creates `AgentOptimization` records for each issue

### Optimization Phase
1. Agent fetches pending optimizations
2. For each optimization type:
   - **schema_markup**: Generates JSON-LD using `generateSchemaMarkupTool`
   - **faq_section**: Creates HTML FAQ structure
   - **headers**: Converts headers to question format
3. Stores beforeCode and afterCode
4. Updates status to "applied"

### PR Creation Phase
1. Fetches user's encrypted GitHub token
2. Creates new branch: `aeo-optimization-{timestamp}`
3. Commits all changes with descriptive messages
4. Opens PR with:
   - Title: "🤖 AEO/GEO Optimizations (X changes)"
   - Body: Lists all optimizations with impact
5. Updates optimizations with PR URL

## Example Output

### Analysis Output
```json
{
  "score": 42,
  "grade": "D",
  "recommendations": [
    {
      "category": "schema",
      "title": "Add FAQPage schema",
      "priority": "high",
      "impact": "30% increase in AI citations"
    },
    {
      "category": "headers",
      "title": "Convert 5 headers to questions",
      "priority": "medium",
      "impact": "15% increase in relevance"
    }
  ]
}
```

### Generated Code Example
```html
<!-- Before -->
<h2>Features</h2>
<p>We offer great features</p>

<!-- After -->
<h2>What features does our product offer?</h2>
<p>We offer great features including X, Y, and Z</p>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "What features does our product offer?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "We offer great features including X, Y, and Z"
    }
  }]
}
</script>
```

## Next Steps

1. **Add GitHub Connect Button** to Agent Lab UI
2. **Show Agent Status** in real-time (use polling or webhooks)
3. **Display Optimizations** in a table with before/after preview
4. **Add Action Buttons** for Analyze/Optimize/Create PR
5. **Show Task History** for each agent

## Troubleshooting

**Agent stays in "deploying" status:**
- Check server logs for errors
- Verify Prisma connection
- Check if analysis task was created

**Analysis fails:**
- Verify `companyWebsite` is set in BrandProfile
- Check website is accessible
- Ensure Python dependencies are installed (for codebase-analyzer)

**PR creation fails:**
- Verify GitHub token is valid
- Check repo permissions (needs write access)
- Ensure repo name format is correct ("owner/repo")

**Database errors:**
- Run `npx prisma db push` to sync schema
- Check `DATABASE_URL` in `.env`

## Files You Need to Update

1. **`app/dashboard/agents-lab/page.tsx`**
   - Import `useAgentOperations` hook
   - Add GitHub connect button
   - Update `handleDeploy` to call `deployAgent()`
   - Add action buttons for analyze/optimize/create_pr

2. **`components/dashboard/deploy-agent-dialog.tsx`**
   - Pass deployment callback to parent
   - Show GitHub connection status

That's it! Your AEO/GEO agent is now fully functional and can make real changes to user codebases! 🎉
