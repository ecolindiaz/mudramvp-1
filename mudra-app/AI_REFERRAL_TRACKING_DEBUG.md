# AI Referral Tracking - Connection Debugging Guide

## ❌ Problem: "Not detected" after merging tracking PR

This guide helps you diagnose why the tracking connection is not being detected.

---

## 🔍 Quick Diagnostic Checklist

### 1. **Check if siteId exists**
Open your dashboard at `http://localhost:3000/dashboard` and check browser console:

```javascript
// Should show your siteId like "sk_live_abc123xyz"
localStorage.getItem('mudra:siteId')
```

**Expected:** `sk_live_abc123xyz` or similar  
**If null:** The siteId wasn't generated. Copy the tracking script from dashboard to regenerate it.

---

### 2. **Verify script installation on your website**

Go to your website where the PR was merged, then:

1. Right-click → View Page Source (Ctrl+U)
2. Search for "mudra" or "data-site-id"
3. You should see something like:

```html
<script>
  (function() {
    var script = document.createElement('script');
    script.src = 'http://localhost:3000/tracker.js';  <!-- or https://app.trymudra.com/tracker.js -->
    script.async = true;
    script.setAttribute('data-site-id', 'sk_live_YOUR_SITEID');
    document.head.appendChild(script);
  })();
</script>
```

**If missing:** The PR didn't deploy correctly or the file wasn't properly updated.

---

### 3. **Test with simulated AI referrer**

**CRITICAL:** The tracker ONLY fires when you visit from an AI chat interface.

#### Option A: Test locally with DevTools

On your website, open DevTools Console and run:

```javascript
// Simulate ChatGPT referrer
Object.defineProperty(document, 'referrer', {
  get: function() { return 'https://chatgpt.com/'; }
});

// Reload the page
location.reload();
```

After reload, check Network tab for:
- POST request to `/api/analytics/track`
- Status: 200 OK
- Response: `{ success: true, message: "Visit tracked" }`

#### Option B: Test with real AI referrer

1. Go to ChatGPT, Perplexity, Claude, or Gemini
2. Ask it about your company/product
3. Click the link in the response
4. This will set `document.referrer` to the AI platform
5. Check Network tab for tracking request

---

### 4. **Check if data reached the database**

Run Prisma Studio to inspect the database:

```powershell
npx prisma studio
```

1. Navigate to `AIReferralVisit` table
2. Look for rows with your `siteId`
3. Check `timestamp` to see if recent visits exist

**Expected:** At least one row with:
- `siteId`: Your site ID
- `aiProvider`: chatgpt, perplexity, claude, or gemini
- `referrer`: The AI platform URL
- `brandProfileId`: Your brand profile ID

**If no rows:** The tracking request either:
- Never fired (script not loaded)
- Was blocked by CORS/ad blocker
- Failed validation (wrong siteId)

---

### 5. **Manual verification API test**

In your dashboard (browser console), run:

```javascript
fetch('/api/analytics/script/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    brandProfileId: 1,  // Replace with your actual ID
    siteId: localStorage.getItem('mudra:siteId')
  })
})
.then(r => r.json())
.then(data => {
  console.log('Verification result:', data);
  if (data.success && data.data.connected) {
    console.log('✅ Tracking is connected!');
    console.log('Visits in last 24h:', data.data.visits);
  } else {
    console.log('❌ No tracking data received');
    console.log('Message:', data.data?.message);
  }
})
```

---

## 🐛 Common Issues & Solutions

### Issue 1: "No tracking ID found"
**Cause:** siteId not in localStorage  
**Fix:** Copy tracking script from dashboard again, or check database for `BrandProfile.siteId`

### Issue 2: Script loaded but no tracking request
**Cause:** You didn't visit from an AI referrer  
**Fix:** Use Option A (simulated referrer) or Option B (real AI link) from section 3

### Issue 3: Tracking request blocked (CORS)
**Cause:** Cross-origin request blocked by browser  
**Fix:** Check `/api/analytics/track` route has proper CORS headers:
```javascript
headers: {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}
```

### Issue 4: Ad blocker interference
**Cause:** Browser extension blocking `/api/analytics/track`  
**Fix:** Temporarily disable ad blockers (uBlock Origin, AdBlock Plus, etc.)

### Issue 5: Wrong siteId in script
**Cause:** Old cached version or typo in PR  
**Fix:** 
1. Get correct siteId from dashboard: `localStorage.getItem('mudra:siteId')`
2. Verify it matches `data-site-id` in your website's script tag
3. If mismatch, update and redeploy

### Issue 6: Tracker.js not loading
**Cause:** Script URL incorrect or server not running  
**Fix:** Check Network tab for `tracker.js` request:
- Should load from `http://localhost:3000/tracker.js` (local) or `https://app.trymudra.com/tracker.js` (prod)
- Status should be 200
- Response should be JavaScript code

---

## 📊 Expected Data Flow

```
1. User clicks link in ChatGPT → document.referrer = "https://chatgpt.com/"
2. Your website loads → Mudra script executes
3. Script detects AI referrer → Calls trackVisit()
4. POST /api/analytics/track → {siteId, aiProvider, referrer, ...}
5. API validates siteId → Finds brandProfileId
6. API saves to AIReferralVisit table
7. Verification endpoint checks for visits → Returns {connected: true}
```

---

## 🔧 Manual Testing Script

Save this as `test-tracking.html` and open in browser:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Mudra Tracking Test</title>
  <!-- REPLACE WITH YOUR ACTUAL SITEID -->
  <script>
    (function() {
      var script = document.createElement('script');
      script.src = 'http://localhost:3000/tracker.js';
      script.async = true;
      script.setAttribute('data-site-id', 'sk_live_YOUR_SITEID_HERE');
      document.head.appendChild(script);
    })();
  </script>
</head>
<body>
  <h1>Mudra Tracking Test Page</h1>
  <p>Open DevTools → Console to see tracking logs</p>
  <p>Open DevTools → Network tab to see API requests</p>
  
  <script>
    // Simulate ChatGPT referrer
    Object.defineProperty(document, 'referrer', {
      get: function() { return 'https://chatgpt.com/'; }
    });
    
    console.log('Test page loaded');
    console.log('Referrer:', document.referrer);
  </script>
</body>
</html>
```

Steps:
1. Replace `sk_live_YOUR_SITEID_HERE` with your actual siteId
2. Open file in browser
3. Check Console for "[Mudra]" logs
4. Check Network tab for POST to `/api/analytics/track`
5. Check response status (should be 200 OK)

---

## 📝 Need More Help?

If still not working, gather these details:

1. **Browser Console Logs** (any errors?)
2. **Network Tab** (is `/api/analytics/track` request succeeding?)
3. **Prisma Studio** (any rows in `AIReferralVisit`?)
4. **Your siteId** (from `localStorage.getItem('mudra:siteId')`)
5. **BrandProfile.trackingStatus** (from database)

Then check the server logs when running `npm run dev` for any `[Analytics]` or `[Track]` error messages.
