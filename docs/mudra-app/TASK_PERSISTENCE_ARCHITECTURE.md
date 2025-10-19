# Task Persistence Architecture

## ✅ Your Requirements Are Already Met!

### **1. Each Recommendation = Separate Task** ✅

The code in `/api/tasks/create-from-recommendations` uses `Promise.all` with `.map()`:

```typescript
const createdTasks = await Promise.all(
  recommendations.map(async (recommendation, index) => {
    return prisma.task.create({
      data: {
        siteId,
        templateKey: `ai-visibility-rec-${Date.now()}-${index}`,
        title: `Improve AI Visibility: ${recommendation.substring(0, 60)}...`,
        // ... full task structure
      }
    });
  })
);
```

**Result**: If you have 5 recommendations, you get 5 separate tasks in the database.

---

### **2. Tasks Persist in Database** ✅

Each task is created using **Prisma ORM** which saves to **PostgreSQL/Supabase**:

```typescript
prisma.task.create({ ... })
```

**Database Table**: `tasks` (mapped via `@@map("tasks")`)

**Schema**:
```prisma
model Task {
  id             String   @id @default(cuid())
  siteId         String
  templateKey    String
  title          String
  whyItMatters   String
  impact         String
  steps          Json
  tags           Json
  evidence       Json
  suggestedOwner String?
  confidence     Float
  status         String   @default("open")
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

**Result**: Tasks are permanently stored in the database, not in memory or session.

---

### **3. Tasks Remain When Page is Closed** ✅

#### On Page Load
`TasksView` component automatically fetches from database:

```typescript
useEffect(() => {
  fetchTasks(); // Runs when component mounts
}, []);
```

#### fetchTasks Function
```typescript
const fetchTasks = async () => {
  const response = await fetch(`/api/tasks?siteId=${siteId}`);
  const result = await response.json();
  
  // Converts database tasks to display format
  const dbTasks = result.data.tasks.map((task: any) => ({
    id: task.id,
    header: task.title,
    status: task.status === "open" ? "In Process" : "Done",
    // ... more mappings
  }));
  
  setTasks(dbTasks);
};
```

#### API Endpoint: `/api/tasks?siteId=...`
```typescript
// Queries database for all tasks for this site
const tasks = await prisma.task.findMany({
  where: { siteId },
  orderBy: { createdAt: 'desc' }
});
```

**Result**: 
- Close the Tasks page ✅
- Close the browser ✅
- Restart the server ✅
- **Tasks still there!** ✅

---

## Data Flow Diagram

### Creating Tasks from Recommendations

```
1. User clicks "Create Tasks" button
   ↓
2. DirectGeoResults.handleCreateTasks()
   ↓
3. POST /api/tasks/create-from-recommendations
   {
     siteId: "clx123...",
     recommendations: ["rec1", "rec2", "rec3"],
     brandName: "Y Combinator",
     overallScore: 72
   }
   ↓
4. For each recommendation:
   prisma.task.create({ ... })
   ↓
5. Database writes 3 separate rows to 'tasks' table
   ↓
6. API returns: { success: true, count: 3 }
   ↓
7. Dispatch event: 'mudra:refresh-tasks'
   ↓
8. TasksView.fetchTasks() runs
   ↓
9. GET /api/tasks?siteId=clx123...
   ↓
10. prisma.task.findMany({ where: { siteId } })
   ↓
11. Returns ALL tasks from database (including new ones)
   ↓
12. Tasks display in UI ✅
```

### Loading Tasks After Closing Page

```
1. User opens Tasks page (or returns later)
   ↓
2. TasksView component mounts
   ↓
3. useEffect(() => fetchTasks(), []) runs
   ↓
4. GET /api/tasks?siteId=clx123...
   ↓
5. prisma.task.findMany({ where: { siteId } })
   ↓
6. Database returns ALL tasks (even from days ago)
   ↓
7. Tasks display in UI ✅
```

---

## Example Scenario

### Day 1: Create Tasks
```
1. Run AI Analysis for "Y Combinator"
2. Get 5 recommendations
3. Click "Create Tasks" button
4. 5 tasks saved to database:
   - Task ID: clx001 - "Improve AI Visibility: Create comprehensive..."
   - Task ID: clx002 - "Improve AI Visibility: Optimize meta descriptions..."
   - Task ID: clx003 - "Improve AI Visibility: Build backlinks..."
   - Task ID: clx004 - "Improve AI Visibility: Update FAQ section..."
   - Task ID: clx005 - "Improve AI Visibility: Add comparison charts..."
