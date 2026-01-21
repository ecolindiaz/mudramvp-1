# Root Cause Analysis Techniques

Detailed techniques for investigating complex issues.

## The 5 Whys Technique

Start with the symptom and ask "why" repeatedly:

```
Problem: Users can't log in

Why? → Login API returns 500 error
Why? → Database query fails
Why? → Connection timeout
Why? → Connection pool exhausted
Why? → Connections not being released after use

ROOT CAUSE: Missing connection.release() in error handler
```

**Rules**:
- Base each answer on evidence, not assumption
- Stop when you reach something actionable
- If you get stuck, gather more evidence

## Fishbone Diagram Categories

When investigating, consider all potential cause categories:

```
                    ┌─────────────────────────────────────┐
  People            │                                     │  Process
  ├─ Misconfigured  │                                     │  ├─ Wrong deployment
  ├─ Wrong data     │         PRODUCTION ISSUE            │  ├─ Missing migration
  └─ User error     │                                     │  └─ Skipped tests
                    └─────────────────────────────────────┘
  Technology                                               Environment
  ├─ Bug in code    │                                     │  ├─ Wrong env vars
  ├─ Library issue  │                                     │  ├─ Network/firewall
  └─ Race condition │                                     │  └─ Resource limits
```

## Defect Origin Categories

Trace where the defect was INTRODUCED:

| Origin | Description | Investigation Focus |
|--------|-------------|---------------------|
| Requirements | Missing/unclear specs | Check PRD, user stories |
| Design | Architecture flaw | Review system design docs |
| Implementation | Coding error | Review code changes |
| Testing | Missed test case | Review test coverage |
| Deployment | Config/migration error | Check deploy logs |
| External | Third-party change | Check vendor status pages |

## Evidence Collection Checklist

### Logs
- [ ] Application logs (errors, warnings)
- [ ] Server/container logs
- [ ] Database slow query logs
- [ ] Network/load balancer logs
- [ ] Third-party service logs

### Metrics
- [ ] Error rates and timing
- [ ] Response times (p50, p95, p99)
- [ ] CPU, memory, disk usage
- [ ] Database connection count
- [ ] Queue depths

### Code
- [ ] Recent commits to affected area
- [ ] Related PRs and their discussions
- [ ] Configuration file changes
- [ ] Database migration history

### Environment
- [ ] Env var differences (prod vs staging)
- [ ] Feature flag states
- [ ] DNS resolution
- [ ] SSL certificate validity

## Isolation Techniques

### API Layer Testing
```bash
# Test endpoint directly
curl -v -X POST https://api.example.com/endpoint \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'

# Check response headers
curl -I https://api.example.com/health
```

### Database Testing
```sql
-- Test the exact query your code runs
EXPLAIN ANALYZE SELECT * FROM users WHERE condition;

-- Check for locks
SELECT * FROM pg_locks WHERE NOT granted;

-- Check connection count
SELECT count(*) FROM pg_stat_activity;
```

### Frontend Isolation
```javascript
// Test API response directly in console
fetch('/api/endpoint')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);

// Check component state
$0.__reactProps$  // React DevTools
```

## Time-Based Investigation

When issue started at specific time:

```bash
# Find what deployed around that time
git log --after="2024-01-15 14:00" --before="2024-01-15 16:00"

# Check CI/CD deploy history
# Check database migration timestamps
# Check config change audit logs
```

## Diff-Based Investigation

Compare working vs non-working state:

```bash
# Compare configs
diff staging.env production.env

# Compare database schemas
pg_dump -s staging_db > staging_schema.sql
pg_dump -s prod_db > prod_schema.sql
diff staging_schema.sql prod_schema.sql

# Compare package versions
diff staging-package-lock.json prod-package-lock.json
```

## Documentation Template

After resolving, document:

```markdown
## Issue: [Brief description]

**Reported**: [date/time]
**Resolved**: [date/time]
**Severity**: [Critical/High/Medium/Low]

### Symptoms
- [What users experienced]

### Root Cause
- [The actual underlying issue]

### Investigation Path
1. [What you checked first]
2. [What led you to the cause]

### Fix
- [What was changed]
- [PR/commit link]

### Prevention
- [ ] Test case added
- [ ] Monitoring added
- [ ] Documentation updated
```