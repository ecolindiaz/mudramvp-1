/**
 * AI Referral Tracking - Debugging Guide
 * 
 * Since you merged the PR for tracking but are seeing "Not detected",
 * here are the steps to debug:
 */

console.log('=== AI REFERRAL TRACKING - DEBUGGING GUIDE ===\n')

console.log('STEP 1: CHECK IF SITEKEY WAS GENERATED')
console.log('  1. Open your Mudra dashboard at http://localhost:3000/dashboard')
console.log('  2. Open Browser DevTools (F12)')
console.log('  3. Go to Console tab')
console.log('  4. Look for logs like: "Generated siteId: sk_live_xxxxx"')
console.log('  5. Or check localStorage: localStorage.getItem("mudra:siteId")\n')

console.log('STEP 2: CHECK IF SCRIPT WAS INSTALLED')
console.log('  1. Go to your website where the PR was merged')
console.log('  2. View Page Source (Ctrl+U)')
console.log('  3. Search for "mudra" or "aiReferral"')
console.log('  4. Verify the tracking script is present in <head> or <body>\n')

console.log('STEP 3: TEST THE TRACKING')
console.log('  1. Visit your website with a referrer from ChatGPT or Perplexity')
console.log('  2. OR manually set document.referrer in console:')
console.log('     Object.defineProperty(document, "referrer", { get: () => "https://chatgpt.com/" })')
console.log('  3. Reload the page')
console.log('  4. Check Network tab for POST to "/api/analytics/track"')
console.log('  5. Check if request succeeds (status 200)\n')

console.log('STEP 4: CHECK DATABASE')
console.log('  1. Run: npx prisma studio')
console.log('  2. Navigate to AIReferralVisit table')
console.log('  3. Check if there are any rows with your siteId')
console.log('  4. If no rows, the script is not sending data\n')

console.log('STEP 5: VERIFY DETECTION ENDPOINT')
console.log('  1. In browser console on dashboard:')
console.log('     fetch("/api/analytics/script/verify", {')
console.log('       method: "POST",')
console.log('       headers: { "Content-Type": "application/json" },')
console.log('       body: JSON.stringify({ ')
console.log('         brandProfileId: 1,  // Your brand ID')
console.log('         siteId: localStorage.getItem("mudra:siteId")')
console.log('       })')
console.log('     }).then(r => r.json()).then(console.log)\n')

console.log('COMMON ISSUES:')
console.log('  ❌ PR merged but website not deployed yet')
console.log('  ❌ siteId not stored in localStorage')
console.log('  ❌ CORS blocking the tracking request')
console.log('  ❌ Ad blocker blocking requests to /api/analytics/track')
console.log('  ❌ Testing without actual AI referrer (ChatGPT/Perplexity)')
console.log('  ❌ Script syntax error preventing execution\n')

console.log('QUICK FIX:')
console.log('  1. Copy the tracking script from dashboard')
console.log('  2. Manually paste it in your website\'s <head>')
console.log('  3. Deploy and test again')
console.log('  4. Ensure you visit from an actual AI chat interface\n')

console.log('For more detailed logs, check:')
console.log('  - Browser DevTools Console')
console.log('  - Browser DevTools Network tab')
console.log('  - Server logs: npm run dev (look for [Analytics] or [Track] prefixes)\n')
