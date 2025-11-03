# Prompt Add/Delete Implementation

## Overview
Implemented full CRUD operations for tracked prompts with soft delete functionality and 50-prompt limit enforcement.

## Key Features

### 1. Soft Delete (isActive = false)
- Prompts are never actually deleted from the database
- Setting `isActive: false` makes them ineligible for analysis
- Preserves historical data while removing prompts from active tracking

### 2. Custom Prompt Creation
- Users can add custom prompts with `isCustom: true` flag
- Prompts are immediately added to the Prompt table
- Category/intent is specified during creation

### 3. 50 Prompt Limit Enforcement
- Maximum 50 active prompts per brand profile
- API returns error if limit is reached
- User must delete a prompt before adding a new one

## API Routes

### POST `/api/prompts/add`
**Purpose:** Create a new custom prompt

**Request Body:**
```json
{
  "promptText": "What are the best startup accelerators?",
  "category": "Organic",
  "brandProfileId": 1
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "prompt": {
      "id": 123,
      "promptText": "What are the best startup accelerators?",
      "category": "Organic",
      "isCustom": true,
      "isActive": true,
      "brandProfileId": 1
    }
  }
}
```

**Response (Max Limit Reached):**
```json
{
  "success": false,
  "error": {
    "message": "Maximum 50 active prompts allowed. Please delete a prompt before adding a new one.",
    "code": "MAX_PROMPTS_REACHED"
  }
}
```

**Implementation:**
```typescript
// Check active prompt count
const activePromptCount = await prisma.prompt.count({
  where: {
    brandProfileId: brandProfileId,
    isActive: true,
  },
})

// Enforce 50 prompt limit
if (activePromptCount >= 50) {
  return NextResponse.json({
    success: false,
    error: {
      message: 'Maximum 50 active prompts allowed. Please delete a prompt before adding a new one.',
      code: 'MAX_PROMPTS_REACHED',
    },
  }, { status: 400 })
}

// Create new prompt
const newPrompt = await prisma.prompt.create({
  data: {
    promptText: promptText.trim(),
    category: category || 'Organic',
    isCustom: true,
    isActive: true,
    brandProfileId: brandProfileId,
  },
})
```

### POST `/api/prompts/delete`
**Purpose:** Soft delete a prompt (set isActive to false)

**Request Body:**
```json
{
  "promptId": "123",
  "brandProfileId": 1
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "prompt": {
      "id": 123,
      "isActive": false,
      ...
    }
  }
}
```

**Implementation:**
```typescript
// Soft delete: set isActive to false
const updatedPrompt = await prisma.prompt.update({
  where: {
    id: promptId,
    brandProfileId: brandProfileId, // Ensure user owns this prompt
  },
  data: {
    isActive: false,
  },
})
```

## Frontend Implementation

### State Management
```typescript
// State for operations
const [isDeleting, setIsDeleting] = useState<string | null>(null)
const [isAdding, setIsAdding] = useState(false)
const [errorMessage, setErrorMessage] = useState<string | null>(null)
```

### Add Prompt Handler
```typescript
const handleAddPrompt = async () => {
  const text = newPromptText.trim()
  if (!text) {
    setErrorMessage('Please enter a prompt')
    return
  }

  setIsAdding(true)
  setErrorMessage(null)

  try {
    const response = await fetch('/api/prompts/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        promptText: text,
        category: newIntent,
        brandProfileId: profile.id,
      }),
    })

    const result = await response.json()

    if (result.success) {
      // Add to UI immediately
      const newPrompt: TrackedPrompt = {
        id: result.data.prompt.id.toString(),
        prompt: result.data.prompt.promptText,
        visibility: 0, // Not analyzed yet
        model: null,
        intent: result.data.prompt.category,
        sentiment: null,
        position: null,
      }
      setData((prev) => [newPrompt, ...prev])
      setAddOpen(false)
      setNewPromptText("")
      setNewIntent("Organic")
    } else {
      setErrorMessage(result.error?.message || 'Failed to add prompt')
    }
  } catch (error) {
    setErrorMessage('Failed to add prompt. Please try again.')
  } finally {
    setIsAdding(false)
  }
}
```

### Delete Prompt Handler
```typescript
const handleDeletePrompt = async (promptId: string) => {
  setIsDeleting(promptId)
  setErrorMessage(null)
  
  try {
    const response = await fetch('/api/prompts/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        promptId: promptId,
        brandProfileId: profile.id,
      }),
    })

    const result = await response.json()

    if (result.success) {
      // Remove from UI
      setData((prev) => prev.filter((p) => p.id !== promptId))
    } else {
      setErrorMessage(result.error?.message || 'Failed to delete prompt')
    }
  } catch (error) {
    setErrorMessage('Failed to delete prompt. Please try again.')
  } finally {
    setIsDeleting(null)
  }
}
```

## UI Components

### Add Prompt Dialog
- Error message display for max limit reached
- Loading state with spinner during API call
- Disabled inputs while adding
- Category selection: How-to, Organic, Brand-Specific, Competitor
- Auto-clear on success

```tsx
{errorMessage && (
  <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
    {errorMessage}
  </div>
)}

<Button 
  onClick={handleAddPrompt} 
  disabled={isAdding || !newPromptText.trim()}
>
  {isAdding ? (
    <>
      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      Adding...
    </>
  ) : (
    'Add Prompt'
  )}
</Button>
```

