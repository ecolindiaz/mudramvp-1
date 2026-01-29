# Issues Page - Agent Execution Plan

> **For:** GitHub Copilot Agent  
> **Status:** Ready to Execute  
> **Estimated Steps:** 45

---

## Pre-Flight Checks

- [ ] **1.1** Read current `prisma/schema.prisma` to understand existing Issue model
- [ ] **1.2** Read existing `mastra/` structure to understand agent patterns
- [ ] **1.3** Verify E2B package is installed (`@e2b/code-interpreter`)
- [ ] **1.4** Check existing test patterns in `__tests__/`

---

## Phase 1: Database Schema (Steps 2-6)

- [ ] **2.1** Update `prisma/schema.prisma` - extend Issue model with:
  - `category` (technical_structure, ai_visibility, conversation)
  - `discoveryTier` (fundamental, intermediate, advanced, polish)
  - `agentType` (schema_markup, llms_txt, etc.)
  - `prUrl`, `prNumber`, `prStatus`
  - `usedE2bSandbox`, `e2bSandboxId`, `e2bExecutionMs`
  - `issueHash` (unique, for deduplication)
  - `affectedUrl`, `estimatedImpact`, `discoveredFromScore`
  
- [ ] **3.1** Add BrandProfile → Issue[] relation if not exists
- [ ] **4.1** Run `npx prisma db push` to apply schema
- [ ] **5.1** Run `npx prisma generate` to update types
- [ ] **6.1** Verify with quick Prisma query test

---

## Phase 2: E2B Sandbox Service (Steps 7-11)

- [ ] **7.1** Create `lib/services/e2b-sandbox.service.ts`
- [ ] **7.2** Implement `withSandbox<T>()` - generic sandbox wrapper with timeout
- [ ] **8.1** Implement `validateSchemaInSandbox()` - JSON-LD validation
- [ ] **9.1** Implement `testGeneratedCode()` - execute Python/JS in sandbox
- [ ] **10.1** Implement `validateHtmlStructure()` - HTML parsing in sandbox
- [ ] **11.1** Create `__tests__/services/e2b-sandbox.test.ts`

---

## Phase 3: Issue Discovery Service (Steps 12-20)

- [ ] **12.1** Create `lib/services/issue-discovery.service.ts`
- [ ] **13.1** Implement `getTiersForScore()` utility function
- [ ] **14.1** Implement `generateIssueHash()` for deduplication
- [ ] **15.1** Implement `getLatestTechnicalScore()` helper
- [ ] **15.2** Implement `getLatestAIVisibilityScore()` helper
- [ ] **16.1** Implement `discoverTechnicalIssues()` with LLM prompt
- [ ] **17.1** Implement `discoverAIVisibilityIssues()` with LLM prompt
- [ ] **18.1** Implement `discoverConversationOpportunities()` from Radar data
- [ ] **19.1** Implement `upsertDiscoveredIssues()` with deduplication
- [ ] **20.1** Implement main `discoverIssues()` orchestrator
- [ ] **20.2** Create `__tests__/services/issue-discovery.test.ts`

---

## Phase 4: Issue Resolution Agents (Steps 21-28)

- [ ] **21.1** Create `mastra/agents/schema-architect-agent.ts`
- [ ] **22.1** Create `mastra/agents/llms-txt-agent.ts`
- [ ] **23.1** Create `mastra/agents/site-config-agent.ts`
- [ ] **24.1** Create `mastra/agents/content-restructure-agent.ts`
- [ ] **25.1** Create `mastra/agents/citation-enhancer-agent.ts`
- [ ] **26.1** Update `mastra/index.ts` to register new agents
- [ ] **27.1** Create `lib/services/issue-agent-executor.service.ts`
- [ ] **27.2** Implement agent selector `getAgentForIssue()`
- [ ] **27.3** Implement `executeIssueAgent()` with E2B integration
- [ ] **28.1** Create `__tests__/services/issue-agent-executor.test.ts`

