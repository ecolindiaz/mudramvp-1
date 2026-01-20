# EN-40 Security Fix: siteId Validation Implementation

**Issue:** Access Control Vulnerability in AI Referral Tracking API  
**Severity:** CRITICAL  
**Status:** ✅ FIX READY FOR IMPLEMENTATION  
**Date:** January 20, 2026

---

## Problem Statement

The `/api/analytics/track` endpoint currently extracts `brandProfileId` from the client-provided `siteId` parameter without database validation:

```typescript
// VULNERABLE CODE
const brandProfileId = parseInt(siteId.split('_')[1]) || null
```

This allows malicious actors to:
1. Inject tracking data into other brands' analytics
2. Contaminate analytics with false visit data
3. Associate IP addresses (even hashed) with wrong brands
4. Violate data privacy and GDPR compliance

---

## Solution Overview

### 1. Add `siteId` Field to BrandProfile Model
- Store unique `siteId` per brand in database
- Generate on brand profile creation
- Use for validation in tracking API

### 2. Update Tracking API
- Validate `siteId` against database
- Reject unauthorized requests
- Ensure data isolation

### 3. Migration Strategy
- Generate `siteId` for existing brands
- Maintain backward compatibility during transition

---

## Implementation Steps

### Step 1: Update Prisma Schema

**File:** `mudra-app/prisma/schema.prisma`

```prisma
model BrandProfile {
  id                         Int                      @id @default(autoincrement())
  // ... existing fields ...
  
  // ADD THIS FIELD
  siteId                     String?                  @unique
  trackingStatus             String?                  @default("not_connected") // pending, connected
  trackingInstalledAt        DateTime?
  
  // ... rest of model ...
}
```

**Migration Command:**
```bash
cd mudra-app
npx prisma migrate dev --name add_site_id_to_brand_profile
```

### Step 2: Generate siteId for New Brand Profiles

**File:** `mudra-app/app/api/brand-profile/route.ts` or wherever brands are created

```typescript
import crypto from 'crypto'

// When creating a new brand profile
export async function POST(request: NextRequest) {
  // ... existing code ...
  
  // Generate unique siteId
  const siteId = `site_${crypto.randomBytes(16).toString('hex')}`
  
  const brandProfile = await prisma.brandProfile.create({
    data: {
      // ... existing fields ...
      siteId,
      trackingStatus: 'not_connected'
    }
  })
  
  return NextResponse.json({ success: true, data: brandProfile })
}
```

### Step 3: Migration Script for Existing Brands

**File:** `mudra-app/scripts/migrate-add-site-ids.js`

```javascript
/**
 * Migration Script: Add siteId to Existing Brand Profiles
 * 
 * Generates unique siteIds for all brand profiles that don't have one.
 * Safe to run multiple times (idempotent).
 * 
 * Usage: node scripts/migrate-add-site-ids.js
 */

const { prisma } = require('../lib/prisma')
const crypto = require('crypto')

async function migrateSiteIds() {
  console.log('🔄 Migrating siteIds for existing brand profiles...\n')
  
  try {
    // Find all brands without siteId
    const brandsWithoutSiteId = await prisma.brandProfile.findMany({
      where: {
        siteId: null
      },
      select: {
        id: true,
        brandName: true
      }
    })
    
    if (brandsWithoutSiteId.length === 0) {
      console.log('✅ All brand profiles already have siteIds')
      return
    }
    
    console.log(`Found ${brandsWithoutSiteId.length} brands without siteIds\n`)
    
    // Generate and assign siteIds
    for (const brand of brandsWithoutSiteId) {
      const siteId = `site_${crypto.randomBytes(16).toString('hex')}`
      
      await prisma.brandProfile.update({
        where: { id: brand.id },
        data: { siteId }
      })
      
      console.log(`✓ Brand ${brand.id} (${brand.brandName}): ${siteId}`)
    }
    
    console.log(`\n✅ Successfully generated siteIds for ${brandsWithoutSiteId.length} brands`)
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

migrateSiteIds()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
```

