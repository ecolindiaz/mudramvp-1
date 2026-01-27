# Campaign API - Developer Quick Reference

## 🔐 Authentication Required for ALL Campaign Endpoints

All campaign API routes now require authentication. **No exceptions.**

---

## API Endpoints

### 1. List User's Campaigns

```typescript
GET /api/campaigns/save?status=published&limit=10&offset=0
```

**Query Parameters:**
- `status` (optional): Filter by status (`draft`, `published`, `scheduled`, `all`)
- `limit` (optional, default: 50): Number of results
- `offset` (optional, default: 0): Pagination offset

**Response:**
```json
{
  "success": true,
  "campaigns": [
    {
      "id": "cm...",
      "title": "My Campaign",
      "body": "Content...",
      "type": "blog",
      "mode": "geo",
      "status": "draft",
      "userId": "user_123",
      "brandProfileId": 1,
      "createdAt": "2026-01-27T...",
      "updatedAt": "2026-01-27T..."
    }
  ],
  "meta": {
    "total": 5,
    "limit": 10,
    "offset": 0
  }
}
```

**Notes:**
- ✅ Automatically filtered by authenticated user
- ❌ Cannot query other users' campaigns

---

### 2. Create Campaign

```typescript
POST /api/campaigns/save
Content-Type: application/json

{
  "title": "My New Campaign",
  "body": "Campaign content in Markdown",
  "type": "blog",           // optional: blog, listicle, howto, guide
  "mode": "geo",            // optional: geo, seo
  "status": "draft",        // optional: draft, published, scheduled
  "slug": "my-new-campaign", // optional
  "prompt": "Original prompt", // optional
  "icp": "Target audience",    // optional
  "keyword": "main keyword",   // optional
  "metadata": {}              // optional
}
```

**Response:**
```json
{
  "success": true,
  "campaign": { /* campaign object */ }
}
```

**Notes:**
- ✅ `userId` and `brandProfileId` are automatically set from session
- ❌ Cannot create campaigns for other users
- ⚠️ Rate limited: 60 requests/minute

---

### 3. Update Campaign

```typescript
POST /api/campaigns/save
Content-Type: application/json

{
  "id": "cm...",           // Required for updates
  "title": "Updated Title",
  "body": "Updated content",
  // ... other fields to update
}
```

**Response:**
```json
{
  "success": true,
  "campaign": { /* updated campaign */ }
}
```

**Notes:**
- ✅ Only updates campaigns you own
- ❌ Returns 403 Forbidden if you don't own the campaign
- ⚠️ Rate limited: 60 requests/minute

---

### 4. Get Single Campaign

```typescript
GET /api/campaigns/{id}
```

**Response:**
```json
{
  "success": true,
  "campaign": { /* campaign object */ }
}
```

**Notes:**
- ✅ Only returns campaigns you own
- ❌ Returns 403 Forbidden if you don't own the campaign

---

### 5. Update Campaign (PATCH)

```typescript
PATCH /api/campaigns/{id}
Content-Type: application/json

{
  "title": "New Title",
  "status": "published",
  "publishedAt": "2026-01-27T12:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "campaign": { /* updated campaign */ }
}
```

**Notes:**
- ✅ Only updates campaigns you own
- ✅ Partial updates supported (only send fields you want to change)
- ❌ Returns 403 Forbidden if you don't own the campaign

---

### 6. Delete Campaign

```typescript
DELETE /api/campaigns/{id}
```

**Response:**
```json
{
  "success": true,
  "message": "Campaign deleted"
}
```

**Notes:**
- ✅ Only deletes campaigns you own
- ❌ Returns 403 Forbidden if you don't own the campaign
- ⚠️ Permanent deletion - no undo

---

### 7. Get Active Prompts

```typescript
GET /api/campaigns/prompts?brandProfileId={id}
```

**Response:**
```json
{
  "success": true,
  "prompts": [
    {
      "id": 1,
      "text": "What are the best AI tools for...",
      "category": "Organic"
    }
  ],
  "count": 100
}
```

**Notes:**
- ✅ Only returns prompts for brand profiles you own
- ❌ Returns 403 Forbidden if you don't own the brand profile

---

### 8. Generate Campaign Content

```typescript
POST /api/campaigns/generate-content
Content-Type: application/json

{
  "type": "blog",              // blog, listicle, howto, guide
  "mode": "geo",               // geo, seo
  "prompt": "AI tools for startups",
  "icp": "Early-stage founders",
  "keyword": "AI startup tools",
  "title": "Best AI Tools"     // optional
}
```

**Response:**
```json
{
  "success": true,
  "title": "10 Best AI Tools for Startups in 2026",
  "body": "## Introduction\n\n...",
  "metadata": {
    "type": "blog",
    "mode": "geo",
    "wordCount": 1500,
    "generatedAt": "2026-01-27T..."
  }
}
```

**Notes:**
- ⚠️ Rate limited: **5 requests/minute** (AI operations are expensive)
- 💰 Uses OpenAI API (GPT-4) - costs apply
- ✅ Requires authentication

---

### 9. Generate Prompts for Brand

