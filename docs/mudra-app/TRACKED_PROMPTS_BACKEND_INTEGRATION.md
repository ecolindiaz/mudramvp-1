# Tracked Prompts Backend Integration

## ✅ Integration Complete

The tracked prompts frontend has been successfully connected to the backend APIs.

## Changes Made

### 1. **Replaced Mock Data with Real API Call**

**Before:**
```tsx
import { mockTrackedPrompts } from "@/lib/mock-data/tracked-prompts"

useEffect(() => {
  const transformedData = mockTrackedPrompts.map(...)
  setData(transformedData)
}, [])
```

**After:**
```tsx
useEffect(() => {
  fetchPrompts() // Calls /api/prompts/with-results
}, [profile?.id])
```

### 2. **Extracted Reusable Fetch Function**

```tsx
const fetchPrompts = async () => {
  if (!profile?.id) return
  
  const response = await fetch(`/api/prompts/with-results?brandProfileId=${profile.id}`)
  const result = await response.json()
  
  // Transform API response to table format
  const transformedData: TrackedPrompt[] = result.prompts.map((p: any) => ({
    id: p.id.toString(),
    prompt: p.text,                           // API uses 'text'
    visibility: Math.round(p.visibility || 0),
    model: p.model || null,
    intent: p.category || null,               // API uses 'category'
    sentiment: p.sentiment || null,
    position: p.position || null
  }))
  
  setData(transformedData)
}
```

### 3. **Updated Add/Delete Handlers to Refresh Data**

**Delete Prompt:**
```tsx
const handleDeletePrompt = async (promptId: string) => {
  const response = await fetch('/api/prompts/delete', {
    method: 'POST',
    body: JSON.stringify({ promptId: parseInt(promptId), brandProfileId: profile.id })
  })
  
  if (result.success) {
    await fetchPrompts() // ✅ Refresh from server
  }
}
```

**Add Prompt:**
```tsx
const handleAddPrompt = async () => {
  const response = await fetch('/api/prompts/add', {
    method: 'POST',
    body: JSON.stringify({ 
      promptText: newPromptText, 
      category: newIntent, 
      brandProfileId: profile.id 
    })
  })
  
  if (response.ok && result.success) {
    setAddOpen(false)
    await fetchPrompts() // ✅ Refresh from server
  }
}
```

## Backend APIs Used

### 1. **GET `/api/prompts/with-results`**

**Purpose:** Fetch prompts with analysis results

**Query Parameters:**
- `brandProfileId` (required)

**Response Format:**
```json
{
  "success": true,
  "prompts": [
    {
      "id": 1,
      "text": "Best AI visibility platforms",
      "category": "Organic",
      "visibility": 85,
      "model": "ChatGPT-4",
      "sentiment": "Positive",
      "position": 2,
      "results": [
        {
          "model": "ChatGPT-4",
          "visibility": 85,
          "position": 2,
          "sentiment": "Positive",
          "mentioned": true
        }
      ],
      "promptAggregate": {
        "overallScore": 7.5,
        "mentionRate": 75,
        "averagePosition": 2.3,
        "totalTests": 4,
        "mentionedIn": 3
      }
    }
  ],
  "count": 50,
  "hasAnalysis": true,
  "analysisDate": "2025-11-03T10:30:00Z"
}
```

**Implementation:** `mudra-app/app/api/prompts/with-results/route.ts`

### 2. **POST `/api/prompts/add`**

**Purpose:** Add new custom prompt

**Request Body:**
```json
{
  "promptText": "How to improve AI visibility?",
  "category": "How-to",
  "brandProfileId": 1
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "prompt": {
      "id": 51,
      "text": "How to improve AI visibility?",
      "category": "How-to",
      "isCustom": true,
      "isActive": true,
      "brandProfileId": 1,
      "createdAt": "2025-11-03T10:30:00Z"
    }
  }
}
```