---

## Phase 5: API Routes (Steps 29-35)

- [ ] **29.1** Create `app/api/issues/route.ts` (GET list, POST discover)
- [ ] **30.1** Create `app/api/issues/[id]/route.ts` (GET single, PATCH update)
- [ ] **31.1** Create `app/api/issues/[id]/deploy/route.ts` (POST deploy agent)
- [ ] **32.1** Create `app/api/issues/[id]/retry/route.ts` (POST retry failed)
- [ ] **33.1** Create `app/api/webhooks/github/issues/route.ts` (PR merge webhook)
- [ ] **34.1** Create `lib/services/github-webhook.service.ts`
- [ ] **35.1** Create `__tests__/api/issues.test.ts`

---

## Phase 6: UI Components (Steps 36-42)

- [ ] **36.1** Create `hooks/use-issues.ts` - SWR hook for issues data
- [ ] **37.1** Create `components/issues/issue-board.tsx` - Kanban container
- [ ] **38.1** Create `components/issues/issue-column.tsx` - Status column
- [ ] **39.1** Create `components/issues/issue-card.tsx` - Individual card
- [ ] **40.1** Create `components/issues/issue-filters.tsx` - Category filters
- [ ] **41.1** Create `components/issues/deploy-agent-button.tsx` - Deploy CTA
- [ ] **42.1** Create `app/dashboard/issues/page.tsx` - Main page route
- [ ] **42.2** Add Issues link to sidebar navigation

---

## Phase 7: Integration (Steps 43-45)

- [ ] **43.1** Hook discovery into unified analysis service (trigger after analysis)
- [ ] **44.1** Create `__tests__/integration/issue-flow.test.ts`
- [ ] **45.1** Final verification: run full flow manually

---

## Verification Commands

```powershell
# After Phase 1
npx prisma db push
npx prisma generate

# After Phase 2-4
npm run build  # Check TypeScript compiles

# After Phase 5
npm run dev
# Test: curl http://localhost:3000/api/issues?brandProfileId=1

# After Phase 6
# Visit http://localhost:3000/dashboard/issues
```

---

## File Creation Order

```
1.  prisma/schema.prisma (UPDATE)
2.  lib/services/e2b-sandbox.service.ts
3.  lib/services/issue-discovery.service.ts
4.  mastra/agents/schema-architect-agent.ts
5.  mastra/agents/llms-txt-agent.ts
6.  mastra/agents/site-config-agent.ts
7.  mastra/agents/content-restructure-agent.ts
8.  mastra/agents/citation-enhancer-agent.ts
9.  mastra/index.ts (UPDATE)
10. lib/services/issue-agent-executor.service.ts
11. app/api/issues/route.ts
12. app/api/issues/[id]/route.ts
13. app/api/issues/[id]/deploy/route.ts
14. app/api/issues/[id]/retry/route.ts
15. app/api/webhooks/github/issues/route.ts
16. lib/services/github-webhook.service.ts
17. hooks/use-issues.ts
18. components/issues/issue-board.tsx
19. components/issues/issue-column.tsx
20. components/issues/issue-card.tsx
21. components/issues/issue-filters.tsx
22. components/issues/deploy-agent-button.tsx
23. app/dashboard/issues/page.tsx
24. components/app-sidebar.tsx (UPDATE)
25. lib/services/unified-analysis.service.ts (UPDATE - add discovery trigger)
26. __tests__/services/e2b-sandbox.test.ts
27. __tests__/services/issue-discovery.test.ts
28. __tests__/services/issue-agent-executor.test.ts
29. __tests__/api/issues.test.ts
30. __tests__/integration/issue-flow.test.ts
```

---

## Ready to Execute

Say **"go"** and I'll start with Phase 1 (Database Schema).

Or specify a phase number to start from (e.g., "start from phase 3").
