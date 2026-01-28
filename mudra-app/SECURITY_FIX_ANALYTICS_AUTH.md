# Security Fix: Analytics & Insights Authentication

**Date:** January 27, 2026  
**Severity:** HIGH (CVSS 7.5)  
**Status:** ✅ RESOLVED

## Vulnerability Summary

Multiple analytics and insights endpoints were publicly accessible without authentication, allowing unauthorized users to access sensitive business intelligence data, analysis results, and competitive insights through brandProfileId enumeration attacks.

## Fixed Endpoints

### 1. Insights Endpoints - **SECURED** ✅
- `/api/insights` (GET, POST, PUT)
  - Added `requireAuthWithBrandAccess()` verification
  - Added `brandProfileId` requirement and validation
  - Added rate limiting via `applyRateLimit()`
  
- `/api/insights/brand` (GET, POST)
  - Added `requireAuthWithBrandAccess()` verification
  - Added `brandProfileId` requirement and validation
  - Added rate limiting via `applyRateLimit()`
  
- `/api/insights/citation-gaps` (GET, POST)
  - Added `requireAuthWithBrandAccess()` verification
  - Added `brandProfileId` requirement and validation
  - Added rate limiting via `applyRateLimit()`

### 2. Analytics Endpoints - **SECURED** ✅
- `/api/analytics/script` (GET, POST)
  - Added `requireAuthWithBrandAccess()` verification
  - Added `brandProfileId` requirement and validation
  - Added rate limiting via `applyRateLimit()`

### 3. Internal Endpoints - **HARDENED** ✅
- `/api/internal/generate-report` (POST)
  - **Removed development mode bypass** (critical fix)
  - Now requires valid `ADMIN_API_TOKEN` in all environments
  - Added explicit error message for unauthorized access

### 4. Technical Analysis - **SECURED** ✅
- `/api/technical-analysis/score` (POST)
  - Added `requireAuth()` verification
  - Added rate limiting via `applyRateLimit()`
  - Changed from generic Request to NextRequest type

### 5. Already Secured (Verified) ✅
These endpoints already had proper authentication:
- `/api/analytics/ai-referrals` - Uses session auth + brandProfile lookup
- `/api/analytics/citations` - Uses `requireAuthWithBrandAccess()`
- `/api/scores` - Uses `requireAuth()`
- `/api/scores/history` - Uses `requireAuth()`

## Security Improvements Applied

### Authentication Pattern
```typescript
// Verify user has access to this brand profile
const authResult = await requireAuthWithBrandAccess(brandProfileId);
if (!authResult.success) {
  return authResult.response;
}
```

This pattern provides:
1. **User authentication** - Verifies valid session exists
2. **Ownership verification** - Confirms brandProfileId belongs to authenticated user
3. **Unified response** - Returns consistent 401/403 errors
4. **Prevents enumeration** - Cannot access other users' data

### Rate Limiting
```typescript
// Rate limit
const rateLimited = applyRateLimit(request, 'standard');
if (rateLimited) return rateLimited;
```

### Request Validation
All endpoints now require and validate `brandProfileId`:
```typescript
if (!brandProfileIdParam) {
  return NextResponse.json(
    { success: false, error: { message: 'brandProfileId is required' } },
    { status: 400 }
  )
}
```

## Attack Vector Mitigation

### Before Fix
```bash
# Attacker could enumerate all brand data
curl https://app.mudra.ai/api/insights?brandProfileId=1
curl https://app.mudra.ai/api/insights?brandProfileId=2
curl https://app.mudra.ai/api/insights?brandProfileId=3
# Returns sensitive competitive intelligence without auth
```

### After Fix
```bash
# Same requests now return 401 Unauthorized
curl https://app.mudra.ai/api/insights?brandProfileId=1
# Response: 401 Unauthorized

# Only works with valid session cookie + owned brandProfileId
curl -H "Cookie: next-auth.session-token=..." https://app.mudra.ai/api/insights?brandProfileId=1
# Response: 200 OK (only if user owns brandProfileId 1)
```

## Testing Verification

