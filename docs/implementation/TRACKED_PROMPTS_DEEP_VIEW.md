# Tracked Prompts – Deep View (Frontend, Integration‑Ready)

This document describes the finished frontend for the per–tracked‑prompt deep view and how it should be connected to the backend. It reflects the current UI and interaction model implemented in:

- `mudra-app/app/dashboard/tracked-prompts/[id]/page.tsx` (NEW)
- `mudra-app/app/dashboard/tracked-prompts/page.tsx` (MODIFIED)

The UI renders fully from mock data today but is designed to swap to live APIs with minimal changes.

> Note on mock data
>
> For this deep view we intentionally used mock tracked prompts and mock prompt details because we hadn’t generated real tracked prompts yet. This allowed us to complete the full frontend workflow (navigation, chart, competitors, chats, sources, dialogs) and define clean backend contracts. When real data is ready, flip the data sources to the endpoints listed below.

## 1) Navigation & Page Structure

- Uses Next.js App Router dynamic route: `/dashboard/tracked-prompts/[id]`.
- Consistent shell via `SidebarProvider`, `AppSidebar`, and `SiteHeader`.
- Header includes:
  - Back button to the list
  - Prompt chip (title) and intent chip
  - Filters aligned to the right:
    - Platform filter: ChatGPT, Claude, Perplexity, AI Overviews, Gemini, plus “All Platforms”
    - Date range: 7d / 14d / 30d

High‑level layout:

```
┌───────────────────────────────────────────────────────────────┐
│ Back, Prompt & Intent chips           Platform  Range (7/14/30)│
├───────────────────────────────────────────────────────────────┤
│ Prompt Visibility (LineChart)   | Competitors table (select)  │
├───────────────────────────────────────────────────────────────┤
│ Toggle: Recent Chats | Sources                                 │
│  → Table (Recent Chats)                                         │
│  → or Table (Sources)                                           │
└───────────────────────────────────────────────────────────────┘
```

Filters drive everything

All data on the page (chart, competitors, recent chats, sources, and Source dialog tables/KPI) updates according to the active Platform and Date Range filters. The Source dialog also respects the same Platform filter and its own range chips.

## 2) Prompt Visibility (Line Chart)

- One line per competitor (no aggregate line and no separate “You” line for MVP). This keeps the graph clean and directly comparable across competitors.
- When a competitor is selected in the table, ONLY that competitor’s line remains visible for focused comparison.
- Date range (7/14/30) applies to the chart.

Expected data shape (per day):

```json
{ "day": "Oct 26", "you": 65, "competitors": 65 }
```

Alternative (preferred for per‑competitor lines):

```json
{ "day": "Oct 26", "Labelbox": 83, "Scale AI": 63, "Appen": 58 }
```

## 3) Competitors Table (with selector)

- Leftmost column is a single‑select checkbox (radio‑like behavior).
- Columns: `#` (rank), Company, Visibility (%), Sentiment (badge), Position (avg rank or —). Each header has a help hover with a short description.
- Selecting a competitor filters the chart to show only that competitor’s line; clicking again clears the selection and re-shows all lines.

## 4) Bottom Area: Recent Chats and Sources

### 4.1 Recent Chats

- Table columns: Platform, Mentioned?, Position, Response (snippet), Date.
- Row click opens a Chat Details dialog with:
  - Provider chip, Mentioned badge, Position badge, Date
  - Prompt (title)
  - Full response text
  - “Citations in this response” as clickable items (domains)
- Clicking a citation opens the Source dialog scoped to that domain (see below).

### 4.2 Sources

- Table columns: `#`, Domain, Citation Frequency (% of runs), Type of Citation (with icons).
- Row click opens the Source dialog for that domain.

## 5) Source Dialog (Domain‑focused)