### Delete Button (Bulk)
- Supports multiple selection
- Shows loading spinner during delete
- Dynamic text: "Delete Prompt" or "Delete Prompts"
- Loops through selected rows

```tsx
<Button 
  variant="destructive" 
  disabled={isDeleting !== null}
  onClick={async () => {
    const selectedRows = table.getFilteredSelectedRowModel().rows
    for (const row of selectedRows) {
      await handleDeletePrompt(row.original.id)
    }
    table.resetRowSelection()
  }}
>
  {isDeleting ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : (
    <Trash2 className="h-4 w-4" />
  )}
  Delete {selectedCount > 1 ? 'Prompts' : 'Prompt'}
</Button>
```

## Database Schema

### Prompt Table (Prisma)
```prisma
model Prompt {
  id             Int          @id @default(autoincrement())
  promptText     String
  category       String       // Organic, Competitor, How-to, Brand-Specific
  isCustom       Boolean      @default(false)
  isActive       Boolean      @default(true)  // Soft delete flag
  brandProfileId Int
  brandProfile   BrandProfile @relation(fields: [brandProfileId], references: [id])
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  
  @@index([brandProfileId])
  @@index([brandProfileId, isActive])
}
```

## User Flow

### Adding a Prompt
1. User clicks "Add Prompt" button
2. Dialog opens with form
3. User enters prompt text and selects intent/category
4. User clicks "Add Prompt" button in dialog
5. Frontend checks if text is empty
6. API checks if active prompt count < 50
7. If limit reached → Error message displayed
8. If OK → Prompt created with `isCustom: true`, `isActive: true`
9. Prompt appears in table immediately (with no analysis data yet)
10. Next analysis run will include the new prompt

### Deleting a Prompt
1. User selects one or more prompts (checkbox)
2. User clicks "Delete Prompts" button
3. Frontend loops through selected prompts
4. API sets `isActive: false` for each prompt
5. Prompts removed from UI immediately
6. Prompts excluded from future analysis runs

## Error Handling

### Max Prompts Error
```typescript
if (activePromptCount >= 50) {
  return NextResponse.json({
    success: false,
    error: {
      message: 'Maximum 50 active prompts allowed. Please delete a prompt before adding a new one.',
      code: 'MAX_PROMPTS_REACHED',
    },
  }, { status: 400 })
}
```

### Display in UI
```tsx
{errorMessage && (
  <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
    {errorMessage}
  </div>
)}
```

## Analysis Integration

### How Prompts Are Used
```typescript
// Get active prompts for analysis
const prompts = await prisma.prompt.findMany({
  where: {
    brandProfileId: brandProfileId,
    isActive: true, // Only active prompts
  },
})

// Always returns max 50 prompts due to limit enforcement
```

### Custom vs Generated Prompts
- `isCustom: true` → User-created prompts (manual)
- `isCustom: false` → AI-generated prompts (from prompt generation service)
- Both types follow the same 50-prompt limit
- Both types can be soft deleted

## Testing

### Test Add Prompt (Success)
```bash
curl -X POST http://localhost:3000/api/prompts/add \
  -H "Content-Type: application/json" \
  -d '{
    "promptText": "Best YC alternatives for European startups",
    "category": "Competitor",
    "brandProfileId": 1
  }'
```

### Test Add Prompt (Max Limit)
```bash
# First add 50 prompts, then:
curl -X POST http://localhost:3000/api/prompts/add \
  -H "Content-Type: application/json" \
  -d '{
    "promptText": "This should fail",
    "category": "Organic",
    "brandProfileId": 1
  }'
# Expected: 400 error with MAX_PROMPTS_REACHED
```

### Test Delete Prompt
```bash
curl -X POST http://localhost:3000/api/prompts/delete \
  -H "Content-Type: application/json" \
  -d '{
    "promptId": "123",
    "brandProfileId": 1
  }'
```

## Future Enhancements

1. **Bulk Operations**
   - Batch delete API endpoint for better performance
   - Bulk activate/deactivate prompts

2. **Prompt History**
   - View deleted prompts (isActive: false)
   - Restore deleted prompts (set isActive back to true)

3. **Prompt Analytics**
   - Track which prompts perform best
   - Suggest similar prompts based on high performers

4. **Smart Limit Management**
   - Auto-suggest removing low-performing prompts when limit reached
   - Temporary increase limit for premium users

## Files Modified

1. **API Routes (New)**
   - `app/api/prompts/add/route.ts` - Add prompt endpoint
   - `app/api/prompts/delete/route.ts` - Delete prompt endpoint

2. **Frontend**
   - `app/dashboard/tracked-prompts/page.tsx` - Add/delete UI logic

3. **Database**
   - Uses existing Prisma schema (no migration needed)
   - `Prompt` table already has `isActive` and `isCustom` fields

## Summary

✅ **Soft Delete** - Prompts marked inactive, not deleted from DB
✅ **Custom Prompts** - Users can add prompts with isCustom flag
✅ **50 Prompt Limit** - Enforced at API level with clear error message
✅ **Error Handling** - User-friendly messages for all failure cases
✅ **Loading States** - Spinners and disabled states during operations
✅ **Bulk Operations** - Delete multiple prompts at once
✅ **Immediate UI Updates** - Optimistic updates for better UX