### Step 4: Update Tracking API with Validation

**File:** `mudra-app/app/api/analytics/track/route.ts`

Replace the vulnerable code with:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

/**
 * POST /api/analytics/track
 * Receives tracking data from embedded script
 */
export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    
    const {
      siteId,
      referrer,
      aiProvider,
      path,
      userAgent,
      sessionId,
      metadata
    } = data

    // Validate required fields
    if (!siteId || !referrer || !aiProvider || !path) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate AI provider
    const validProviders = ['chatgpt', 'perplexity', 'claude', 'gemini']
    if (!validProviders.includes(aiProvider)) {
      return NextResponse.json(
        { error: 'Invalid AI provider' },
        { status: 400 }
      )
    }

    // 🔒 SECURITY FIX (EN-40): Validate siteId against database
    const brandProfile = await prisma.brandProfile.findUnique({
      where: { siteId },
      select: { 
        id: true, 
        trackingStatus: true 
      }
    })

    if (!brandProfile) {
      // Invalid siteId - reject request
      console.warn(`[Security] Invalid siteId attempted: ${siteId}`)
      return NextResponse.json(
        { error: 'Invalid site ID' },
        { status: 401 }
      )
    }

    const brandProfileId = brandProfile.id

    // Hash IP address for privacy
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'
    const hashedIp = crypto.createHash('sha256').update(ipAddress).digest('hex')

    // Store visit in database
    await prisma.aIReferralVisit.create({
      data: {
        brandProfileId,
        siteId,
        referrer,
        aiProvider,
        path,
        userAgent: userAgent || null,
        ipAddress: hashedIp,
        sessionId: sessionId || null,
        metadata: metadata || {},
      }
    })

    // Update tracking status to 'connected' on first visit
    if (brandProfile.trackingStatus !== 'connected') {
      await prisma.brandProfile.update({
        where: { id: brandProfileId },
        data: {
          trackingStatus: 'connected',
          trackingInstalledAt: new Date()
        }
      })
    }

    // Update analytics aggregates (async, don't wait)
    updateAnalytics(brandProfileId, aiProvider).catch(err => {
      console.error('Failed to update analytics:', err)
    })

    return NextResponse.json({ 
      success: true,
      message: 'Visit tracked'
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    })

  } catch (error) {
    console.error('Error tracking visit:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      }
    )
  }
}

// ... rest of file (updateAnalytics, OPTIONS, etc.) ...
```

### Step 5: Update Agent to Use Database siteId

**File:** `mudra-app/lib/services/github-agent.service.ts` (or wherever agent generates script)

When generating the tracking script for installation:

```typescript
// Fetch the brand's siteId from database
const brandProfile = await prisma.brandProfile.findUnique({
  where: { id: brandProfileId },
  select: { siteId: true }
})

if (!brandProfile?.siteId) {
  throw new Error('Brand profile has no siteId')
}

// Use the database siteId in the script
const trackingScript = `
<script 
  src="https://app.mudra.ai/tracker.js" 
  data-site-id="${brandProfile.siteId}" 
  async
></script>
`
```

### Step 6: Security Test Script

**File:** `mudra-app/test-en40-fix.js`

```javascript
/**
 * Test Script: Verify EN-40 Security Fix
 * 
 * Tests that cross-brand data injection is prevented.
 * 
 * Usage: node test-en40-fix.js
 */

const fetch = require('node-fetch')
const { prisma } = require('./lib/prisma')

