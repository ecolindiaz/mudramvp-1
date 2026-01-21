---
name: investigating-issues
description: Systematic investigation of production issues, bugs, and failures in web applications. Use when debugging why something isn't working in prod, investigating logic errors, system failures, test failures, deployment issues, or when the user mentions things like "not working", "broken", "bug", "failing", "investigate", "debug", or "figure out why".
---

# Investigating Production Issues

Systematic approach to finding root causes of web app failures.

## Investigation Framework

Copy and track progress:

```
Investigation Progress:
- [ ] 1. Reproduce & Define
- [ ] 2. Gather Evidence
- [ ] 3. Form Hypothesis
- [ ] 4. Binary Search / Isolate
- [ ] 5. Verify Root Cause
- [ ] 6. Implement & Validate Fix
```

## Step 1: Reproduce & Define

**Goal**: Understand exactly what's failing and make it repeatable.

Questions to answer:
- What is the expected behavior vs actual behavior?
- When did it start failing? (Recent deploy? Data change?)
- Is it consistent or intermittent?
- What are the exact steps to reproduce?
- Does it affect all users or specific conditions?

```bash
# Check recent changes
git log --oneline -20
git diff HEAD~5..HEAD --stat
```

## Step 2: Gather Evidence

Collect ALL available data before forming conclusions:

**Logs & Errors**
```bash
# Search for errors in logs
grep -i "error\|exception\|fail" logs/*.log | tail -100

# Check application logs with context
grep -B5 -A5 "ERROR" app.log
```

**Environment Comparison**
- Compare prod vs staging vs local configs
- Check environment variables
- Verify database connection strings
- Check API endpoints and versions

**Recent Changes**
- What deployed recently?
- Any config changes?
- Database migrations?
- Third-party service updates?

## Step 3: Form Hypothesis

Based on evidence, hypothesize the cause category:

| Category | Indicators |
|----------|------------|
| **Logic Error** | Wrong output, bad calculations, missing conditions |
| **Data Issue** | Works for some inputs, null/undefined errors, type mismatches |
| **Environment** | Works locally not in prod, missing env vars, wrong configs |
| **Race Condition** | Intermittent, timing-dependent, works on retry |
| **Integration** | API failures, network timeouts, auth issues |
| **Resource** | Memory leaks, CPU spikes, connection pool exhaustion |

Write down: "I believe the issue is [X] because [evidence]"

## Step 4: Binary Search / Isolate

Systematically narrow down the problem location.

**Code Isolation**
```
Full System
├── Frontend ← Does the UI render correctly?
│   ├── Component A
│   └── Component B ← Isolate which component
├── API Layer ← Does the API return correct data?
│   ├── Route handlers
│   └── Middleware
└── Backend ← Is the business logic correct?
    ├── Service layer
    └── Database queries ← Check raw queries
```

**Test in isolation**:
1. Call the API directly (bypass frontend)
2. Query the database directly (bypass API)
3. Test with hardcoded data (bypass database)
4. Test individual functions (bypass integration)

```bash
# Direct API test
curl -X POST http://localhost:3000/api/endpoint -d '{"test": "data"}'

# Database query test
psql -c "SELECT * FROM table WHERE condition LIMIT 5"
```

## Step 5: Verify Root Cause

Before fixing, VERIFY the hypothesis:

**Double Verification Rule**: Test the assumption using a DIFFERENT approach:

1. If you think "API returns wrong data":
   - Check API response directly
   - AND check database values
   - AND check what frontend receives

2. If you think "frontend display bug":
   - Check rendered HTML
   - AND check component state
   - AND check API response

**Confirm with minimal reproduction**:
- Can you create the smallest test case that fails?
- Does fixing the suspected cause make the test pass?

## Step 6: Implement & Validate Fix

```
Fix Checklist:
- [ ] Fix addresses ROOT cause, not symptom
- [ ] Add test case that would have caught this
- [ ] Check for similar patterns elsewhere in codebase
- [ ] Document what caused the issue
- [ ] Verify fix in prod-like environment before deploying
```

**Validate the fix**:
```bash
# Run related tests
npm test -- --grep "related-feature"

# Test the specific scenario
# [manual steps to reproduce original issue]
```

## Common Issue Patterns

### "Works locally, fails in prod"
Check: env vars, build process, API endpoints, CORS, SSL, database connections

### "Intermittent failures"
Check: race conditions, connection pools, rate limits, caching, timing dependencies

### "Suddenly stopped working"
Check: recent deploys, expired tokens/certs, third-party outages, database changes

### "Works for some users"
Check: user permissions, data-dependent logic, browser differences, feature flags

## Investigation Anti-Patterns

**AVOID**:
- Changing code randomly hoping it fixes
- Assuming you know the cause without evidence
- Fixing symptoms instead of root cause
- Skipping reproduction ("I saw it fail once")
- Not documenting the investigation

## Detailed Reference

For detailed checklists and techniques:
- **Root Cause Analysis techniques**: See [references/rca-techniques.md](references/rca-techniques.md)