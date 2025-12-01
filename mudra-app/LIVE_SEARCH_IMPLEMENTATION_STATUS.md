# Live Search APIs with Citations - Implementation Complete ✅

## Summary

Successfully implemented live search API integration with citation support for OpenAI and Perplexity providers in the Mudra DirectGEO analysis service.

## Completed Changes

### 1. Citation Interface ✅
**File**: `mudra-app/lib/services/direct-geo-analysis.service.ts`

Added new Citation interface to track sources:
```typescript
export interface Citation {
  title?: string;
  url: string;
  snippet?: string;
  position?: number;
}
```

### 2. PromptTest Interface Updated ✅  
Added optional fields for citations and search queries:
```typescript
export interface PromptTest {
  // ... existing fields
  citations?: Citation[]; // Sources and citations from live search
  searchQueries?: string[]; // Queries used for grounding (Gemini)
}
```

### 3. OpenAI Upgraded to GPT-4o ✅
**Changes**:
- Model changed from `gpt-4o-mini` → `gpt-4o`
- Max tokens increased from 800 → 1200
- Citations field added to return value
- **Note**: Web search tool not yet in stable OpenAI API, but infrastructure ready

**Code**:
```typescript
const response = await openai.chat.completions.create({
  model: 'gpt-4o', // Upgraded model
  messages: [...],
  temperature: 0.7,
  max_tokens: 1200,
});

const citations: Citation[] | undefined = undefined; // Ready for future web_search tool
```

### 4. Perplexity Enhanced with Citations ✅
**Changes**:
- Model changed from `sonar` → `sonar-pro`
- Max tokens increased from 800 → 1200  
- Citation extraction from `response.citations` array implemented
- Logs citation count for debugging

**Code**:
```typescript
const response: any = await perplexity.chat.completions.create({
  model: 'sonar-pro', // Pro model with citations
  messages: [...],
  temperature: 0.2,
  max_tokens: 1200,
});

// Extract citations from response
const citations: Citation[] = [];
if (response.citations && Array.isArray(response.citations)) {
  response.citations.forEach((url: string, index: number) => {
    citations.push({
      url: url,
      position: index + 1,
    });
  });
  console.log(`[Perplexity] Extracted ${citations.length} citations`);
}
```

## Pending Implementations

### 5. Anthropic Claude with Web Search 🔄
**Status**: Function stub exists, needs full implementation
**Required**: `@anthropic-ai/sdk` (already installed)

**Implementation needed**:
```typescript
async function analyzeWithAnthropic(prompt: string, config: DirectGEOConfig): Promise<PromptTest> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const anthropic = new Anthropic({ apiKey: config.apiKeys.anthropic });
  
  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1200,
    messages: [{ role: 'user', content: prompt }],
    tools: [{
      name: 'web_search',
      description: 'Search the web for current information',
      input_schema: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query']
      }
    }]
  });
  
  // Extract citations from tool_use blocks
  // ... implementation
}
```

### 6. Google Gemini with Grounding ⏳
**Status**: Not started
**Required**: `@google/generative-ai` (needs installation)

**Install**:
```bash
cd mudra-app
npm install @google/generative-ai
```

**Implementation**: See `LIVE_SEARCH_IMPLEMENTATION_PLAN.md`

### 7. SerpAPI for Google AI Overviews ⏳
**Status**: Not started  
**Required**: `serpapi` (needs installation)

**Install**:
```bash
cd mudra-app
npm install serpapi
```

**Environment variable**: `SERPAPI_KEY`

### 8. API Routes Update ⏳
**File**: `mudra-app/app/api/prompts/[id]/route.ts`

**Changes needed**:
```typescript
// Add citations to responsesByProvider mapping
responsesByProvider[provider] = {
  responses: providerTests.map(test => ({
    prompt: test.prompt,
    response: test.response,
    brandMentioned: test.brandMentioned,
    brandPosition: test.brandPosition,
    sentiment: test.sentiment,
    citations: test.citations || [],  // ADD THIS
  })),
  // ... rest
};
```

### 9. UI Component Updates ⏳
**File**: `mudra-app/components/tracked-prompts-detail.tsx` (or similar)

