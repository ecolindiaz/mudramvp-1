# Droid Lab Frontend & Backend Integration Guide

Last updated: November 16, 2025  
Owner: GEO / Droids squad

## 1. Purpose & Scope
- **What**: `Droid Lab` is the operator hub where customers deploy automation agents (“droids”), monitor their technical-impact KPIs, inspect live tasks, and connect repos/branches for delivery.
- **Where**: Route lives at `/dashboard/agents-lab` and is implemented entirely in `app/dashboard/agents-lab/page.tsx` (client component wrapped by `BrandProfileProvider`).
- **Goal of this doc**: Make it easy for new engineers to (a) understand how the current frontend is structured and (b) wire it to real backend services (Prisma, queues, GitHub app, etc.).

---

## 2. High-Level Architecture

| Layer | File(s) | Responsibilities |
| --- | --- | --- |
| Layout shell | `app/dashboard/agents-lab/page.tsx`, `components/app-sidebar.tsx`, `components/site-header.tsx` | Provide sidebar navigation, site header and floating CTA. |
| Context | `components/brand-profile-context.tsx` | Loads brand profile via `/api/brand-profile`, exposes `profile` + setters. Required for fetching technical KPIs. |
| Feature UI | `app/dashboard/agents-lab/page.tsx` | Handles state for KPIs, GitHub connection, deployments, task detail panel, PR sheet, dialogs. |
| Shared UI | `components/dashboard/dashboard-stat-card.tsx`, ShadCN primitives, Lucide icons | Surface KPI cards with tooltips, badges and quick actions. |
| Dialogs | `components/dashboard/deploy-droid-dialog.tsx` | Lists available droids, handles deploy button UX + impact tooltips. |
| Empty states | `components/empty-states/browser-window-empty.tsx`, `FloatingMudraButton` | Provide guard rails for missing data / quick actions. |

The entire page currently runs client-side to support rich interactivity (search, filtering, tooltips, time-based mock updates). Server Components can be reintroduced if we move long-lived state to server actions or data hooks.

---

## 3. Component Walkthrough

1. **Layout Wrapper**
   - `AgentsLabPage` exports `BrandProfileProvider` → `AgentsLabPageInner`.
   - `SidebarProvider` plus `AppSidebar` and `SiteHeader` create the dashboard shell.
   - `FloatingMudraButton` renders a floating support / CTA.

2. **Header**
   - Shows `Droid Lab` title, description, documentation link, deploy button, and back-navigation when inspecting a specific droid.
   - Emits `mudra:website-analyzed` window event to refresh technical score on analysis completion.

3. **KPI Grid**
   - Renders 4 `DashboardStatCard`s (Technical Structure Score, Optimizations Shipped, Active Droids, Opportunity Radar).
   - Each card exposes tooltip copy defined in `metricCards` array. Order is controlled there.

4. **Workspace Columns**
   - **Left column**: reserved for future insights (currently empty but sized).
   - **Middle column**: toggles between droid list and task list depending on detail view state.
     - Includes GitHub repo + branch selectors. Currently fed by `mockRepos` and `mockBranches`.
   - **Right column**: houses PR activity sheet (`Sheet` component) and placeholders for future observability panels (see file tail for `Sheet` usage).

5. **Deploy Modal**
   - `DeployDroidDialog` lists mock deployment templates with impact chips.
   - Calls `handleDeployAgent` → adds a simulated `deployedAgents` entry with `deploying` → `active` transition.

6. **Task Detail UX**
   - Selecting an active droid swaps the middle column into task mode.
   - `buildTaskRows` synthesizes tasks (running/queued/completed/failed) with timestamp formatting by `formatTimeAgo`.
   - Tasks link to `/dashboard/agents-lab/tasks/[taskId]` for deep dive.

---

## 4. State & Data Sources (Current vs. Future)

| Concern | State Hook | Current Source | Needs Real Backend? | Notes |
| --- | --- | --- | --- | --- |
| Brand profile | `useBrandProfile()` | `/api/brand-profile` (already live) | ✅ (already wired) | Contains `profile.id` used for KPI APIs. |
| Technical score | `technicalScore` | `GET /api/analysis/technical-history?brandProfileId=…&limit=1` | ✅ (live, but returns most recent history only) | Add error handling + loading states when hooking to real DB. |
| Deployed droids | `deployedAgents` | Local array mutated by `handleDeployAgent` after dialog | ❌ (mock) | Replace with `GET /api/droids/deployments` on mount + `POST /api/droids/deploy`. |
| Deployment metrics | `agentMetricsMap` | Static map keyed by agent name | ❌ (mock) | Replace with metrics returned alongside deployments or aggregated from tasks. |
| GitHub connect | `isGithubConnected`, `mockRepos`, `mockBranches` | UI simulation | ❌ | Hook into Better Auth + GitHub App handshake; fetch repos/branches via Mudra API. |
| Tasks per droid | `buildTaskRows` | Generated array per agent | ❌ | Replace with `GET /api/droids/{id}/tasks` (or reuse `/api/tasks`). |
| PR sidebar | `activePullRequests` | Local array | ❌ | Hook to GitHub GraphQL or internal PR cache. |
| Event refresh | `mudra:website-analyzed` | Window event | ✅ | Continue emitting server-side after technical analysis jobs complete. |

---

## 5. Backend Integration Checklist

### 5.1 Brand Profile (already implemented)
1. Ensure `/api/brand-profile` returns `{ id, companyName, ... }`.
2. If new fields are added, update `defaultProfile` in `brand-profile-context.tsx`.
3. Keep timeouts at 10s; API should respond within that or send streaming updates.

