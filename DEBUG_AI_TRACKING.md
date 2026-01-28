# Debug AI Referral Tracking - Step by Step

## Quick Test Steps

### 1. Check Browser Console
Visit: `https://www.trymudra.com/?utm_source=chatgpt.com`

Open DevTools (F12) → Console tab. You should see:
```
[Mudra] AI referrer detected: chatgpt from URL parameter
[Mudra] Sending tracking data to: https://app.trymudra.com/api/analytics/track
[Mudra] Data: { ... }
[Mudra] Beacon sent: true
```

**If you DON'T see these logs:**
- Tracking script not loaded
- Check Network tab for `tracker.js` - should be 200 OK
- Verify script tag is in MudraWebsite repo

### 2. Check Network Tab
DevTools → Network tab → Filter: "track"

Look for POST to `/api/analytics/track`

**Success = 200 OK with response:**
```json
{
  "success": true,
  "message": "Visit tracked"
}
```

**Failure scenarios:**

**401 "Invalid site ID"**
- Your siteId doesn't exist in database
- Run this to check:
```powershell
cd mudra-app
# Check what siteId is in database
node -e "require('dotenv').config({path:'.env.local'});const{PrismaClient}=require('@prisma/client');(async()=>{const p=new PrismaClient();const bp=await p.brandProfile.findFirst({where:{userId:1}});console.log('Database siteId:',bp?.siteId);await p.$disconnect()})();"
```

**400 "Missing required fields"**
- tracker.js isn't sending correct data
- Check console logs for what was sent

**CORS Error**
- Means the request is being blocked
- Should see CORS headers in response

### 3. Check Server Logs (Vercel)
Go to: https://vercel.com/your-project/logs

Filter for: `[AI Referral Track]`

You should see:
```
[AI Referral Track] Incoming request: { siteId: 'site_xxx', aiProvider: 'chatgpt', ... }
[AI Referral Track] Valid siteId, brandProfileId: 1
[AI Referral Track] Visit stored: 123
[AI Referral Track] Updated trackingStatus to connected
```

### 4. Test tracker.js is Loading
Visit: https://app.trymudra.com/tracker.js

Should return JavaScript code (not 404)

### 5. Manual API Test
Run this in browser console on trymudra.com:
```javascript
fetch('https://app.trymudra.com/api/analytics/track', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    siteId: 'site_479bdc12ab148ed5cf08ad3905ffb544',
    referrer: window.location.href,
    aiProvider: 'chatgpt',
    path: window.location.pathname,
    userAgent: navigator.userAgent,
    sessionId: 'test_' + Date.now(),
    metadata: {}
  })
})
.then(r => r.json())
.then(d => console.log('Response:', d))
.catch(e => console.error('Error:', e))
```

Expected response:
```json
{
  "success": true,
  "message": "Visit tracked"
}
```

## Common Issues & Fixes

### Issue: tracker.js returns 404
**Cause:** File not deployed or wrong URL
**Fix:** 
- Check file exists: `mudra-app/public/tracker.js`
- Rebuild and redeploy

### Issue: "Invalid site ID" (401)
**Cause:** siteId mismatch between script and database
**Fix:**
1. Get correct siteId from dashboard or database
2. Update script in MudraWebsite:
```tsx
<Script 
  src="https://app.trymudra.com/tracker.js"
  data-site-id="YOUR_ACTUAL_SITE_ID_HERE"
  strategy="afterInteractive"
/>
```

### Issue: Script loads but no tracking
**Cause:** AI detection not working
**Fix:** Make sure URL has AI source:
- `?utm_source=chatgpt.com` ✅
- `?source=perplexity` ✅
- `?ref=claude` ✅
- Just visiting from Google ❌ (not AI)

### Issue: CORS errors
**Cause:** API not allowing cross-origin requests
**Fix:** Already handled - API returns CORS headers

### Issue: Data not showing in dashboard
**Cause:** Analytics aggregation delay
**Fix:** 
- Check raw visits in database
- Analytics aggregates daily
- Dashboard might cache for a few minutes

## Check Database Directly

```powershell
cd mudra-app

# Check if visits are being stored
node -e "require('dotenv').config({path:'.env.local'});const{PrismaClient}=require('@prisma/client');(async()=>{const p=new PrismaClient();const visits=await p.aIReferralVisit.findMany({orderBy:{visitedAt:'desc'},take:5});console.log('Recent visits:',visits);await p.$disconnect()})();"

# Check analytics aggregates
node -e "require('dotenv').config({path:'.env.local'});const{PrismaClient}=require('@prisma/client');(async()=>{const p=new PrismaClient();const analytics=await p.aIReferralAnalytics.findMany({orderBy:{periodStart:'desc'},take:5});console.log('Analytics:',analytics);await p.$disconnect()})();"
```

## Production Checklist

- [ ] MudraWebsite has correct tracking script
- [ ] Script deployed to production (vercel/netlify)
- [ ] tracker.js accessible at app.trymudra.com/tracker.js
- [ ] siteId matches database (site_479bdc12ab148ed5cf08ad3905ffb544)
- [ ] Visited with AI source in URL (?utm_source=chatgpt.com)
- [ ] Browser console shows tracking logs
- [ ] Network tab shows 200 OK response
- [ ] Vercel logs show tracking activity
- [ ] Dashboard refreshed (hard refresh: Ctrl+Shift+R)

## Still Not Working?

1. **Clear browser cache** - Hard refresh (Ctrl+Shift+R)
2. **Check siteId** - Most common issue is mismatch
3. **Wait 2-3 minutes** - Dashboard has caching
4. **Check Vercel logs** - Shows exactly what's happening server-side
5. **Try incognito window** - Eliminates extension interference

## Success Indicators

✅ Console: `[Mudra] Beacon sent: true`
✅ Network: POST 200 OK
✅ Logs: `[AI Referral Track] Visit stored`
✅ Database: AIReferralVisit row created
✅ Dashboard: Number increases (may take 1-2 min)