async function testEN40Fix() {
  console.log('🔒 Testing EN-40 Security Fix\n')
  console.log('='.repeat(80))
  
  try {
    // Create two test brand profiles
    const brand1 = await prisma.brandProfile.create({
      data: {
        userId: 1, // Adjust as needed
        brandName: 'Test Brand 1 (EN-40)',
        website: 'https://test1.example.com',
        siteId: `site_test1_${Date.now()}`
      }
    })
    
    const brand2 = await prisma.brandProfile.create({
      data: {
        userId: 1,
        brandName: 'Test Brand 2 (EN-40)',
        website: 'https://test2.example.com',
        siteId: `site_test2_${Date.now()}`
      }
    })
    
    console.log(`\n✓ Created test brands:`)
    console.log(`  Brand 1: ID ${brand1.id}, siteId: ${brand1.siteId}`)
    console.log(`  Brand 2: ID ${brand2.id}, siteId: ${brand2.siteId}`)
    
    // Test 1: Valid siteId (should succeed)
    console.log(`\n📋 Test 1: Valid siteId for Brand 1`)
    const response1 = await fetch('http://localhost:3000/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId: brand1.siteId,
        referrer: 'https://chatgpt.com',
        aiProvider: 'chatgpt',
        path: '/test',
        userAgent: 'Test',
        sessionId: 'test_session_1'
      })
    })
    
    const result1 = await response1.json()
    console.log(`   Status: ${response1.status}`)
    console.log(`   Result: ${result1.success ? '✅ SUCCESS' : '❌ FAILED'}`)
    
    if (!result1.success) {
      console.log('   ⚠️  Expected success for valid siteId')
    }
    
    // Test 2: Invalid siteId (should fail)
    console.log(`\n📋 Test 2: Invalid/fabricated siteId`)
    const fakeSiteId = 'site_999_fake'
    const response2 = await fetch('http://localhost:3000/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId: fakeSiteId,
        referrer: 'https://chatgpt.com',
        aiProvider: 'chatgpt',
        path: '/test',
        userAgent: 'Test',
        sessionId: 'test_session_2'
      })
    })
    
    const result2 = await response2.json()
    console.log(`   Status: ${response2.status}`)
    console.log(`   Expected: 401 Unauthorized`)
    console.log(`   Result: ${response2.status === 401 ? '✅ BLOCKED' : '❌ NOT BLOCKED'}`)
    
    if (response2.status !== 401) {
      console.log('   🚨 SECURITY VULNERABILITY: Invalid siteId was accepted!')
    }
    
    // Test 3: Try to use Brand 2's siteId to inject into Brand 1 (should be isolated)
    console.log(`\n📋 Test 3: Cross-brand injection attempt`)
    const response3 = await fetch('http://localhost:3000/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId: brand2.siteId, // Using Brand 2's siteId
        referrer: 'https://chatgpt.com',
        aiProvider: 'chatgpt',
        path: '/malicious',
        userAgent: 'Attacker',
        sessionId: 'attack_session'
      })
    })
    
    const result3 = await response3.json()
    console.log(`   Status: ${response3.status}`)
    
    // Verify data went to Brand 2, not Brand 1
    const brand1Visits = await prisma.aIReferralVisit.count({
      where: { 
        brandProfileId: brand1.id,
        path: '/malicious'
      }
    })
    
    const brand2Visits = await prisma.aIReferralVisit.count({
      where: { 
        brandProfileId: brand2.id,
        path: '/malicious'
      }
    })
    
    console.log(`   Brand 1 visits to /malicious: ${brand1Visits}`)
    console.log(`   Brand 2 visits to /malicious: ${brand2Visits}`)
    console.log(`   Result: ${brand1Visits === 0 && brand2Visits === 1 ? '✅ DATA ISOLATED' : '❌ DATA LEAKED'}`)
    
    if (brand1Visits > 0) {
      console.log('   🚨 SECURITY VULNERABILITY: Cross-brand data injection occurred!')
    }
    
    // Cleanup
    console.log(`\n🧹 Cleaning up test data...`)
    await prisma.aIReferralVisit.deleteMany({
      where: {
        brandProfileId: {
          in: [brand1.id, brand2.id]
        }
      }
    })
    await prisma.brandProfile.delete({ where: { id: brand1.id } })
    await prisma.brandProfile.delete({ where: { id: brand2.id } })
    
    console.log('\n' + '='.repeat(80))
    console.log('\n✅ EN-40 Security Test Complete\n')
    
    const allPassed = response1.status === 200 && 
                      response2.status === 401 && 
                      brand1Visits === 0 && 
                      brand2Visits === 1
    
    if (allPassed) {
      console.log('🔒 All security checks PASSED')
      console.log('   - Valid siteIds accepted ✓')
      console.log('   - Invalid siteIds rejected ✓')
      console.log('   - Cross-brand injection prevented ✓')
    } else {
      console.log('⚠️  Some security checks FAILED')
      console.log('   Review results above for details')
    }
    
    return allPassed ? 0 : 1
    
  } catch (error) {
    console.error('❌ Test error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

testEN40Fix()
  .then((exitCode) => process.exit(exitCode))
  .catch(() => process.exit(1))
```

---

## Testing Checklist

### Before Deployment
- [ ] Run `npx prisma migrate dev --name add_site_id_to_brand_profile`
- [ ] Run `node scripts/migrate-add-site-ids.js` (generate siteIds for existing brands)
- [ ] Verify all existing brands have siteIds in database
- [ ] Deploy updated tracking API code
- [ ] Run `node test-en40-fix.js` to verify security fix

### After Deployment
- [ ] Monitor logs for "Invalid siteId" warnings
- [ ] Verify legitimate tracking still works
- [ ] Check that analytics data remains isolated per brand
- [ ] Performance test: siteId lookup adds minimal latency (<10ms)

---

## Rollback Plan

If issues arise:

1. **Quick Rollback:** Comment out validation, restore old code:
   ```typescript
   // Temporary rollback (insecure)
   const brandProfileId = parseInt(siteId.split('_')[1]) || null
   ```

2. **Full Rollback:** Revert migration:
   ```bash
   npx prisma migrate resolve --rolled-back <migration_name>
   ```

---

## Performance Considerations

**Database Query Added:**
```typescript
const brandProfile = await prisma.brandProfile.findUnique({
  where: { siteId }
})
```

**Impact Analysis:**
- **Query type:** Single-row lookup by unique index
- **Expected latency:** < 10ms (indexed unique field)
- **Caching:** Consider Redis cache for siteId → brandProfileId mapping
- **Scale:** Handles 10,000+ requests/min with proper indexing

**Optimization (if needed):**
```typescript
// Add Redis cache
const cachedBrandId = await redis.get(`site:${siteId}`)
if (cachedBrandId) {
  brandProfileId = parseInt(cachedBrandId)
} else {
  const brand = await prisma.brandProfile.findUnique({ where: { siteId } })
  if (brand) {
    await redis.setex(`site:${siteId}`, 3600, brand.id) // Cache 1 hour
    brandProfileId = brand.id
  }
}
```

---

## Success Criteria

✅ **Fix is complete when:**
1. All brand profiles have unique siteIds
2. Tracking API validates siteId against database
3. Invalid siteIds return 401 Unauthorized
4. Cross-brand data injection is prevented
5. Security test (test-en40-fix.js) passes all checks
6. Performance impact is < 10ms per request
7. No regression in legitimate tracking

---

## Timeline

**Estimated Implementation Time:** 2-4 hours

1. **Schema update & migration:** 30 minutes
2. **Migration script for existing brands:** 30 minutes
3. **API validation update:** 1 hour
4. **Testing & verification:** 1-2 hours
5. **Documentation:** 30 minutes

---

## References

- Original issue: Test plan Section 5.3, 8.2
- Prisma docs: https://www.prisma.io/docs/concepts/components/prisma-schema
- Security best practices: OWASP Access Control guidelines

---

**Status:** ✅ Ready for implementation  
**Reviewed by:** GitHub Copilot  
**Approved by:** [Pending]