### 5.2 Technical Structure Score
1. Endpoint: `GET /api/analysis/technical-history?brandProfileId=<id>&limit=1`.
2. Server should return `data: [{ overallScore, ... }]`.
3. Consider caching via Redis for 6h (per GEO guidelines).
4. To push updates, emit `window.dispatchEvent(new CustomEvent('mudra:website-analyzed'))` from websocket/worker once new analysis finishes.

### 5.3 Deployments CRUD
Create a dedicated feature API namespace:
```
app/api/droids/
  deployments/route.ts       // GET current deployments for brand
  deploy/route.ts            // POST new deployment (body: agent template id, repo, branch, brandProfileId)
  templates/route.ts         // GET available droid templates (what dialog currently mocks)
```

Implementation tips:
- Store deployments in Prisma table `DroidDeployment` with fields: `id`, `brandProfileId`, `templateId`, `status`, `repo`, `branch`, `lastActivity`, `impact`.
- `handleDeployAgent` should call `await fetch('/api/droids/deploy', { method: 'POST', body: {...} })`, then optimistically append to UI using response payload.
- Webhooks or background jobs should update `status` (`deploying` → `active`/`failed`) and push through SSE or revalidation hooks.

### 5.4 Task Telemetry
Options:
1. Reuse `app/api/tasks` endpoints (already exist for other flows). Filter by `agentId`.
2. Create `GET /api/droids/{deploymentId}/tasks` to aggregate queue state + pipeline steps.

Frontend wiring:
- Replace `buildTaskRows` with data from API.
- Use SWR/React Query to poll active deployments.
- `taskFilter` (“active” vs “all”) maps to query params (`status=running`).

### 5.5 GitHub Integration
1. Add backend endpoints to:
   - Kick off OAuth / GitHub App install (`/api/github/connect`).
   - List repos (`/api/integrations/github/repositories`).
   - List branches (`/api/github/repos/{id}/branches`).
2. Replace `mockRepos` + `mockBranches` with API data + skeleton states.
3. Store tokens via Better Auth / Supabase secrets. Never expose PATs to client.

### 5.6 Opportunity Radar & Optimizations
- Both metrics currently hard-coded (24 optimizations, 7 radar items).
- Plug into existing analytics endpoints:
  - `Optimizations Shipped`: count merged PRs or `tasks` with `status='completed'`.
  - `Opportunity Radar`: reuse `app/api/analysis/geo/latest` (if it exposes outreach + research leads) or create `app/api/droids/opportunities`.

### 5.7 PR Sheet
- Current `Sheet` shows `activePullRequests` array.
- Replace with data from GitHub search (repo + branch) or internal pipeline storing open PRs created by droids.

### 5.8 Real-Time Updates
- Preferred: Pusher or Supabase Realtime to broadcast deployment/task status to the dashboard.
- Minimal approach: poll `/api/droids/deployments` every 30s while page focused.
- Ensure deployments update `lastActivity` so `formatTimeAgo` stays meaningful.

---

## 6. Step-By-Step Wiring Plan

1. **Fetch Brand Profile early**
   - Already handled. Just make sure profile IDs exist in DB before visiting page.

2. **Load Technical Score on mount**
   - Keep `fetchTechnicalHistory()` but add loading state + error toast.
   - Backend: query `TechnicalHistory` table ordered by `createdAt desc limit 1`.

3. **Populate Deployment Templates**
   - Replace `mockDeployments` with API-driven hook:
     ```ts
     const { data: templates } = useSWR('/api/droids/templates')
     ```
   - Include `impact`, `iconKey`, `description`, `status`.

4. **Read Active Deployments**
   - On mount, call `/api/droids/deployments?brandProfileId=<id>`.
   - Map response to `deployedAgents` state (respecting `status` and `lastActivity`).

5. **Handle Deploy Action**
   - Update `handleDeployAgent` to `POST /api/droids/deploy`.
   - Backend validates repo/branch + enqueues job.
   - Return deployment record; show `deploying` status until job completes.

6. **Hydrate Tasks per Deployment**
   - When detail view opens, call `/api/droids/{deploymentId}/tasks?filter=${taskFilter}`.
   - Replace local `buildTaskRows`.
   - Provide SSE/polling to refresh tasks while detail pane active.

7. **Connect GitHub selectors**
   - When user clicks **Connect**, redirect to backend OAuth flow. After success, store installation ID and set `isGithubConnected=true`.
   - Repo + branch dropdowns should read from API responses; include search server-side if lists are large.

8. **Opportunity & Optimization Metrics**
   - Use existing analysis tables or create aggregator functions that return counts keyed by brand.
   - Pass values and tooltip copy into `metricCards`.

9. **Quality gates**
   - Add loading skeletons/spinners for each API-backed section.
   - Log errors to observability stack (e.g., Sentry).

---

## 7. Development Tips
- **Type Safety**: Add shared interfaces in `types/droids.ts` (templates, deployments, tasks).
- **Caching**: Leverage Redis for KPI endpoints following TTL guidelines (technical score 6h, tasks maybe 30s).
- **Queueing**: Deployment flow should enqueue jobs (`lib/jobs/`) for actual automations. Update UI using job status.
- **Env Vars**: You’ll need GitHub OAuth keys, queue redis URLs, and any AI service keys for agent execution.
- **Testing**: Add Storybook stories or Jest tests for `DeployDroidDialog` interactions once data is dynamic.

---

## 8. Open Questions / Next Steps
- Define exact schema for `DroidDeployment` and `DroidTask` tables.
- Decide whether Opportunity Radar is populated by Firegeo or a new crawler.
- Clarify how PR sheet gets data (GitHub vs. internal).
- Add analytics tracking (which droids get deployed, task completion rates).

Once these backend endpoints exist, the current frontend can switch from mocks to live data with minimal refactors: most UI already anticipates asynchronous states, so we mainly need to replace mock arrays with hooks that call the APIs described above.

