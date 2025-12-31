# Campaigns Database Setup

## Quick Setup

### Step 1: Create `.env.local` file

Create `mudra-app/.env.local` with:

```env
DATABASE_URL="file:./prisma/dev.db"
OPENAI_API_KEY=sk-your-key-here
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=any-random-string
```

Get your OpenAI key from https://platform.openai.com/api-keys

### Step 2: Run the migration

✅ **Already done!** The campaigns table was created.

If you need to run it again:
```powershell
cd mudra-app
Get-Content scripts/add-campaigns-table.sql | sqlite3 prisma/dev.db
```

### Step 3: Start the app
```bash
npm run dev
```

## What It Does

Creates a `campaigns` table with:
- `id`: Unique campaign identifier  
- `title`: Campaign title
- `body`: Campaign content (markdown)
- `type`: blog, newsletter, or case
- `mode`: geo or seo
- `status`: draft or published
- `metadata`: JSON data (prompts, ICP, keywords)
- Timestamps: createdAt, updatedAt, publishedAt

## Features Enabled

### 1. Auto-Save Generated Campaigns
When you generate a campaign, it's automatically saved to drafts.

### 2. Persistent Campaign List
- **Drafts Tab**: Shows all draft campaigns
- **Published Tab**: Shows all published campaigns
- Campaigns persist across sessions

### 3. Save & Publish
- **Save Button**: Saves current edits to database
- **Publish Button**: Moves campaign from drafts to published

### 4. Load Existing Campaigns
Click any campaign in the list to edit it.

## Database Schema

```sql
CREATE TABLE campaigns (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT NOT NULL,
    mode TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    brandProfileId INTEGER,
    userId TEXT,
    metadata JSONB,
    createdAt TIMESTAMP DEFAULT NOW(),
    updatedAt TIMESTAMP NOT NULL,
    publishedAt TIMESTAMP
);
```

## API Endpoints

### Save Campaign
```
POST /api/campaigns/save
Body: { id, title, body, type, mode, status, metadata }
```

### Get Campaigns
```
GET /api/campaigns/save?status=draft
GET /api/campaigns/save?status=published
```

### Get Single Campaign
```
GET /api/campaigns/[id]
```

### Update Campaign
```
PATCH /api/campaigns/[id]
Body: { title?, body?, status? }
```

## Usage Flow

```
1. User generates campaign
   ↓
2. Auto-saved to database as draft
   ↓
3. Appears in "Drafts" tab
   ↓
4. User edits and clicks "Save"
   ↓
5. Changes saved to database
   ↓
6. User clicks "Mark as published"
   ↓
7. Moves to "Published" tab
```

## Troubleshooting

### "Table already exists" error
Already set up! No action needed.

### Campaigns not appearing
1. Check database connection in `.env.local`
2. Verify `DATABASE_URL` is set
3. Check browser console for API errors

### "No database found" error
Ensure your DATABASE_URL points to a valid Postgres database.

## Next Steps

After setup:
1. Generate a campaign
2. Check Drafts tab - should appear there
3. Click campaign to edit
4. Save changes
5. Publish when ready
6. Check Published tab

---

**Note**: Campaigns are now persisted in the database and localStorage is only used for temporary transfer during generation.

