# AI Referral Traffic Feature - Complete Documentation

## Overview

The **AI Referral Traffic** feature tracks visitors coming from AI engines (ChatGPT, Perplexity, Claude, Gemini) to help startups understand and measure their AI visibility impact on real traffic.

## Architecture

### Components

1. **Client-Side Tracking Script** (`public/tracker.js`)
   - Detects AI referrers by domain matching
   - Generates session IDs for tracking
   - Sends tracking data via sendBeacon (reliable) or fetch fallback
   - Exposes `window.mudraTracking` for verification

2. **Backend API Endpoints**
   - `POST /api/analytics/track` - Receives tracking data from embedded script
   - `GET /api/analytics/ai-referral` - Returns aggregated analytics
   - `GET /api/analytics/script` - Generates tracking script for user
   - `POST /api/analytics/script/verify` - Verifies script installation

3. **Database Models** (Prisma)
   - `AIReferralVisit` - Stores individual visit records
   - `AIReferralAnalytics` - Daily aggregated metrics

4. **Frontend Dashboard** (`components/dashboard/overview-metrics.tsx`)
   - Three states: Not Connected, Connecting, Connected
   - Modal with script copy/paste instructions
   - Real-time metrics display with growth tracking

## Database Schema

```prisma
model AIReferralVisit {
  id             Int          @id @default(autoincrement())
  brandProfileId Int
  siteId         String       // Format: site_{brandProfileId}_{random}
  referrer       String
  aiProvider     String       // chatgpt, perplexity, claude, gemini
  path           String
  userAgent      String?
  ipAddress      String?      // SHA256 hashed for privacy
  sessionId      String?
  metadata       Json?        // Screen size, viewport, language, timezone
  timestamp      DateTime     @default(now())
  
  brandProfile   BrandProfile @relation(fields: [brandProfileId], references: [id], onDelete: Cascade)
  
  @@index([brandProfileId, timestamp])
  @@index([siteId])
  @@index([aiProvider])
  @@map("ai_referral_visits")
}

model AIReferralAnalytics {
  id               Int          @id @default(autoincrement())
  brandProfileId   Int
  periodStart      DateTime
  periodEnd        DateTime
  totalVisits      Int          @default(0)
  chatgptVisits    Int          @default(0)
  perplexityVisits Int          @default(0)
  claudeVisits     Int          @default(0)
  geminiVisits     Int          @default(0)
  topPages         Json         // [{ path: string, visits: number }]
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt
  
  brandProfile     BrandProfile @relation(fields: [brandProfileId], references: [id], onDelete: Cascade)
  
  @@index([brandProfileId, periodStart])
  @@map("ai_referral_analytics")
}
```

## API Reference

### 1. Generate Tracking Script

**Endpoint:** `GET /api/analytics/script?brandProfileId={id}`

**Response:**
```json
{
  "success": true,
  "data": {
    "siteId": "site_1_a1b2c3d4e5f6g7h8",
    "script": "<!-- Mudra AI Referral Tracking -->...",
    "scriptUrl": "https://app.mudra.ai/tracker.js",
    "brandProfileId": 1,
    "companyName": "Example Inc",
    "website": "https://example.com"
  }
}
```

### 2. Track Visit

**Endpoint:** `POST /api/analytics/track`

**Request Body:**
```json
{
  "siteId": "site_1_a1b2c3d4e5f6g7h8",
  "referrer": "https://chatgpt.com/",
  "aiProvider": "chatgpt",
  "path": "/blog/ai-marketing",
  "userAgent": "Mozilla/5.0...",
  "sessionId": "sess_abc123",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "metadata": {
    "screen": { "width": 1920, "height": 1080 },
    "viewport": { "width": 1200, "height": 800 },
    "language": "en-US",
    "timezone": "America/New_York"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Visit tracked successfully"
}
```

### 3. Get Analytics

**Endpoint:** `GET /api/analytics/ai-referral?brandProfileId={id}&days={n}`

**Query Parameters:**
- `brandProfileId` (required): User's brand profile ID
- `days` (optional): Number of days to fetch (default: 7)

**Response:**
```json
{
  "success": true,
  "data": {
    "connected": true,
    "traffic": 247,
    "previous": 189,
    "growth": 30.69,
    "breakdown": {
      "chatgpt": 120,
      "perplexity": 78,
      "claude": 35,
      "gemini": 14
    },
    "topPages": [
      { "path": "/blog/ai-marketing", "visits": 89 },
      { "path": "/pricing", "visits": 52 },
      { "path": "/", "visits": 41 }
    ],
    "lastUpdated": "2024-01-15T10:30:00.000Z",
    "periodDays": 7
  }
}
```

### 4. Verify Script Installation

**Endpoint:** `POST /api/analytics/script/verify`

**Request Body:**
```json
{
  "brandProfileId": 1,
  "siteId": "site_1_a1b2c3d4e5f6g7h8"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "connected": true,
    "visits": 15,
    "message": "Tracking script is active and receiving data"
  }
}
```

## Client-Side Integration

### Installation

1. Get tracking script from Mudra dashboard
2. Copy the script snippet
3. Paste in `<head>` section of your website
4. Click "Verify Connection" in dashboard

### Example HTML

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Website</title>
  
  <!-- Mudra AI Referral Tracking -->
  <script>
    (function() {
      var script = document.createElement('script');
      script.src = 'https://app.mudra.ai/tracker.js';
      script.async = true;
      script.setAttribute('data-site-id', 'site_1_a1b2c3d4e5f6g7h8');
      document.head.appendChild(script);
    })();
  </script>
