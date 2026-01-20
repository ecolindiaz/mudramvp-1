# Quick Deployment Guide - AI Referral Traffic

## 🚀 Deploy in 5 Minutes

Follow these steps to deploy the production-ready AI Referral Traffic feature.

---

## Step 1: Database Schema Update ✅ DONE

The schema has already been updated with:
```bash
npx prisma db push --accept-data-loss
```

**Status:** ✅ Complete - Prisma Client regenerated

---

## Step 2: Generate siteIds for Existing Brands

Run the migration script to add siteIds to existing brand profiles:

```bash
cd mudra-app
node scripts/migrate-site-ids-standalone.js
```

**Expected Output:**
```
🔄 Starting siteId migration for brand profiles...
Found X brand profiles without siteIds
✓ Brand 1 (Company Name): siteId: site_...
✓ Brand 2 (Company Name): siteId: site_...
✅ Migration completed successfully!
```

**If no brands exist:**
```
✅ All brand profiles already have siteIds
No migration needed.
```

---

## Step 3: Verify Migration (Optional)

Check that all brands have siteIds:

```bash
npx prisma studio
```

1. Open BrandProfile table
2. Check that `siteId` column has values for all rows
3. Verify siteIds are unique (format: `site_[32-char-hex]`)

---

## Step 4: Run Security Tests (Optional)

Validate that the EN-40 fix is working:

```bash
node scripts/test-en40-standalone.js
```

**Expected Output:**
```
🔒 Testing EN-40 Security Fix
...
📊 Test Results Summary:
   1. Valid siteId accepted              ✅ PASS
   2. Invalid siteId rejected (401)      ✅ PASS
   3. Cross-brand isolation              ✅ PASS
   4. Data integrity                     ✅ PASS

🎉 All EN-40 Security Tests PASSED!
```

**If tests fail:** Review the output and check that:
- App is running on localhost:3000
- Database schema is up to date
- Prisma Client is regenerated

---

## Step 5: Deploy to Production

### Option A: Vercel/Netlify (Automatic)

1. Push changes to your git repository:
   ```bash
   git add .
   git commit -m "feat: AI Referral Tracking - Security hardened (EN-40 fix)"
   git push origin main
   ```

2. Your deployment platform will automatically:
   - Build the application
   - Run `npx prisma generate`
   - Deploy to production

3. After deployment, run the migration script on production:
   ```bash
   # SSH into production or use platform CLI
   node scripts/migrate-site-ids-standalone.js
   ```

### Option B: Manual Deployment

1. Build the application:
   ```bash
   cd mudra-app
   npm run build
   ```

2. Deploy the built application to your server

3. On the production server, run:
   ```bash
   npx prisma generate
   node scripts/migrate-site-ids-standalone.js
   ```

4. Start the application:
   ```bash
   npm start
   ```

---

## Step 6: Post-Deployment Verification

### 6.1 Check Application Health

```bash
curl https://your-production-url.com/tracker.js
# Should return JavaScript code (~3KB)
```

### 6.2 Test Tracking API

```bash
curl -X POST https://your-production-url.com/api/analytics/track \
  -H "Content-Type: application/json" \
  -d '{
    "siteId": "invalid_test",
    "referrer": "https://chatgpt.com",
    "aiProvider": "chatgpt",
    "path": "/test"
  }'
```

**Expected Response:** `401 Unauthorized` with `{"error": "Invalid site ID"}`

### 6.3 Monitor Logs

Check application logs for:
- `[Security] Invalid siteId attempted:` - Expected for invalid siteIds
- `[RateLimit] Exceeded limit for siteId:` - Expected if rate limit hit
- No unexpected errors

---

## Step 7: Customer Onboarding

### For New Customers

1. They create a brand profile → `siteId` is auto-generated ✅
2. They navigate to AI Referral Traffic card
3. Click "Auto-Install with Agent" or copy manual script
4. Install tracking script on their website
5. Visits from AI platforms start appearing in dashboard ✅

