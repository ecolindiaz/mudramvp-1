# AI Referral Traffic - Quick Start for Users

## What is AI Referral Traffic?

Track visitors who find your website through AI assistants like ChatGPT, Claude, Perplexity, and Gemini. See which AI platforms are sending you the most traffic and which pages they're visiting.

## Setup (5 minutes)

### Option 1: Manual Installation (Recommended)

1. **Go to your Mudra Dashboard**
   - Visit http://localhost:3000/dashboard
   - Find the "AI Referral Traffic" card

2. **Click "Connect Tracking"**
   - A modal will open with your tracking script

3. **Copy the script**
   - It looks like this:
   ```html
   <script>
     (function() {
       var script = document.createElement('script');
       script.src = 'https://mudramvp.vercel.app/tracker.js';
       script.async = true;
       script.setAttribute('data-site-id', 'site_1_YOUR_ID');
       document.head.appendChild(script);
     })();
   </script>
   ```

4. **Add to your website**
   - Paste the script in your website's `<head>` section
   - Usually in `index.html`, `_document.tsx`, or your layout file

5. **Verify Installation**
   - Click "Verify Installation" in the modal
   - Visit your site from ChatGPT or another AI assistant
   - Check your dashboard - you should see traffic within minutes!

### Option 2: Auto-Install (GitHub Only)

If your website is on GitHub:

1. Click "Auto-Install" button
2. Select your repository
3. Review and merge the PR
4. Done! Tracking activates automatically

## Viewing Your Data

### Dashboard Card
Shows:
- **Total Traffic** - All AI referrals in the last 7 days
- **Growth %** - Change vs previous 7 days
- **Breakdown** - Traffic by AI platform (ChatGPT, Claude, Perplexity, Gemini)
- **Top Pages** - Most visited pages from AI referrals

### Refresh Data
- Auto-refreshes every 5 minutes
- Manual refresh: Click the refresh icon
- Real-time: Data appears within 1-2 minutes of visits

## Testing Your Setup

### Method 1: Use Our Test Page
1. Open `test-ai-referral-tracking.html` in a browser
2. Click simulation buttons for each AI platform
3. Check your dashboard for test data

### Method 2: Simulate AI Referrals
1. Visit `https://chatgpt.com` in a new tab
2. In the address bar, type: `your-website.com`
3. Press Enter (this simulates coming from ChatGPT)
4. Check your dashboard

### Method 3: Real AI Referrals
1. Ask ChatGPT: "What is [your company name]?"
2. If it mentions your website, click the link
3. Your dashboard will show the visit!

## Troubleshooting

### "No tracking data detected"
✅ **Check Installation:**
- View your website's HTML source
- Search for "data-site-id"
- Make sure the script tag is present

✅ **Check Network Tab:**
- Open DevTools (F12)
- Go to Network tab
- Visit a page on your site
- Look for a request to `/api/analytics/track`

✅ **Verify Site ID:**
- Go back to the modal and copy the script again
- Make sure the `data-site-id` matches what's in your HTML

### "Script not loading"
✅ **Check Console:**
- Open DevTools (F12)
- Go to Console tab
- Look for any [Mudra] error messages

✅ **Check CORS:**
- If your site is on a different domain, ensure the script URL is correct
- Use the production URL: `https://mudramvp.vercel.app/tracker.js`

✅ **Check CSP (Content Security Policy):**
- If you have CSP headers, add: `script-src 'self' mudramvp.vercel.app;`

### "Only showing zeros"
✅ **Wait for Real Traffic:**
- The tracker only counts visits FROM AI platforms
- Try the testing methods above to simulate traffic

✅ **Check Date Range:**
- Default is 7 days - if your tracking is new, there may not be data yet
- First visit can take 1-2 minutes to appear

## Privacy & Performance

### Privacy
- ✅ No cookies used
- ✅ IP addresses are hashed (SHA256)
- ✅ No personal information collected
- ✅ GDPR compliant
- ✅ Session IDs stored only in browser memory

### Performance
- ✅ Async loading (doesn't block page)
- ✅ Only 2KB gzipped
- ✅ Uses sendBeacon (reliable, non-blocking)
- ✅ No impact on page speed

## What Gets Tracked

### Data Collected
- ✅ Referrer URL (which AI platform)
- ✅ Page path visited
- ✅ Timestamp
- ✅ User agent (browser)
- ✅ Session ID (temporary)

### Data NOT Collected
- ❌ Personal information
- ❌ Email addresses
- ❌ Names
- ❌ Actual IP addresses (only hashed)
- ❌ Form submissions
- ❌ Passwords or sensitive data

## Supported AI Platforms

| Platform | Domains Tracked |
|----------|-----------------|
| ChatGPT | chatgpt.com, chat.openai.com |
| Claude | claude.ai |
| Perplexity | perplexity.ai, www.perplexity.ai |
| Gemini | gemini.google.com, bard.google.com |

## FAQ

### How often does data update?
Data appears within 1-2 minutes of a visit. The dashboard auto-refreshes every 5 minutes.

### Can I track multiple websites?
Yes! Each website gets its own unique `data-site-id`. Install the script on each site.

### Does this work with all frameworks?
Yes! Works with:
- Static HTML
- React, Next.js, Vue, Angular
- WordPress, Wix, Shopify
- Any website with `<head>` access

### Will this slow down my site?
No! The script:
- Loads asynchronously (doesn't block)
- Is only 2KB
- Uses efficient sendBeacon API
- Has zero impact on page speed

### Can I remove the tracking?
Yes! Just remove the script tag from your website. All existing data will remain in your dashboard.

### What if I change my domain?
Your `data-site-id` stays the same. Just move the script to your new domain and it will work immediately.

## Getting Help

**Not Working?**
1. Check browser console for errors
2. Verify script is in `<head>` section
3. Run the test script: `node test-ai-tracking.js`
4. Check your siteId matches the script

**Need Support?**
- 📧 Email: support@mudra.ai
- 💬 Discord: mudra.ai/discord
- 📚 Docs: Full documentation in `docs/implementation/`

## Next Steps

Once tracking is working:

1. **Monitor Daily** - Check your dashboard regularly
2. **Optimize Content** - See which pages AI platforms recommend
3. **Track Growth** - Watch your AI visibility increase over time
4. **Share Insights** - Show your team which AI platforms work best
5. **Iterate** - Use data to improve your AI SEO strategy

---

**Ready to track AI referrals?** Go to your dashboard and click "Connect Tracking"! 🚀
