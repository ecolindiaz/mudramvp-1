# Campaign Generation Setup Guide

## Overview
The campaign generation system uses RAG (Retrieval-Augmented Generation) with real growth hacking case studies to generate tailored marketing campaigns.

## Quick Start

### 1. Start the FAISS API (Optional but Recommended)

The FAISS API provides semantic search over growth hacking case studies for better campaign suggestions.

```bash
cd llm
pip install fastapi faiss-cpu transformers torch pydantic uvicorn
uvicorn faiss_case_study_api:app --host 0.0.0.0 --port 8000
```

**Note:** Campaign generation will still work without FAISS API, but suggestions will be less grounded in real case studies.

### 2. Ensure OpenAI API Key is Set

```bash
# In mudra-app/.env.local
OPENAI_API_KEY=sk-...
```

### 3. Start the Next.js App

```bash
cd mudra-app
npm run dev
```

### 4. Use the Campaign Generator

1. Navigate to the campaign generator page
2. Fill out your brand profile (minimum: company name & description)
3. Add campaign objectives (optional but recommended)
4. Click "Generate Campaigns"

## Recent Updates (Fixed Issues)

### What Was Wrong:
- API endpoint wasn't receiving `campaignObjective` from frontend
- No RAG integration (case studies weren't being used)
- Low token limit (512) caused incomplete campaigns
- No error handling for missing brand profile data

### What Was Fixed:
1. **API Route** (`app/api/llm/generate/route.ts`):
   - Now accepts and passes `campaignObjective` to prompt builder
   - Automatically fetches relevant case studies via RAG if FAISS API is running
   - Increased token limit to 2048 for detailed campaigns
   - Added temperature control (0.7) for balanced creativity
   - Added proper error handling and logging

2. **Frontend** (`components/campaign-generator.tsx`):
   - Added validation for minimum brand profile data
   - Better error messages and logging
   - Shows number of case studies used (in console)
   - Validates that campaigns were actually generated

## Architecture

```
User Input (Brand Profile + Objectives)
    ↓
Frontend (campaign-generator.tsx)
    ↓ POST /api/llm/generate
API Route (route.ts)
    ↓ Fetch case studies
FAISS API (localhost:8000) [Optional]
    ↓ Returns relevant case studies
API Route builds prompt with RAG context
    ↓
OpenAI GPT-4o
    ↓ Generates campaigns
Frontend displays 3 campaign cards
```

## Troubleshooting

### Issue: Empty/Placeholder Content

**Check:**
1. **Brand profile complete?** Need at least company name and description
2. **OpenAI API key set?** Check `.env.local`
3. **Check browser console:** Look for error messages
4. **Check server logs:** See what OpenAI returned

### Issue: Generic Campaigns

**Solution:**
1. Add more detail to brand profile (competitors, services, ICP)
2. Specify clear campaign objectives
3. Start FAISS API for RAG-enhanced suggestions

### Issue: "Failed to generate campaigns"

**Check:**
1. OpenAI API key is valid and has credits
2. Check server logs for detailed error
3. Try refreshing the page and generating again

## API Endpoints

### POST `/api/llm/generate`
Main campaign generation endpoint.

**Request:**
```json
{
  "brandProfile": {
    "companyName": "Mudra",
    "companyDescription": "GEO platform",
    "companyIndustry": "AI/Technology",
    "companyICP": "Startups"
  },
  "campaignObjective": "Increase brand awareness"
}
```

**Response:**
```json
{
  "result": "[{\"title\":\"Campaign 1\",\"objective\":\"...\"}]",
  "caseStudiesUsed": 10
}
```

### POST `http://localhost:8000/query-case-studies`
FAISS vector search for case studies.

**Request:**
```json
{
  "query": "SEO content strategy",
  "n_results": 10
}
```

## Files Modified

1. `mudra-app/app/api/llm/generate/route.ts` - Enhanced with RAG and better error handling
2. `mudra-app/components/campaign-generator.tsx` - Added validation and logging

## Testing

### Test Campaign Generation (without FAISS)
```bash
curl -X POST http://localhost:3000/api/llm/generate \
  -H "Content-Type: application/json" \
  -d '{
    "brandProfile": {
      "companyName": "Test Co",
      "companyDescription": "AI SaaS platform",
      "companyIndustry": "Technology"
    },
    "campaignObjective": "Increase signups"
  }'
```

### Test FAISS API
```bash
curl -X POST http://localhost:8000/query-case-studies \
  -H "Content-Type: application/json" \
  -d '{"query": "growth hacking", "n_results": 5}'
```

## Next Steps

To further improve campaign generation:

1. **Add more case studies** to `llm/dataset/twitter_case_studies.json`
2. **Implement feedback loop** - save user ratings (👍/👎) to improve suggestions
3. **Add campaign templates** for specific industries
4. **Cache case studies** for common queries
5. **Support multiple LLM providers** (Anthropic, Google)