</head>
<body>
  <!-- Your content -->
</body>
</html>
```

### Verification

Check if tracking is working:

```javascript
// In browser console
console.log(window.mudraTracking);

// Expected output:
{
  version: '1.0.0',
  siteId: 'site_1_a1b2c3d4e5f6g7h8',
  isActive: true,
  lastCheck: '2024-01-15T10:30:00.000Z'
}
```

## Privacy & Security

### IP Address Hashing
All IP addresses are hashed using SHA256 before storage:
```typescript
const hashedIp = crypto.createHash('sha256').update(ipAddress).digest('hex')
```

### CORS Configuration
The tracking endpoint accepts cross-origin requests:
```typescript
headers: {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
}
```

### Data Retention
- Visit records: Unlimited (for analytics)
- Session IDs: Temporary (browser session only)
- Aggregated analytics: Permanent

## Supported AI Engines

| Engine | Domains | Provider ID |
|--------|---------|-------------|
| ChatGPT | chatgpt.com, chat.openai.com | `chatgpt` |
| Perplexity | perplexity.ai, www.perplexity.ai | `perplexity` |
| Claude | claude.ai | `claude` |
| Gemini | gemini.google.com, bard.google.com | `gemini` |

## Dashboard Integration

### States

1. **Not Connected** (Default)
   - Shows "Not Connected" message
   - "Connect" button opens modal
   - Displays "2 min setup" estimate

2. **Connecting** (Loading)
   - Shows animated spinner
   - "Connecting..." message
   - "Verifying script installation..."

3. **Connected** (Active)
   - Displays traffic count
   - Shows growth percentage with badge
   - Sparkline chart (animated on hover)
   - Last updated timestamp
   - Settings button

### User Flow

```
1. User clicks "Connect" button
   ↓
2. Modal opens with tracking script
   ↓
3. User copies script
   ↓
4. User pastes in website <head>
   ↓
5. User clicks "Verify Connection"
   ↓
6. Backend checks for recent visits
   ↓
7. Dashboard updates to "Connected" state
   ↓
8. Real-time metrics displayed
```

## Testing

### Manual Testing

Use the provided test page:
```bash
# Open test page
open mudra-app/test-ai-referral-tracking.html

# Or start dev server and visit
npm run dev
# Visit: http://localhost:3000/test-ai-referral-tracking.html
```

### Simulate AI Referrer

```javascript
// In browser console
Object.defineProperty(document, 'referrer', {
  value: 'https://chatgpt.com/',
  writable: false
});

// Reload page
window.location.reload();
```

### Check Debug Info

```javascript
// Show tracking status
console.log(window.mudraTracking);

// Check recent visits
console.log(JSON.parse(localStorage.getItem('mudra:recentVisits')));

// Check session ID
console.log(sessionStorage.getItem('mudra:sessionId'));
```

## Troubleshooting

### Script Not Loading

**Problem:** `window.mudraTracking` is undefined

**Solutions:**
1. Check script tag is in `<head>` section
2. Verify `data-site-id` attribute is set
3. Check browser console for errors
4. Ensure tracker.js is accessible (CORS)

### No Traffic Detected

**Problem:** Verification shows "No traffic detected yet"

**Solutions:**
1. Visit your site from an AI referrer (chatgpt.com)
2. Check Network tab for POST to /api/analytics/track
3. Verify siteId format: `site_{brandProfileId}_{random}`
4. Check server logs for tracking errors

### Wrong Traffic Count

**Problem:** Dashboard shows incorrect numbers

**Solutions:**
1. Check date range (default 7 days)
2. Verify brandProfileId in API calls
3. Check AIReferralAnalytics table for aggregated data
4. Ensure updateAnalytics() is running async

## Performance Considerations

### Client-Side
- Script loads asynchronously (`script.async = true`)
- Uses sendBeacon for reliable tracking (non-blocking)
- Session storage for minimal overhead
- LocalStorage limited to last 10 visits

### Server-Side
- Async analytics aggregation (no blocking)
- Indexed database queries (brandProfileId, timestamp)
- Batched updates for top pages ranking
- CORS enabled for cross-origin requests

## Future Enhancements

1. **Real-Time Analytics**
   - WebSocket connection for live updates
   - Real-time visitor count

2. **Advanced Metrics**
   - Bounce rate by AI provider
   - Average session duration
   - Conversion tracking

3. **AI Provider Details**
   - Query strings from AI engines
   - Conversation context extraction
   - Source attribution (which AI mentioned you)

4. **Alerts & Notifications**
   - Email alerts for traffic spikes
   - Weekly digest reports
   - Anomaly detection

5. **Integrations**
   - Google Analytics export
   - Webhook notifications
   - Zapier integration

## Related Documentation

- [Unified Analysis Architecture](../docs/architecture/UNIFIED_ANALYSIS_ARCHITECTURE.md)
- [API Routes Documentation](../docs/guides/API_ROUTES.md)
- [Database Schema](../mudra-app/prisma/schema.prisma)
- [Frontend Dashboard Guide](../docs/guides/DASHBOARD_INTEGRATION.md)

## Support

For issues or questions:
- GitHub Issues: [MudraMVP/issues](https://github.com/yourusername/MudraMVP/issues)
- Email: support@mudra.ai
- Documentation: https://docs.mudra.ai
