# Quick Start Guide - Mastra AI Agents

## Setup (5 minutes)

### 1. Install Dependencies
```bash
cd mudra-app
npm install
```

This installs:
- `@mastra/core` - Agent framework
- `@ai-sdk/openai` - GPT-4o integration  
- `@e2b/code-interpreter` - Python sandboxes
- `zod` - Schema validation

### 2. Get API Keys

**OpenAI (Required):**
1. Go to https://platform.openai.com/api-keys
2. Click "Create new secret key"
3. Copy key starting with `sk-proj-...`

**E2B (Required):**
1. Sign up at https://e2b.dev
2. Get API key from https://e2b.dev/docs/getting-started/api-key
3. Copy key starting with `e2b_...`

### 3. Configure Environment

```bash
# In mudra-app/.env.local, add:
OPENAI_API_KEY=sk-proj-your-key-here
E2B_API_KEY=e2b_your-key-here
```

### 4. Run First Test

```bash
# Test AEO Optimizer Agent
npm run test:aeo-agent

# Test Growth Scout Agent  
npm run test:growth-agent
```

## Using the Agents

### AEO/GEO Optimizer

```typescript
import { aeoGeoOptimizerAgent } from './mastra/agents/aeo-geo-optimizer';

const response = await aeoGeoOptimizerAgent.generate([
  {
    role: 'user',
    content: 'Analyze https://example.com/blog for AEO issues'
  }
]);

console.log(response.text);
```

**Common Tasks:**
- Analyze webpage: `"Analyze https://example.com for AEO"`
- Generate schema: `"Create FAQ schema for these questions: ..."`
- Score content: `"Calculate AEO score for [describe page]"`
- Get recommendations: `"How can I improve AI visibility for [topic]?"`

### Growth Scout

```typescript
import { growthScoutAgent } from './mastra/agents/growth-scout';

const response = await growthScoutAgent.generate([
  {
    role: 'user',
    content: 'Find citation opportunities for "React hooks"'
  }
]);

console.log(response.text);
```

**Common Tasks:**
- Find citations: `"Who gets cited most for [topic]?"`
- Reddit outreach: `"Find Reddit threads about [topic] for engagement"`
- Competitor intel: `"Analyze these competitors: [URLs]"`
- Content gaps: `"What content gaps exist in [niche]?"`

## Example Workflows

### Workflow 1: Optimize Existing Content

```typescript
// 1. Analyze current state
const analysis = await aeoGeoOptimizerAgent.generate([
  { 
    role: 'user', 
    content: 'Analyze https://myblog.com/post for AEO score' 
  }
]);

// 2. Generate missing schema
const schema = await aeoGeoOptimizerAgent.generate([
  {
    role: 'user',
    content: 'Generate FAQ schema for questions: [list questions]'
  }
]);

// 3. Calculate improvement
const newScore = await aeoGeoOptimizerAgent.generate([
  {
    role: 'user',
    content: 'Calculate score after adding FAQ schema and fixing headers'
  }
]);
```

### Workflow 2: Competitive Research

```typescript
// 1. Find citation leaders
const leaders = await growthScoutAgent.generate([
  {
    role: 'user',
    content: 'Find top 5 cited domains for "Next.js tutorials"'
  }
]);

// 2. Analyze competitors
const analysis = await growthScoutAgent.generate([
  {
    role: 'user',
    content: 'Analyze these competitors: [URLs from step 1]'
  }
]);

// 3. Find content gaps
const gaps = await growthScoutAgent.generate([
  {
    role: 'user',
    content: 'Based on competitor analysis, what content should I create?'
  }
]);
```

### Workflow 3: Outreach Campaign

```typescript
// 1. Find trending discussions
const threads = await growthScoutAgent.generate([
  {
    role: 'user',
    content: 'Find high-engagement Reddit threads about [topic]'
  }
]);

// 2. Optimize content for topic
const content = await aeoGeoOptimizerAgent.generate([
  {
    role: 'user',
    content: 'Help me create AI-optimized content about [topic from Reddit]'
  }
]);

// 3. Get outreach strategy
const strategy = await growthScoutAgent.generate([
  {
    role: 'user',
    content: 'How should I engage in thread: [URL]?'
  }
]);
```

## Understanding Results

### AEO Score Breakdown

```
Score: 68/100 (Grade: C)

Schema Markup: 5/20    ❌ Critical - Add FAQ schema
FAQ Sections: 0/15     ❌ Critical - Create FAQ
Headers: 12/15         ✅ Good - Minor tweaks
Lists/Tables: 18/20    ✅ Excellent
Citations: 6/10        ⚠️  Add 2 more statistics
Meta: 8/10             ✅ Good
Authority: 9/10        ✅ Excellent

Citation Probability: 35% → Can reach 75% with fixes

Priority Actions:
1. Add FAQ schema (+15 pts) - 2 hours
2. Create FAQ section (+12 pts) - 3 hours
3. Add 2 more citations (+4 pts) - 30 mins

Total Impact: +31 points (68 → 99/100)
```

### Citation Intelligence

```
Topic: "React Hooks"

Top Cited Domain: react.dev
- Citations: 450/100 queries
- Cited by: ChatGPT, Claude, Perplexity
- Why: Official docs + FAQ schema + Expert content

Your Opportunity:
- Current Market: Saturated (5+ strong competitors)
- Content Gap: "React Hooks for beginners"
- Estimated Difficulty: Medium
- Potential Traffic: 8,500/month

Recommendation:
Create beginner-focused tutorial with:
- FAQ section (10 questions)
- Step-by-step examples
- Common mistakes section
- Video walkthrough

Expected Impact: 300-500 monthly citations
```

## Troubleshooting

### Error: "OpenAI API key not found"
```bash
# Check .env.local exists
ls -la .env.local

# Verify key format (should start with sk-proj-)
cat .env.local | grep OPENAI

# Restart terminal/IDE to reload environment
```

### Error: "E2B sandbox timeout"
- Sandboxes timeout after 15 minutes
- Large HTML analysis may take 30-60 seconds
- Check E2B dashboard for quota limits
- Solution: Break large tasks into smaller chunks

### Error: "Module not found: @mastra/core"
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Simulation vs Production
Current version uses **simulated data** for:
- Citation tracking
- Reddit monitoring
- Competitor metrics

For production:
- Replace with real APIs (see README.md)
- Current data is directionally accurate
- Good for testing and development

## Next Steps

1. **Run all tests** - Verify setup works
2. **Try example prompts** - Get familiar with agents
3. **Analyze your site** - Use AEO agent on real content
4. **Research competitors** - Use Growth agent for intel
5. **Customize agents** - Modify instructions for your use case
6. **Add real APIs** - Replace simulation mode (production)

## Support

- **Documentation**: See `mastra/README.md`
- **Examples**: Check `mastra/tests/*.test.ts`
- **Mastra Docs**: https://docs.mastra.ai
- **E2B Docs**: https://e2b.dev/docs

---

**Ready to optimize for AI visibility? Start with:**
```bash
npm run test:aeo-agent
```