**Features:**
- ✅ Enforces 50 prompt limit
- ✅ Sets `isCustom: true` for user-created prompts
- ✅ Validates required fields

**Implementation:** `mudra-app/app/api/prompts/add/route.ts`

### 3. **POST `/api/prompts/delete`**

**Purpose:** Soft delete prompt (sets `isActive: false`)

**Request Body:**
```json
{
  "promptId": 51,
  "brandProfileId": 1
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "prompt": {
      "id": 51,
      "isActive": false,
      "updatedAt": "2025-11-03T10:35:00Z"
    }
  }
}
```

**Security:**
- ✅ Verifies prompt belongs to brand profile
- ✅ Returns 403 if unauthorized
- ✅ Soft delete (preserves data)

**Implementation:** `mudra-app/app/api/prompts/delete/route.ts`

## Database Schema

### Prompt Table
```prisma
model Prompt {
  id              Int      @id @default(autoincrement())
  brandProfileId  Int
  text            String   @db.Text        // Prompt text
  category        String?                   // Organic, Competitor, How-to, Brand-Specific
  isCustom        Boolean  @default(false) // User-created vs auto-generated
  isActive        Boolean  @default(true)  // Soft delete flag
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  brandProfile    BrandProfile @relation(...)
  
  @@index([brandProfileId, isActive])
}
```

### GeoAnalysisResult Table
```prisma
model GeoAnalysisResult {
  id              Int      @id @default(autoincrement())
  brandProfileId  Int
  overallScore    Float    @default(0)
  analyses        Json     @default("[]")  // Per-prompt test results
  summary         Json     @default("{}")
  timestamp       DateTime @default(now())
  
  brandProfile    BrandProfile @relation(...)
  
  @@index([brandProfileId, timestamp])
}
```

**How They Connect:**
1. Prompts stored in `Prompt` table with `brandProfileId`
2. Analysis results stored in `GeoAnalysisResult.analyses` JSON field
3. `/api/prompts/with-results` joins them by matching prompt text

## Data Flow

```
┌─────────────────┐
│  User Action    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Frontend (Tracked Prompts Page)    │
│  - Load prompts on mount             │
│  - Add custom prompt                 │
│  - Delete prompt                     │
│  - Filter by model/intent            │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  API Routes                          │
│  - GET /api/prompts/with-results     │
│  - POST /api/prompts/add             │
│  - POST /api/prompts/delete          │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Database (PostgreSQL via Prisma)   │
│  - Prompt table (active prompts)     │
│  - GeoAnalysisResult (test results)  │
└─────────────────────────────────────┘
```

## Key Field Mappings

| Frontend Field | Database Field | Notes |
|---------------|----------------|-------|
| `id` | `Prompt.id` | Convert to string |
| `prompt` | `Prompt.text` | Main prompt text |
| `visibility` | Calculated from `GeoAnalysisResult.analyses` | Percentage 0-100 |
| `intent` | `Prompt.category` | Organic, Competitor, How-to, Brand-Specific |
| `model` | First model from analysis | ChatGPT-4, Claude, Gemini, etc. |
| `sentiment` | From analysis result | Positive, Neutral, Negative |
| `position` | Average position from analysis | Lower is better |

## Testing Checklist

- [x] Load prompts on page load
- [x] Show loading state while fetching
- [x] Display empty state when no prompts exist
- [x] Add custom prompt (enforces 50 limit)
- [x] Delete single prompt
- [x] Bulk delete prompts
- [x] Filter by model
- [x] Filter by intent
- [x] Sort by visibility (descending)
- [x] Sort by position (ascending)
- [x] Click prompt to navigate to detail page
- [x] Show error messages for API failures
- [x] Refresh data after add/delete

## Frontend Features

### UI Components
- ✅ Sortable data table (TanStack Table)
- ✅ Filters (model, intent)
- ✅ Bulk selection & deletion
- ✅ Add prompt dialog
- ✅ Loading states
- ✅ Error handling
- ✅ 50 prompt limit indicator
- ✅ Tooltips for column headers
- ✅ Model icons (ChatGPT, Perplexity, Claude)

