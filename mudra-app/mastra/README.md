# Mudra AI Agents - Mastra Framework

Two specialized AI agents for Answer Engine Optimization (AEO) and Growth Intelligence using [Mastra](https://mastra.ai) framework with E2B Code Interpreter sandboxes.

## 🤖 Agents

### 1. AEO/GEO Optimizer Agent
Optimizes content and code for maximum AI citation visibility across ChatGPT, Claude, Perplexity, and Google AI Overviews.

**Capabilities:**
- ✅ Codebase analysis (HTML/JSX/TSX/MD)
- ✅ JSON-LD schema generation (FAQ, Article, HowTo)
- ✅ AEO score calculation (0-100)
- ✅ Actionable optimization recommendations
- ✅ Citation probability estimation

**Tools:**
- `analyze_codebase` - Scans files for AEO/GEO compliance
- `generate_schema_markup` - Creates production-ready JSON-LD
- `calculate_aeo_score` - Scores and prioritizes improvements

### 2. Growth Opportunity Scout Agent
Discovers growth opportunities through AI citation intelligence and competitive analysis.

**Capabilities:**
- 🔍 AI citation tracking (simulated for testing)
- 🎯 Reddit thread monitoring for outreach
- 📊 Competitor citation analysis
- 💡 Content gap identification
- 🚀 Growth strategy recommendations

**Tools:**
- `search_ai_citations` - Finds top cited domains and authors
- `monitor_reddit_threads` - Identifies engagement opportunities
- `analyze_competitor_citations` - Reverse-engineers competitor success

## 📁 Project Structure

```
mudra-app/
  mastra/
    agents/
      aeo-geo-optimizer.ts       # AEO/GEO optimization agent
      growth-scout.ts            # Growth intelligence agent
    tools/
      codebase-analyzer.ts       # HTML/JSX analysis tool
      schema-generator.ts        # JSON-LD generation tool
      aeo-score-calculator.ts    # Scoring algorithm tool
      citation-tracker.ts        # AI citation search tool
      reddit-monitor.ts          # Reddit tracking tool
      competitor-analyzer.ts     # Competitor intelligence tool
    tests/
      aeo-optimizer.test.ts      # AEO agent test suite
      growth-scout.test.ts       # Growth agent test suite
    mastra.config.ts             # Mastra configuration
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

Required packages:
- `@mastra/core` - Agent orchestration framework
- `@ai-sdk/openai` - OpenAI integration for GPT-4o
- `@e2b/code-interpreter` - Secure Python sandboxes
- `zod` - Schema validation

### 2. Set Environment Variables

Create `.env.local` and add:

```env
# OpenAI API Key (required for agents)
OPENAI_API_KEY=sk-...

# E2B API Key (required for sandbox execution)
E2B_API_KEY=e2b_...

# Optional: Production citation tracking API
DIRECTGEO_API_KEY=...
```

Get E2B API key: https://e2b.dev/docs/getting-started/api-key

### 3. Run Tests

Test AEO Optimizer Agent:
```bash
npm run test:aeo-agent
```

Test Growth Scout Agent:
```bash
npm run test:growth-agent
```

## 💡 Usage Examples

### AEO/GEO Optimizer Agent

```typescript
import { aeoGeoOptimizerAgent } from './mastra/agents/aeo-geo-optimizer';

// Analyze a webpage
const response = await aeoGeoOptimizerAgent.generate([
  {
    role: 'user',
    content: 'Analyze https://example.com/blog-post for AEO optimization'
  }
]);

console.log(response.text); // Full analysis with score and recommendations
```

**Example Prompts:**
- "Analyze this HTML for AEO/GEO issues: [paste HTML]"
- "Generate FAQ schema for these 5 questions: ..."
- "Calculate AEO score for a page with [characteristics]"
- "Create Article schema with author credentials"
- "What's the best schema strategy for a tutorial page?"

### Growth Scout Agent

```typescript
import { growthScoutAgent } from './mastra/agents/growth-scout';

// Find citation opportunities
const response = await growthScoutAgent.generate([
  {
    role: 'user',
    content: 'Find who AI cites most for "React hooks" and analyze their strategy'
  }
]);

console.log(response.text); // Citation analysis + recommendations
```

**Example Prompts:**
- "Find Reddit threads about [topic] for outreach"
- "Analyze competitors: [URLs] for [topic]"
- "What content gaps exist in [niche]?"
- "Show me trending topics being cited by AI"
- "Build a growth strategy for [topic]"

## 🧪 Testing

### AEO Agent Tests

```bash
npm run test:aeo-agent
```

Tests:
1. ✅ Codebase analysis with real HTML
2. ✅ FAQ schema generation
3. ✅ AEO score calculation
4. ✅ End-to-end optimization workflow

### Growth Agent Tests

```bash
npm run test:growth-agent
```

Tests:
1. ✅ Citation search and analysis
2. ✅ Reddit thread monitoring
3. ✅ Competitor intelligence
4. ✅ Multi-tool growth strategy
5. ✅ Trending topics discovery
6. ✅ Outreach timing optimization

## 🛠 Architecture

### E2B Sandbox Integration

All tools use E2B Code Interpreter for secure Python execution:

```typescript
const sandbox = await CodeInterpreter.create();

try {
  // Install packages
  await sandbox.notebook.execCell(`
    import sys
    !{sys.executable} -m pip install beautifulsoup4 lxml
  `);

  // Execute Python analysis
  const execution = await sandbox.notebook.execCell(pythonScript);
  
  // Parse results
  const result = JSON.parse(execution.logs.stdout.join('\n'));
  
  return result;
} finally {
  await sandbox.close(); // Always cleanup
}
```

**Benefits:**
- ✅ Secure isolated execution
- ✅ No local dependencies
- ✅ Python ML libraries (BeautifulSoup, pandas, etc.)
- ✅ Automatic resource cleanup

### Agent Instructions

Each agent has comprehensive instructions covering:
- Core principles and strategies
- Tool usage patterns
- Response formatting
- Example interactions
- Error handling
- Advanced tactics

See `agents/aeo-geo-optimizer.ts` and `agents/growth-scout.ts` for full instructions.

## 📊 AEO Scoring Breakdown

**Total: 100 points**
- Schema Markup: 20 points
- FAQ Sections: 15 points
- Header Structure: 15 points
- Content Structure (Lists/Tables): 20 points
- Citations & Statistics: 10 points
- Meta Descriptions: 10 points
- Author Authority: 10 points

**Grades:**
- A+ (95-100): Elite AI visibility
- A (85-94): Strong citation potential
- B (70-84): Good foundation, needs polish
- C (55-69): Significant gaps to fix
- D (40-54): Major optimization needed
- F (<40): Critical overhaul required

**Citation Probability:**
- 90+ score = 85% citation chance
- 70-89 = 60% chance
- 50-69 = 35% chance
- <50 = 15% chance

## 🔧 Customization

### Adding New Tools

```typescript
import { createTool } from '@mastra/core';
import { CodeInterpreter } from '@e2b/code-interpreter';
import { z } from 'zod';

export const myCustomTool = createTool({
  id: 'my_tool',
  description: 'What this tool does...',
  inputSchema: z.object({
    param: z.string().describe('Parameter description'),
  }),
  outputSchema: z.object({
    result: z.string(),
  }),
  execute: async ({ context, input }) => {
    const sandbox = await CodeInterpreter.create();
    
    try {
      // Your logic here
      return { result: 'output' };
    } finally {
      await sandbox.close();
    }
  },
});
```

### Modifying Agent Instructions

Edit agent instructions in:
- `mastra/agents/aeo-geo-optimizer.ts` - AEO agent behavior
- `mastra/agents/growth-scout.ts` - Growth agent behavior

Instructions control:
- Tone and personality
- Response formatting
- Tool usage patterns
- Best practices
- Error handling

## 🚨 Important Notes

### Simulation Mode

Current tools use **simulation mode** for testing:
- `search_ai_citations` - Generates realistic citation data
- `monitor_reddit_threads` - Simulates Reddit tracking
- `analyze_competitor_citations` - Mock competitor analysis

**For Production:**
Replace simulation logic with:
- DirectGEO API integration (citation tracking)
- Reddit API (PRAW) for real thread data
- SEO APIs (Ahrefs, SEMrush) for domain metrics
- Firecrawl for competitor content scraping

### E2B Sandbox Limits

- 15-minute execution timeout per sandbox
- Resource limits: 2GB RAM, 2 vCPU
- Always call `sandbox.close()` in finally blocks
- Use connection pooling for high-volume scenarios

### Rate Limiting

When integrating real APIs:
- Implement exponential backoff
- Add request queuing
- Cache results when possible
- Use batch operations

## 📖 Resources

- [Mastra Documentation](https://docs.mastra.ai)
- [E2B Code Interpreter](https://e2b.dev/docs/code-interpreter)
- [Schema.org Markup](https://schema.org)
- [AEO Best Practices](https://www.semrush.com/blog/answer-engine-optimization/)
- [Reddit API (PRAW)](https://praw.readthedocs.io)

## 🤝 Contributing

When adding new features:
1. Create tool in `mastra/tools/`
2. Add to agent in `mastra/agents/`
3. Write tests in `mastra/tests/`
4. Update this README
5. Document with JSDoc comments

## 📝 License

Part of Mudra MVP - GEO Platform
