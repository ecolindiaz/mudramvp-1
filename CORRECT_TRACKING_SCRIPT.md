# Correct Mudra Tracking Script for MudraWebsite

Replace your current inline Script in `src/app/layout.tsx` with this:

```tsx
<Script 
  src="https://app.trymudra.com/tracker.js"
  data-site-id="site_479bdc12ab148ed5cf08ad3905ffb544"
  strategy="afterInteractive"
/>
```

That's it! Just 4 lines instead of your entire inline script.

## Why This Works:

1. **Uses the correct tracker.js** - The file we just updated with URL parameter detection
2. **Correct siteId format** - `site_xxx` not `mudra_xxx`
3. **Detects both**:
   - Direct referrers (chatgpt.com, perplexity.ai, etc.)
   - URL parameters (`?utm_source=chatgpt.com`, `?source=perplexity`, etc.)
4. **Sends to correct API** - `/api/analytics/track` with proper field names
5. **Built-in logging** - Console shows `[Mudra]` messages for debugging

## Your Updated layout.tsx:

```tsx
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* ... your existing head content ... */}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${redactionItalic.variable} antialiased`}
      >
        <Header />
        <main id="main-content">
          {children}
        </main>
        <Suspense fallback={null}>
          <ChatWidget />
        </Suspense>
        <Analytics />
        <SpeedInsights />
        
        {/* ✅ CORRECT Mudra AI Referral Tracking */}
        <Script 
          src="https://app.trymudra.com/tracker.js"
          data-site-id="site_479bdc12ab148ed5cf08ad3905ffb544"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
```

## What Happens Now:

When someone visits `https://www.trymudra.com/?utm_source=chatgpt.com`:

1. tracker.js loads from app.trymudra.com
2. Detects `utm_source=chatgpt.com` from URL
3. Identifies as ChatGPT traffic
4. Sends to `/api/analytics/track` with:
   ```json
   {
     "siteId": "site_479bdc12ab148ed5cf08ad3905ffb544",
     "aiProvider": "chatgpt",
     "referrer": "https://www.trymudra.com/?utm_source=chatgpt.com",
     "path": "/",
     "metadata": {
       "urlParams": "?utm_source=chatgpt.com"
     }
   }
   ```
5. Dashboard shows +1 ChatGPT visit ✅

## To Deploy:

1. Update MudraWebsite repo with the correct script
2. Push to production
3. Test: Visit `https://www.trymudra.com/?utm_source=chatgpt.com`
4. Open console - you'll see `[Mudra] AI referrer detected: chatgpt`
5. Check dashboard - should see the visit!