### User Experience
- ✅ Instant feedback on actions
- ✅ Server data refresh after mutations
- ✅ Clear error messages
- ✅ Prompt count display (X/50)
- ✅ Empty state guidance
- ✅ Responsive design

## Next Steps (Optional Enhancements)

### 1. **Real-time Updates**
Add polling or WebSocket for automatic refresh:
```tsx
useEffect(() => {
  const interval = setInterval(() => {
    fetchPrompts()
  }, 30000) // Poll every 30 seconds
  
  return () => clearInterval(interval)
}, [profile?.id])
```

### 2. **Manual Refresh Button**
```tsx
<Button onClick={fetchPrompts} disabled={isLoading}>
  <RefreshCw className="h-4 w-4" />
  Refresh
</Button>
```

### 3. **Optimistic Updates**
Update UI immediately, rollback on error:
```tsx
const handleDeletePrompt = async (promptId: string) => {
  // Optimistic: remove from UI immediately
  const previousData = data
  setData(prev => prev.filter(p => p.id !== promptId))
  
  try {
    const response = await fetch('/api/prompts/delete', ...)
    if (!response.ok) throw new Error()
  } catch (error) {
    // Rollback on error
    setData(previousData)
    setErrorMessage('Failed to delete')
  }
}
```

### 4. **Prompt Detail Page**
The table already has click handlers for individual prompts:
```tsx
onClick={() => router.push(`/dashboard/tracked-prompts/${row.original.id}`)}
```

Create `/dashboard/tracked-prompts/[id]/page.tsx` to show:
- Full prompt text
- Detailed results by model
- Historical visibility trends
- Related prompts
- Response snippets

### 5. **Batch Operations**
- Export prompts to CSV
- Import prompts from file
- Duplicate prompt
- Edit prompt text

## Common Issues & Solutions

### Issue: "No prompts found"
**Cause:** No analysis has been run yet
**Solution:** User needs to run analysis first from dashboard

### Issue: "Maximum 50 prompts reached"
**Cause:** Enforced limit in backend
**Solution:** User must delete prompts before adding new ones

### Issue: Prompts show 0% visibility
**Cause:** Prompt added but not analyzed yet
**Solution:** Run new analysis to test custom prompts

### Issue: Data not refreshing after delete
**Cause:** Missing `await fetchPrompts()` call
**Solution:** Already fixed - we call fetchPrompts() after mutations

## Architecture Notes

### Why Soft Delete?
- Preserves analysis history
- Allows "undo" functionality
- Maintains data integrity
- Enables analytics on deleted prompts

### Why Separate Prompt Table?
- Reusable across analysis runs
- Efficient querying (indexed by brandProfileId)
- Clear ownership model
- Easy to extend with metadata

### Why JSON for Analysis Results?
- Flexible schema (different providers return different data)
- Fast writes (no joins during analysis)
- Historical snapshots preserved
- Easy to add new providers without migrations

## Related Files

- **Frontend:** `mudra-app/app/dashboard/tracked-prompts/page.tsx`
- **API Routes:**
  - `mudra-app/app/api/prompts/with-results/route.ts`
  - `mudra-app/app/api/prompts/add/route.ts`
  - `mudra-app/app/api/prompts/delete/route.ts`
- **Database Schema:** `mudra-app/prisma/schema.prisma`
- **Services:**
  - `mudra-app/lib/services/prompt-storage.service.ts`
  - `mudra-app/lib/services/prompt-generation.service.ts`
  - `mudra-app/lib/services/visibility-scoring.service.ts`

## Documentation

- Main Architecture: `docs/architecture/UNIFIED_ANALYSIS_ARCHITECTURE.md`
- System Overview: `docs/CODEBASE_OVERVIEW.md`
- Project Context: `.github/copilot-instructions.md`