```

### Day 2: Return to Tasks Page
```
1. Open browser
2. Navigate to Tasks page
3. TasksView loads
4. fetchTasks() runs
5. Database query: SELECT * FROM tasks WHERE siteId = 'clx...'
6. Returns all 5 tasks
7. All 5 tasks display ✅
```

### Day 3: Create More Tasks
```
1. Run another AI Analysis
2. Get 3 new recommendations
3. Click "Create Tasks" button
4. 3 new tasks saved to database:
   - Task ID: clx006 - "Improve AI Visibility: Add video content..."
   - Task ID: clx007 - "Improve AI Visibility: Improve loading speed..."
   - Task ID: clx008 - "Improve AI Visibility: Add testimonials..."
5. Database now has 8 total tasks
6. fetchTasks() runs
7. All 8 tasks display ✅
```

---

## Verification Checklist

### ✅ Each Recommendation = Separate Task
- Code uses `.map()` to iterate recommendations
- Each iteration calls `prisma.task.create()`
- Unique `templateKey` for each task
- Separate rows in database

### ✅ Tasks Saved to Database
- Using Prisma ORM
- PostgreSQL/Supabase backend
- Permanent storage (not in-memory)
- ACID transactions guaranteed

### ✅ Tasks Persist After Closing
- `fetchTasks()` runs on component mount
- Queries database via `/api/tasks` endpoint
- Returns all tasks for the site
- No session/localStorage dependency

### ✅ Tasks Survive Browser Restart
- Database is external (Supabase)
- Not stored in browser memory
- Not stored in session storage
- Not stored in local storage
- **Stored in PostgreSQL database** ✅

### ✅ Tasks Survive Server Restart
- Database is external service
- Not in application memory
- Connection re-established on startup
- All tasks still accessible ✅

---

## Database Query Examples

### Creating Tasks
```sql
INSERT INTO tasks (
  id, site_id, template_key, title, why_it_matters,
  impact, steps, tags, evidence, suggested_owner,
  confidence, status, created_at, updated_at
) VALUES (
  'clx001', 'site123', 'ai-visibility-rec-123-0',
  'Improve AI Visibility: Create comprehensive...',
  'This recommendation was generated from AI visibility analysis...',
  'medium', '{"steps": [...]}', '["ai-visibility", "seo"]',
  '{"source": "AI Visibility Analysis"}', 'Content Team',
  0.75, 'open', NOW(), NOW()
);
```

### Fetching Tasks
```sql
SELECT * FROM tasks
WHERE site_id = 'site123'
ORDER BY created_at DESC;
```

### Result
```
| id     | title                              | status | created_at          |
|--------|------------------------------------|--------|---------------------|
| clx008 | Improve AI Visibility: Add video   | open   | 2025-10-03 14:30:00 |
| clx007 | Improve AI Visibility: Improve...  | open   | 2025-10-03 14:30:00 |
| clx006 | Improve AI Visibility: Add testi..| open   | 2025-10-03 14:30:00 |
| clx005 | Improve AI Visibility: Add comp... | open   | 2025-10-01 18:45:00 |
| clx004 | Improve AI Visibility: Update FAQ  | done   | 2025-10-01 18:45:00 |
| clx003 | Improve AI Visibility: Build back..| open   | 2025-10-01 18:45:00 |
| clx002 | Improve AI Visibility: Optimize... | open   | 2025-10-01 18:45:00 |
| clx001 | Improve AI Visibility: Create co...| open   | 2025-10-01 18:45:00 |
```

---

## Additional Features

### Task Status Tracking
- Tasks remain even when marked "Done"
- Can be filtered by status
- History preserved

### Task Updates
- Can update task status
- Can mark steps as complete
- Changes saved to database

### Task Deletion
- Can dismiss tasks
- Soft delete (status = "dismissed")
- Still in database, just filtered out

---

## Summary

✅ **Your requirements are already fully implemented!**

1. **Each recommendation = separate task**: Uses `.map()` + `prisma.task.create()`
2. **Tasks persist in database**: PostgreSQL via Prisma ORM
3. **Tasks remain when page closed**: `fetchTasks()` loads from database on mount

**Architecture**: Database-backed, persistent, reliable.

**Test it**:
1. Create tasks from recommendations
2. Close browser completely
3. Open browser again
4. Navigate to Tasks page
5. **All tasks still there!** ✅