- Breadcrumb guide (compact pill): `Prompts > [Prompt] > Sources > [domain]`.
- Right of header: range chips (7d/14d/30d) for the dialog data.
- KPI: `Citation Frequency` — % of runs where the domain appeared (copy shown on hover tooltip).
- View selector (two options):
  - `Sources` (default): URLs table for the domain
  - `This prompt`: Chats where that domain was cited for the current prompt

Tables in dialog:
- URLs (Sources view): URL, Type of Content, Mentioned? (brand).
- Chats (This prompt view): Platform, Response (small preview), Citations (count this domain in the chat), Date.

Notes:
- “All prompts” view was intentionally removed for MVP.
- Citations in chat details are clickable and launch this dialog for that domain.

## 6) Platform Filter: Provider → Model Display

Provider values coming from backend should be normalized to these display names in the UI:

- OpenAI → ChatGPT
- Anthropic → Claude
- Perplexity → Perplexity
- Google → AI Overviews
- Gemini → Gemini

These names are what appear in the Platform filter and tables.

## 7) Files & Responsibilities

- `app/dashboard/tracked-prompts/page.tsx`
  - List of tracked prompts
  - Clickable prompt text navigates to deep view
  - Model/Intent filters and selection controls

- `app/dashboard/tracked-prompts/[id]/page.tsx`
  - Full deep view UI (chart, competitors, recent chats, sources)
  - Source dialog and Chat details dialog
  - Platform and date range filters

- `lib/mock-data/tracked-prompts.ts` and `lib/mock/data.ts`
  - Mock data structures used for local rendering

## 8) Minimal Backend Contracts

The frontend is ready to swap mocks with the following endpoints. Cursor‑based pagination is preferred where relevant.

1) Prompt summary

```
GET /api/tracked-prompts/:id
→ { id, prompt, category, ... }
```

2) Visibility trend

```
GET /api/tracked-prompts/:id/visibility?range=7d|14d|30d&provider=all|ChatGPT|Claude|Perplexity|AI%20Overviews|Gemini
→ [{ day, you, competitors }] or [{ day, you, selected }] when a competitor is selected
```

3) Competitors for prompt

```
GET /api/tracked-prompts/:id/competitors?range=7d|14d|30d&provider=...
→ [{ rank, company, visibility, sentiment, position }]
```

4) Sources for prompt

```
GET /api/tracked-prompts/:id/sources?range=...&provider=...
→ [{ domain, frequency, citationType }]
```

5) Chats for prompt

```
GET /api/tracked-prompts/:id/chats?range=...&provider=...&cursor=...
→ {
     items: [{ id, provider, date, fullResponse, mentioned, position, responseCitations: [{ domain, type? }] }],
     nextCursor: string | null
   }
```

6) Chats by domain for this prompt

```
GET /api/tracked-prompts/:id/sources/:domain/chats?range=...&provider=...&cursor=...
→ { items: [...], nextCursor }
```

## 9) Integration Notes

- Keep the Platform filter’s display names as listed; map backend provider strings accordingly.
- The chart supports either aggregate competitor data or a selected competitor series; return `selected` when a competitor is picked.
- The Sources dialog defaults to `Sources` view; the `This prompt` view expects chat rows filtered by domain and provider.
- Pagination: current UI shows an `Expand` button; swapping to cursor pagination is straightforward (update handler to request `nextCursor`).

## 10) Testing Checklist (Frontend)

- [x] Back navigation returns to prompt list
- [x] Platform filter and date range switch without layout shifts
- [x] Competitor selection toggles the chart correctly
- [x] Recent Chats open a details dialog
- [x] Citations in chat details are clickable and open Source dialog
- [x] Sources open a Source dialog with breadcrumb and range chips
- [x] View selector switches between URLs and Chats (This prompt) inside Source dialog
- [x] No TypeScript/linter errors
- [ ] With APIs: validate empty/loading/error states
- [ ] With APIs: validate cursor pagination

## 11) Dependencies

No new packages. Uses existing stack:

- `recharts` for charts (via local ChartContainer wrapper)
- `@tanstack/react-table` for data tables
- `lucide-react` for icons
- shadcn/ui components (Button, Badge, Card, Dialog, Select, Tooltip, Table, etc.)

---

In summary, the deep view frontend is complete and structured to drop in the endpoints above. The only required work to go live is swapping the mock data with real fetches and adding basic loading/empty/error states around those calls.

## 12) Client/User Perspective — What each part does

This section explains the deep view in plain language, focusing on what a user sees, why it matters, and what changes as they interact.

### A. Header: Context + Filters
- **Back button**: Returns to the list of tracked prompts. Users always have a safe, obvious way back.
- **Prompt chip**: Shows the exact query being analyzed. This reinforces context when users open dialogs.
- **Intent chip**: Communicates the prompt’s intent (Organic, Competitor, How‑to, Brand‑Specific). Helps users scan purpose quickly.
- **Platform filter** (All, ChatGPT, Claude, Perplexity, AI Overviews, Gemini): Scopes all data in the deep view to a specific model or all models.
- **Date range** (7/14/30): Shrinks/grows the analysis window to spot short‑term spikes vs longer trends.

What changes when used:
- Chart updates to the selected range/provider.
- Tables (Recent Chats, Sources; and the Sources dialog’s tables) are also scoped to the current provider and/or range.

### B. Prompt Visibility chart (top‑left)
- Purpose: “Are we being mentioned over time, and how do we compare?”
- Baseline view: Two lines — You vs Competitors (aggregate).
- Selecting a competitor in the table switches the competitor line to that single brand; aggregate line hides. This enables one‑to‑one comparison.
- Tooltip shows precise values (e.g., 65%).

User value: a quick trajectory view (improving/declining) and relative performance vs a chosen competitor.

### C. Competitors table (top‑right)
- Ranked by visibility. Columns: Rank (#), Company, Visibility (%), Sentiment badge, Position (avg rank or —).
- Single‑select checkbox in the first column (radio‑like behavior): selecting a row filters the chart to that competitor; selecting again clears it.

User value: identify top competitors for this prompt and pivot the chart quickly.

### D. Toggle: Recent Chats | Sources (bottom control)
- Users switch between two evidence views:
  - **Recent Chats**: concrete chat executions from models.
  - **Sources**: domains/models that appeared in responses.

### E. Recent Chats (bottom table)
- Columns: Platform, Mentioned?, Position, Response (snippet), Date.
- Row click opens Chat Details with provider chip, mentioned/position badges, date, full response, and “Citations in this response”.
- Citations are clickable and open the Source dialog for that domain.

User value: traceability. Users can verify how models actually responded and whether the brand was mentioned.

### F. Sources (bottom table)
- Columns: #, Domain, Citation Frequency (% of runs), Type of Citation.
- Row click opens the Source dialog for that domain.

User value: understand which domains fuel the answers for this prompt, and how often.

### G. Source Dialog (domain‑focused)
- **Breadcrumb pill**: Prompts > [Prompt] > Sources > [domain] so users always know where they are.
- **Range chips** (7/14/30) at top‑right affect this dialog’s data.
- **KPI**: Citation Frequency — % of runs where the domain appeared.
- **View selector**:
  - **Sources** (default): URLs table for the domain (URL, Type of Content, Mentioned?).
  - **This prompt**: Chats for this prompt that cited the domain (Platform, Response preview, Citations count for the domain, Date).
- “Expand” loads more rows (ready to swap to cursor pagination).

User value: go from a domain to concrete pages (URLs) and to the actual chats where that domain influenced the answer.

### H. Clickable Citations in Chat Details
- Each citation is clickable and launches the Source dialog for that domain, without losing context.

### I. Empty/Loading/Error states (planned)
- The UI is prepared to add skeletons/spinners. When integrating, add these around fetches for chart and tables.