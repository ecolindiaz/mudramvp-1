# Live Search APIs with Citations - Implementation Summary

## Completed Changes ✅

### 1. Citation Interface Added
```typescript
export interface Citation {
  title?: string;
  url: string;
  snippet?: string;
  position?: number;
}
```

### 2. PromptTest Interface Updated
Added optional fields:
- `citations?: Citation[]` - Sources and citations from live search
- `searchQueries?: string[]` - Queries used for grounding (Gemini)

### 3. OpenAI GPT-4o Integration
- **Model**: Changed from `gpt-4o-mini` to `gpt-4o` for better quality
- **Status**: ❌ Web search tool not yet available in stable API
- **Citations**: Will be added when `web_search` tool becomes available

### 4. Perplexity Live Search
- **Model**: Using `sonar-pro` for enhanced search and citations
- **Citations**: Extracted from `response.citations` array
- **Status**: ✅ Ready for testing

### 5. Anthropic Claude Web Search
- **Model**: `claude-3-5-sonnet-20241022`
- **Web Search**: Implemented with `web_search` tool
- **Status**: ✅ Implemented, needs citation extraction refinement

## Pending Implementations 🔄

### 6. Google Gemini with Grounding
**Package needed**: `@google/generative-ai`

```bash
npm install @google/generative-ai
```

**Implementation**:
```typescript
async function analyzeWithGemini(prompt: string, config: DirectGEOConfig): Promise<PromptTest> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(config.apiKeys.google);
  
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-pro',
    tools: [{
      googleSearch: {}  // Enable google_search tool
    }]
  });
  
  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();
  
  // Extract citations from groundingMetadata
  const citations: Citation[] = [];
  if (response.groundingMetadata) {
    const metadata = response.groundingMetadata;
    if (metadata.searchEntryPoint && metadata.searchEntryPoint.renderedContent) {
      // Extract sources from grounding metadata
      metadata.groundingChunks?.forEach((chunk, index) => {
        if (chunk.web) {
          citations.push({
            url: chunk.web.uri,
            title: chunk.web.title,
            position: index + 1
          });
        }
      });
    }
  }
  
  // ... rest of analysis logic
}
```

### 7. SerpAPI for Google AI Overviews
**Package needed**: `serpapi`

```bash
npm install serpapi
```

**Implementation**:
```typescript
async function analyzeWithGoogleAIO(prompt: string, config: DirectGEOConfig): Promise<PromptTest> {
  const { getJson } = await import('serpapi');
  
  const result = await getJson({
    engine: 'google',
    q: prompt,
    api_key: process.env.SERPAPI_KEY,
    hl: 'en',
    gl: 'us'
  });
  
  // Extract AI Overview
  const aiOverview = result.ai_overview;
  const text = aiOverview?.text || '';
  
  // Extract sources
  const citations: Citation[] = [];
  aiOverview?.sources?.forEach((source, index) => {
    citations.push({
      url: source.link,
      title: source.title,
      snippet: source.snippet,
      position: index + 1
    });
  });
  
  // ... rest of analysis logic
}
```

## Environment Variables Needed

Add to `.env.local`:
```bash
# Existing
OPENAI_API_KEY=sk-...
PERPLEXITY_API_KEY=pplx-...
ANTHROPIC_API_KEY=sk-ant-...

# New additions needed
GOOGLE_GENERATIVE_AI_API_KEY=...
SERPAPI_KEY=...
```

## API Route Updates

Update `/api/prompts/[id]/route.ts` to include citations in response:

```typescript
// In responsesByProvider mapping
responsesByProvider[provider] = {
  responses: providerTests.map(test => ({
    prompt: test.prompt,
    response: test.response,
    brandMentioned: test.brandMentioned,
    brandPosition: test.brandPosition,
    sentiment: test.sentiment,
    citations: test.citations || [],  // NEW: Include citations
  })),
  // ... rest
};
```

## UI Updates

Update `mudra-app/components/tracked-prompts-detail.tsx`:

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

## Testing Checklist

- [ ] OpenAI GPT-4o returns responses (no citations yet)
- [ ] Perplexity sonar-pro extracts citations correctly
- [ ] Anthropic Claude uses web search tool
- [ ] Google Gemini extracts grounding metadata
- [ ] SerpAPI returns AI Overviews with sources
- [ ] Citations persist in database
- [ ] API returns citations in response
- [ ] UI displays citations properly

## Notes

1. **OpenAI**: Web search tool not yet in stable API. Using GPT-4o for better quality, but citations won't be available until OpenAI releases web search to stable API.

2. **Perplexity**: Already using online models (sonar-pro), just need to extract citations from response object.

3. **Anthropic**: Web search tool implemented but citation extraction needs refinement based on actual response format.

4. **Google**: 50% of searches now show AI Overviews, making SerpAPI integration critical for accurate visibility tracking.

5. **Cost Implications**: 
   - GPT-4o more expensive than gpt-4o-mini
   - Perplexity sonar-pro costs more than sonar
   - SerpAPI charges per API call
   - Consider implementing rate limiting

## Next Steps

1. Install Google Gemini and SerpAPI packages
2. Implement analyzeWithGemini function
3. Implement analyzeWithGoogleAIO function  
4. Update switch statement in analyzePromptWithProvider
5. Test citation extraction for each provider
6. Update API routes to return citations
7. Update UI components to display sources
8. Add error handling for failed citation extraction
9. Document citation formats per provider
10. Add analytics for citation quality metrics