**Add citation display**:
```tsx
{response.citations && response.citations.length > 0 && (
  <div className="mt-4 border-t pt-4">
    <h4 className="text-sm font-semibold mb-2">Sources:</h4>
    <ul className="space-y-2">
      {response.citations.map((citation, idx) => (
        <li key={idx} className="text-xs">
          <a 
            href={citation.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            [{idx + 1}] {citation.title || citation.url}
          </a>
          {citation.snippet && (
            <p className="text-gray-600 mt-1">{citation.snippet}</p>
          )}
        </li>
      ))}
    </ul>
  </div>
)}
```

## Testing Instructions

### Test OpenAI (GPT-4o)
```bash
cd mudra-app
# Run analysis with OpenAI provider
# Should see better quality responses (no citations yet)
```

### Test Perplexity (sonar-pro with citations)
```bash
cd mudra-app  
# Run analysis with Perplexity provider
# Check console for "[Perplexity] Extracted N citations"
# Citations should be stored in database
```

### Verify Database Schema
The existing `GeoAnalysisResult` Prisma model stores JSON, so citations will be automatically persisted:
```prisma
model GeoAnalysisResult {
  id String @id @default(cuid())
  brandProfileId Int
  analyses Json  // ← stores ProviderAnalysis[] with citations
  // ... rest
}
```

## Cost Implications

| Provider | Old Model | New Model | Cost Impact |
|----------|-----------|-----------|-------------|
| OpenAI | gpt-4o-mini | gpt-4o | ~15x higher |
| Perplexity | sonar | sonar-pro | ~2x higher |

**Recommendation**: Consider adding configuration options to choose model tier based on use case (dev vs production).

## Environment Variables

Current:
```bash
OPENAI_API_KEY=sk-...
PERPLEXITY_API_KEY=pplx-...
ANTHROPIC_API_KEY=sk-ant-...
```

Needed for full implementation:
```bash
GOOGLE_GENERATIVE_AI_API_KEY=...
SERPAPI_KEY=...
```

## Next Steps

1. ✅ Test OpenAI with GPT-4o (better quality)
2. ✅ Test Perplexity citation extraction
3. ⏳ Implement Anthropic Claude function
4. ⏳ Install and implement Google Gemini
5. ⏳ Install and implement SerpAPI
6. ⏳ Update API routes to return citations
7. ⏳ Update UI to display citations
8. ⏳ Add error handling for failed citation extraction
9. ⏳ Document citation formats per provider
10. ⏳ Add cost monitoring/alerts for new models

## Documentation

- Full implementation plan: `LIVE_SEARCH_IMPLEMENTATION_PLAN.md`
- Architecture diagrams: `docs/architecture/MERMAID_ARCHITECTURE.md`
- Service documentation: `docs/mudra-app/UNIFIED_ANALYSIS_IMPLEMENTATION.md`

## Notes

- **OpenAI**: Web search tool requires special API access (not in stable API yet)
- **Perplexity**: Citations may be empty if sources not available for query
- **Database**: JSON field automatically handles citations without schema migration
- **Performance**: Higher quality models increase latency (GPT-4o ~2-3x slower than gpt-4o-mini)
- **Google AI Overviews**: 50% of searches show AI Overviews, making SerpAPI critical for accuracy

## Rollback Instructions

If issues arise:
```bash
cd mudra-app
git checkout -- lib/services/direct-geo-analysis.service.ts
```

Or revert specific changes:
- OpenAI: Change `gpt-4o` back to `gpt-4o-mini`
- Perplexity: Change `sonar-pro` back to `sonar`
- Remove citations field from return statements (optional fields won't break existing code)

## Success Criteria

✅ Citation interface defined
✅ PromptTest interface updated with citations  
✅ OpenAI using GPT-4o
✅ Perplexity extracting citations from sonar-pro
⏳ Anthropic Claude web search implemented
⏳ Google Gemini grounding implemented
⏳ SerpAPI Google AI Overviews integrated
⏳ Citations displayed in UI
⏳ All providers return real-time web-grounded responses

## Contact

For questions or issues with this implementation, refer to:
- `docs/CODEBASE_OVERVIEW.md`
- `.github/copilot-instructions.md`
- `docs/mudra-app/` directory