```typescript
POST /api/campaigns/generate-prompts
Content-Type: application/json

{
  "brandProfileId": 1
}
```

**Response:**
```json
{
  "success": true,
  "prompts": 100,
  "breakdown": [
    { "category": "Organic", "count": 40 },
    { "category": "Competitor", "count": 30 },
    { "category": "How-to Guides", "count": 20 },
    { "category": "Brand-Specific", "count": 10 }
  ],
  "message": "Successfully generated 100 prompts"
}
```

**Notes:**
- ✅ Only generates prompts for brand profiles you own
- ❌ Returns 403 Forbidden if you don't own the brand profile
- ⚠️ Rate limited: **5 requests/minute** (AI generation)

---

## Error Codes

| Status Code | Error Code | Meaning |
|-------------|-----------|---------|
| 401 | `UNAUTHORIZED` | Not authenticated - missing or invalid session |
| 403 | `FORBIDDEN` | Authenticated but not authorized (don't own resource) |
| 400 | `BRAND_PROFILE_NOT_FOUND` | User has no brand profile |
| 404 | - | Campaign not found |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests - wait and retry |
| 500 | - | Server error |

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| Standard operations (CRUD) | 60 requests | 1 minute |
| AI generation endpoints | 5 requests | 1 minute |

**When rate limited:**
```json
{
  "success": false,
  "error": {
    "message": "Too many requests",
    "code": "RATE_LIMIT_EXCEEDED",
    "retryAfter": 60
  }
}
```

---

## Frontend Integration Examples

### React Hook for Campaign List

```typescript
import { useEffect, useState } from 'react'

export function useCampaigns(status = 'all') {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`/api/campaigns/save?status=${status}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setCampaigns(data.campaigns)
        } else {
          setError(data.error)
        }
      })
      .catch(err => setError(err))
      .finally(() => setLoading(false))
  }, [status])

  return { campaigns, loading, error }
}
```

### Create Campaign Function

```typescript
export async function createCampaign(data: {
  title: string
  body: string
  type?: string
  mode?: string
}) {
  const response = await fetch('/api/campaigns/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })

  const result = await response.json()
  
  if (!result.success) {
    throw new Error(result.error?.message || 'Failed to create campaign')
  }
  
  return result.campaign
}
```

### Generate Content with Error Handling

```typescript
export async function generateContent(params: {
  type: string
  mode: string
  prompt: string
  icp: string
  keyword: string
}) {
  try {
    const response = await fetch('/api/campaigns/generate-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    })

    const result = await response.json()

    if (!result.success) {
      // Handle rate limiting
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again.')
      }
      throw new Error(result.error || 'Failed to generate content')
    }

    return result
  } catch (error) {
    console.error('Content generation error:', error)
    throw error
  }
}
```

---

## Migration Guide for Existing Code

### Before (Insecure)

```typescript
// ❌ OLD CODE - Don't use
const response = await fetch('/api/campaigns/save', {
  method: 'POST',
  body: JSON.stringify({
    title: 'My Campaign',
    body: 'Content',
    brandProfileId: 123,  // ❌ No longer accepted
    userId: 'abc'         // ❌ No longer accepted
  })
})
```

### After (Secure)

```typescript
// ✅ NEW CODE - Correct
const response = await fetch('/api/campaigns/save', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'My Campaign',
    body: 'Content'
    // brandProfileId and userId are derived from session
  })
})
```

### Querying Campaigns

```typescript
// ❌ OLD CODE - Don't use
fetch('/api/campaigns/save?brandProfileId=123&userId=abc')

// ✅ NEW CODE - Correct
fetch('/api/campaigns/save?status=published')
// Returns only campaigns owned by authenticated user
```

---

## Security Best Practices

1. **Never trust client input** - `userId` and `brandProfileId` are always derived from session
2. **Check ownership** - All update/delete operations verify ownership
3. **Use rate limiting** - Respect rate limits to avoid 429 errors
4. **Handle errors gracefully** - Display user-friendly error messages
5. **Use HTTPS in production** - Session cookies require secure transport

---

## Testing Tips

### Test Authentication

```typescript
// Test without session (should fail)
fetch('/api/campaigns/save')
  .then(res => console.log(res.status)) // Should be 401

// Test with session (should succeed)
fetch('/api/campaigns/save', {
  credentials: 'include'  // Include session cookie
})
```

### Test Ownership Verification

```typescript
// Try to update another user's campaign (should fail)
fetch('/api/campaigns/cm_other_user_campaign_id', {
  method: 'PATCH',
  body: JSON.stringify({ title: 'Hacked!' })
})
.then(res => console.log(res.status)) // Should be 403
```

---

## Support

If you encounter issues:

1. Check the [main security documentation](./SECURITY_FIX_CAMPAIGNS_AUTH.md)
2. Review the [implementation guide](../docs/implementation/project-context.md)
3. Check authentication setup in [AUTH_SETUP_GUIDE.md](./AUTH_SETUP_GUIDE.md)
4. File a bug report with reproduction steps

---

**Last Updated:** January 27, 2026  
**Version:** 2.0.0 (Post-Security Fix)