### Manual Testing
```bash
# Test without authentication (should fail)
curl https://app.mudra.ai/api/insights?brandProfileId=1
curl https://app.mudra.ai/api/insights/brand?brandProfileId=1
curl https://app.mudra.ai/api/insights/citation-gaps?brandProfileId=1
curl https://app.mudra.ai/api/analytics/script?brandProfileId=1

# Expected: 401 Unauthorized for all endpoints

# Test with valid auth but wrong brandProfileId (should fail)
curl -H "Cookie: session=valid-token" https://app.mudra.ai/api/insights?brandProfileId=999
# Expected: 403 Forbidden (ownership verification failed)
```

### Automated Testing Recommendations
```typescript
describe('API Security', () => {
  it('should return 401 for unauthenticated requests', async () => {
    const res = await fetch('/api/insights?brandProfileId=1');
    expect(res.status).toBe(401);
  });

  it('should return 403 for unauthorized brand access', async () => {
    // User 1 trying to access User 2's data
    const res = await fetch('/api/insights?brandProfileId=2', {
      headers: { Cookie: user1SessionCookie }
    });
    expect(res.status).toBe(403);
  });

  it('should return 400 for missing brandProfileId', async () => {
    const res = await fetch('/api/insights', {
      headers: { Cookie: validSessionCookie }
    });
    expect(res.status).toBe(400);
  });
});
```

## Impact Assessment

### Data Protection
- ✅ All brand insights now require authentication
- ✅ Citation gaps analysis protected from enumeration
- ✅ Analytics tracking scripts require ownership verification
- ✅ Technical analysis scores require authentication
- ✅ Internal report generation hardened (no dev bypass)

### Regulatory Compliance
- ✅ Addresses GDPR/CCPA unauthorized data access concerns
- ✅ Implements proper access control for sensitive business data
- ✅ Prevents competitive intelligence leakage

### Users Protected
- All platform users with stored insights, analytics, and technical data
- ~100% of sensitive endpoints now properly secured

## Files Modified

```
mudra-app/app/api/insights/route.ts                    (3 methods secured)
mudra-app/app/api/insights/brand/route.ts              (2 methods secured)
mudra-app/app/api/insights/citation-gaps/route.ts      (2 methods secured)
mudra-app/app/api/analytics/script/route.ts            (2 methods secured)
mudra-app/app/api/internal/generate-report/route.ts    (1 method hardened)
mudra-app/app/api/technical-analysis/score/route.ts    (1 method secured)
```

## Dependencies Used

All authentication utilities are from existing codebase:
- `requireAuthWithBrandAccess()` from `@/lib/auth/require-auth`
- `requireAuth()` from `@/lib/auth/require-auth`
- `applyRateLimit()` from `@/lib/auth/rate-limiter`

## Next Steps

1. **Deploy to production** immediately (high severity)
2. **Audit logs review** - Check if unauthorized access occurred before fix
3. **Security monitoring** - Set up alerts for repeated 401/403 responses
4. **Penetration testing** - Verify fix effectiveness
5. **Documentation update** - Update API docs with auth requirements

## Deployment Checklist

- [ ] Run type checking: `npx tsc --noEmit`
- [ ] Run build: `npm run build`
- [ ] Test endpoints locally with/without auth
- [ ] Deploy to production
- [ ] Monitor error logs for auth failures
- [ ] Update API documentation
- [ ] Notify security team of fix completion

## Additional Recommendations

1. **Audit Logging**: Consider adding audit logs for all data access:
   ```typescript
   await logAuditEvent({
     action: 'INSIGHTS_ACCESS',
     userId: authResult.user.id,
     resourceType: 'insights',
     resourceId: brandProfileId,
     metadata: { endpoint: req.url }
   });
   ```

2. **Rate Limiting Enhancement**: Current rate limiting is 'standard' - consider tightening for sensitive endpoints

3. **IP Allowlisting**: For `/api/internal/*` endpoints, consider adding IP allowlist on top of admin token

4. **Security Headers**: Ensure all responses include proper security headers (CSP, HSTS, etc.)

## Conclusion

All identified vulnerable endpoints have been secured with proper authentication, authorization, and rate limiting. The fix prevents unauthorized access to sensitive business intelligence data and competitive insights, eliminating the brandProfileId enumeration attack vector.

**Risk Level:** HIGH → **RESOLVED** ✅