### For Existing Customers

1. Their brand profiles now have `siteId` (from migration) ✅
2. Next time they access AI Referral Traffic card, they can install tracking
3. Everything works seamlessly ✅

---

## Rollback Plan (If Needed)

If critical issues arise in production:

### Quick Rollback (Code Only)

1. Revert the git commit:
   ```bash
   git revert HEAD
   git push origin main
   ```

2. The `siteId` field in database can remain (doesn't break anything)

### Full Rollback (Including Database)

1. Revert code (as above)

2. Remove siteId validation from tracking API:
   ```typescript
   // Temporary rollback (INSECURE - for emergency only)
   const brandProfileId = parseInt(siteId.split('_')[1]) || null
   ```

3. Deploy the rollback version

**Note:** Only use full rollback in emergency. The security fix should remain in place.

---

## Monitoring After Deployment

### Key Metrics to Watch (First 24 Hours)

1. **Tracking API Success Rate**
   - Target: > 99%
   - Watch for sudden spikes in 401 errors

2. **Response Time**
   - Target: < 200ms (p95)
   - Watch for slow database queries

3. **Visit Volume**
   - Gradually increases as customers install tracking
   - Should see visits from ChatGPT, Claude, Perplexity, Gemini

4. **Error Logs**
   - Check for unexpected errors
   - Investigate any `[Security]` warnings

### Set Up Alerts

Configure alerts for:
- API error rate > 5% (5 min window)
- API latency p95 > 500ms (5 min window)
- Zero visits for > 1 hour (if tracking expected)

---

## Troubleshooting

### Issue: Migration script shows "Cannot find module"

**Solution:** Use the standalone version:
```bash
node scripts/migrate-site-ids-standalone.js
```

### Issue: Database connection error

**Solution:** Check DATABASE_URL in `.env` or `.env.local`:
```bash
echo $DATABASE_URL  # Linux/Mac
$env:DATABASE_URL   # Windows PowerShell
```

### Issue: Tracking returns 401 for valid users

**Solution:** 
1. Check that brand profile has a siteId:
   ```bash
   npx prisma studio
   ```
2. Run migration script if siteId is null
3. Verify tracking script uses the correct siteId

### Issue: Security tests fail

**Solution:**
1. Ensure app is running (localhost:3000)
2. Check that schema changes are applied
3. Regenerate Prisma Client: `npx prisma generate`

---

## Success Checklist

After deployment, verify:

- [ ] Application is running and accessible
- [ ] `/tracker.js` endpoint returns JavaScript
- [ ] All brand profiles have unique siteIds
- [ ] Tracking API validates siteIds (returns 401 for invalid)
- [ ] Dashboard displays AI Referral Traffic card
- [ ] No errors in application logs
- [ ] Monitoring/alerts are configured

---

## Next Steps

1. **Customer Communication**
   - Announce new feature availability
   - Provide installation guide
   - Offer demo/walkthrough

2. **Monitor Adoption**
   - Track how many customers install tracking
   - Collect feedback
   - Iterate on UX

3. **Future Enhancements**
   - WebSocket real-time updates
   - Export functionality
   - Custom alerts
   - A/B testing support

---

## Support

**Issues?** Check:
- [PRODUCTION_READY.md](PRODUCTION_READY.md) - Full documentation
- [AI_REFERRAL_TESTING_EXECUTION.md](AI_REFERRAL_TESTING_EXECUTION.md) - Test plan
- [EN40_SECURITY_FIX.md](EN40_SECURITY_FIX.md) - Security details

**Still stuck?** Run diagnostics:
```bash
node check-ai-referral-visits.js
node check-ip-hashing.js
node test-api-performance.js
```

---

**Deployment Time:** ~5 minutes  
**Difficulty:** Easy  
**Risk:** Low (tested + rollback plan available)

**Good luck! 🚀**
