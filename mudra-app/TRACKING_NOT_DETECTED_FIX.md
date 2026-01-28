# AI Referral Tracking - "Not Detected" Troubleshooting

## 🔴 The Problem
You merged the PR to install the tracking script, but when you try to verify the connection, you get **"Not detected"**.

## 🎯 Root Cause (Most Likely)
**The tracking script only fires when you visit from an AI chat interface** (ChatGPT, Perplexity, Claude, or Gemini). 

If you're just visiting your website directly (typing URL in browser, clicking bookmark, etc.), the tracker **will not fire** because `document.referrer` is empty or not from an AI source.

## ✅ Solution: Test with Simulated Referrer

### Quick Test (Browser Console Method)

1. **Open your website** where the tracking script is installed
2. **Open DevTools** (F12)
3. **Open Console tab**
4. **Run this code:**

```javascript
// Simulate ChatGPT referrer
Object.defineProperty(document, 'referrer', {
  get: function() { return 'https://chatgpt.com/'; }
});

// Reload page
location.reload();
```

5. **Check Network tab** after reload for:
   - POST request to `/api/analytics/track`
   - Status: 200 OK
   - Response: `{ success: true }`

### Alternative: Use Test Page

1. **Open** `http://localhost:3000/test-tracking.html` in your browser
2. **Get your siteId** from dashboard console: `localStorage.getItem('mudra:siteId')`
3. **Edit the test page** and replace `YOUR_SITEID_HERE` with your actual siteId
4. **Click** "Simulate ChatGPT Referrer"
5. **Reload** the page (F5)
6. **Check** Console and Network tabs

## 🔍 Verification Steps

### Step 1: Confirm siteId exists

**Dashboard → Browser Console:**
```javascript
localStorage.getItem('mudra:siteId')
// Should return something like: "sk_live_abc123xyz"
```

❌ **If null/undefined:** The script wasn't generated properly. Go to dashboard and click "Copy Script" to regenerate.

### Step 2: Confirm script is installed

**Your Website → View Source (Ctrl+U):**

Search for "mudra" or "data-site-id". You should see:

```html
<script>
  (function() {
    var script = document.createElement('script');
    script.src = 'http://localhost:3000/tracker.js';
    script.async = true;
    script.setAttribute('data-site-id', 'sk_live_...');
    document.head.appendChild(script);
  })();
</script>
```

❌ **If missing:** The PR either wasn't merged correctly or the website hasn't been redeployed.

### Step 3: Simulate AI visit

**Your Website → Browser Console:**

```javascript
// 1. Check current referrer (should be empty if you typed URL)
console.log('Current referrer:', document.referrer);

// 2. Simulate ChatGPT
Object.defineProperty(document, 'referrer', {
  get: function() { return 'https://chatgpt.com/'; }
});

// 3. Reload to trigger tracking
location.reload();
```

**After reload, check Network tab:**
- Look for POST to `/api/analytics/track`
- Status should be **200 OK**
- Response: `{ success: true, message: "Visit tracked" }`

### Step 4: Verify data in database

**Terminal:**
```powershell
npx prisma studio
```

**Navigate to:** `AIReferralVisit` table

**Look for:** Rows with your `siteId`

**Expected columns:**
- `siteId`: Your site ID
- `aiProvider`: chatgpt, perplexity, claude, or gemini
- `referrer`: The AI platform URL
- `brandProfileId`: Your brand ID
- `timestamp`: Recent timestamp

❌ **If no rows:** The tracking request either didn't fire or was blocked.

### Step 5: Manual verification API test

**Dashboard → Browser Console:**

```javascript
fetch('/api/analytics/script/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    brandProfileId: 1,  // Replace with your actual brand profile ID
    siteId: localStorage.getItem('mudra:siteId')
  })
})
.then(r => r.json())
.then(data => {
  console.log('Verification:', data);
  if (data.success && data.data.connected) {
    console.log('✅ CONNECTED! Visits in last 24h:', data.data.visits);
  } else {
    console.log('❌ NOT CONNECTED');
    console.log('Reason:', data.data?.message);
  }
})
```

## 🐛 Common Issues

### Issue 1: "No tracking ID found"
- **Cause:** siteId not in localStorage
- **Fix:** Go to dashboard, copy tracking script again

### Issue 2: Script loads but nothing happens
- **Cause:** You're visiting directly (no AI referrer)
- **Fix:** Use simulation method from Step 3 above

### Issue 3: "CORS error" in console
- **Cause:** Cross-origin request blocked
- **Fix:** Ensure `/api/analytics/track` has CORS headers (already implemented)

### Issue 4: Tracker.js returns 404
- **Cause:** Dev server not running or wrong URL
- **Fix:** 
  - Local: Ensure `npm run dev` is running
  - Prod: Ensure script URL points to `https://app.trymudra.com/tracker.js`

### Issue 5: Ad blocker blocking requests
- **Cause:** Browser extension blocking analytics
- **Fix:** Temporarily disable ad blockers for testing

### Issue 6: Wrong siteId in database vs script
- **Cause:** Script has outdated siteId
- **Fix:** 
  1. Get correct siteId: `localStorage.getItem('mudra:siteId')`
  2. Verify it matches script's `data-site-id` attribute
  3. Update if different

## 📊 Expected Flow (Success)

```
1. User clicks link in ChatGPT
   → document.referrer = "https://chatgpt.com/"

2. Your website loads
   → Mudra tracking script executes

3. Script checks referrer
   → Detects ChatGPT → aiProvider = "chatgpt"

4. Script calls trackVisit()
   → POST to /api/analytics/track

5. API validates siteId
   → Finds brandProfileId from database

6. API saves visit
   → AIReferralVisit table gets new row

7. Verification endpoint checks
   → Finds recent visits → Returns {connected: true}

8. Dashboard shows "Connected"
   → Displays visit metrics
```

## 🎯 The Real Test

### Production Test (Best Way)

1. **Go to ChatGPT** (chatgpt.com)
2. **Ask:** "Tell me about [your company name]" or "Find me [your product]"
3. **Click the link** in ChatGPT's response
4. **This sets a real referrer** → Tracking fires automatically
5. **Go back to your dashboard** → Click "Verify Connection"
6. **Should now show:** ✅ Connected

### Development Test (Quick Way)

Use the simulation method (Step 3 above) - this is faster for testing without needing real AI traffic.

## 📝 Still Not Working?

If after following all steps you still see "Not detected", check:

1. **Server logs** (`npm run dev` output) for errors
2. **Browser console** for JavaScript errors
3. **Network tab** for failed requests
4. **Database** (`npx prisma studio`) for any AIReferralVisit rows

Then gather:
- Screenshot of Network tab showing tracking request
- Console logs
- Your siteId value
- BrandProfile.trackingStatus from database

## 🚀 Quick Win Command

Run this in your browser console on your website:

```javascript
// One-liner test
Object.defineProperty(document, 'referrer', {get: () => 'https://chatgpt.com/'}); location.reload();
```

After reload, check Network tab for `/api/analytics/track` request with status 200.

---

**Remember:** The tracking ONLY fires when visiting from AI chat platforms or when you simulate it for testing!
