# Release: Production Integration of caramel-orangutan + team-members

## Summary

This release integrates two active branches into one production-ready branch:

- `caramel-orangutan`
- `feat/team-members-brandprofile`

The merge was completed on top of updated `main` using an integration branch:

- `release/integrate-caramel-team-prod`

## What Is Included

### From caramel-orangutan

- Answer Optimizer API and dashboard pages
- Sitemap and issue-discovery enhancements
- Campaign/editor UX updates
- Additional utility modules and scripts
- Locale migration and related schema updates

### From feat/team-members-brandprofile

- Team membership and invite support for shared brand profiles
- Team APIs (`/api/team/members`, `/api/team/invites`, `/api/team/invites/accept`)
- Invite acceptance and team management pages
- Role-aware access updates and auth guard improvements
- Email invite handling with escaping safeguards
- Concurrency-safe invite acceptance and seat-limit checks

## Conflict Resolution Decisions

### 1) Reddit scraper merge

File: `mudra-app/lib/apify/reddit-scraper.ts`

- Kept query extraction fallback from URLs
- Kept omission of empty `urls`/`queries` payload fields
- Preserved minimum validation behavior

### 2) Cron job typing merge

File: `mudra-app/lib/services/cron.service.ts`

- Preserved `daily_analysis` for primary daily execution
- Preserved `analysis_catchup` for catch-up runs

### 3) Unified analysis finalization merge

File: `mudra-app/lib/services/unified-analysis.service.ts`

- Preserved delayed `AnalysisRun` completion update until GEO persistence succeeds
- Removed premature completion update path

## Post-Merge Validation

### Targeted tests

Command:

`npx vitest run lib/services/__tests__/team-members.service.test.ts lib/services/__tests__/sitemap-discovery.service.test.ts`

Result:

- 2 test files passed
- 62/62 tests passed

### Build validation

Command:

`npm run vercel-build`

Result:

- Next.js production build completed
- Route manifest generated successfully

Notes:

- Build logs include local Prisma engine compatibility warnings during page data collection in this environment.
- Despite those warnings, the build completed and emitted the full route output.

## Additional Fix During Integration

File: `mudra-app/lib/services/__tests__/sitemap-discovery.service.test.ts`

- Updated nav link cap assertion from 30 to 60 to match the merged implementation constant
- Expanded fixture size to ensure cap behavior is still actually tested

## Deployment and Rollout Notes

1. Apply database migrations in production using migration workflow (`prisma migrate deploy`), not schema push.
2. Verify team-related tables/enums are present before enabling invites in production.
3. Run smoke checks after deploy:
	- invite create/accept/cancel flow
	- dashboard access for owner/admin/member roles
	- daily cron execution logging (`daily_analysis` and `analysis_catchup`)
	- GEO + Technical analysis completion state and persisted scores

## Risk Assessment

- Primary risk area: access control edges in shared-brand flows (owner/admin/member).
- Secondary risk area: cron/reporting semantics after job type normalization.
- Mitigation: targeted tests passed, and merge conflicts were resolved with production-safe behavior retained.
