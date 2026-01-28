# 🚀 Rate Limiter - Quick Setup Guide

## Production Deployment (5 minutes)

### 1. Create Upstash Account (2 min)
```
→ Visit: https://console.upstash.com/
→ Sign up with GitHub/Google
→ Verify email
```

### 2. Create Redis Database (1 min)
```
→ Click "Create Database"
→ Name: mudra-ratelimit (or any name)
→ Type: Regional or Global (Global recommended)
→ Primary Region: Choose closest to your users
→ Click "Create"
```

### 3. Copy Credentials (1 min)
```
→ Click on your database
→ Scroll to "REST API" section
→ Copy these two values:
   - UPSTASH_REDIS_REST_URL
   - UPSTASH_REDIS_REST_TOKEN
```

### 4. Add to Vercel (1 min)
```bash
# Option A: Vercel Dashboard
→ Go to your project
→ Settings → Environment Variables
→ Add both variables for Production, Preview, Development

# Option B: Vercel CLI
vercel env add UPSTASH_REDIS_REST_URL
vercel env add UPSTASH_REDIS_REST_TOKEN
```

### 5. Deploy
```bash
git push origin main  # Auto-deploys
```

---

## Development Setup (Optional)

### With Redis (Test Production Behavior)
```bash
# Add to mudra-app/.env.local
UPSTASH_REDIS_REST_URL=https://your-endpoint.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXXXabc...

npm run dev
```

### Without Redis (In-Memory Fallback)
```bash
# Just run dev - no setup needed
npm run dev

# You'll see: "[RateLimit] Upstash not available, falling back to in-memory"
```

---

## Testing It Works

### 1. Check Logs
```
[RateLimit] Using Upstash Redis for rate limiting  ✅
```

### 2. Test Rate Limit
```bash
# Hit an endpoint 6 times rapidly (limit is 5)
curl -X POST https://your-app.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrong"}'

# 6th request should return:
# HTTP 429 Too Many Requests
# {"error":"Rate limit exceeded","retryAfter":45}
```

### 3. Monitor Upstash Dashboard
```
→ Upstash Console → Your Database → Metrics
→ See real-time commands/sec
→ Verify data is being written
```

---

## Free Tier Limits

| Metric | Limit | Sufficient For |
|--------|-------|----------------|
| Commands/day | 10,000 | ~5,000 daily users |
| Storage | 256 MB | Rate limit data is tiny |
| Bandwidth | 256 MB/day | More than enough |
| Concurrent connections | 1,000 | Multiple server instances |

**When to upgrade?** Only if you exceed 10,000 commands/day (highly unlikely for MVP)

---

## Troubleshooting

### "Still using in-memory in production"
→ Check Vercel env vars are set for "Production" environment
→ Redeploy after adding env vars

### "ECONNREFUSED" or connection errors
→ Verify UPSTASH_REDIS_REST_URL starts with `https://`
→ Verify token doesn't have extra spaces

### "Rate limiting not working"
→ Check response headers include `X-RateLimit-Limit`
→ Verify Upstash dashboard shows activity

---

## Cost Calculator

**Example usage:**
- 1,000 daily users
- 5 API requests per user per day
- = 5,000 requests/day
- **Free tier:** ✅ Well within limits

**Breaking free tier:**
- Need 10,000+ requests/day
- That's ~2,000 daily active users making 5 requests each
- Or ~400 requests/hour sustained

**Paid tier (if needed):**
- Pay-as-you-go: $0.20 per 100,000 commands
- For 100,000 requests/day: ~$0.60/day = $18/month
- Still extremely affordable

---

## Quick Reference: Rate Limits

| Endpoint | Limit | Window | Why |
|----------|-------|--------|-----|
| Auth | 5 | 15 min | Prevent brute force |
| Analysis | 10 | 1 min | Expensive API calls |
| AI Generation | 5 | 1 min | Costly ChatGPT/Claude |
| Scraping | 5 | 1 min | External API limits |
| Standard | 60 | 1 min | Normal operations |
| Tracking | 100 | 1 min | High-volume analytics |

**Need different limits?** Edit `mudra-app/lib/auth/rate-limiter-redis.ts` → `RATE_LIMITS`

---

## Support

- **Upstash Docs:** https://upstash.com/docs/redis
- **Upstash Discord:** https://discord.gg/upstash
- **Rate Limit SDK:** https://upstash.com/docs/redis/sdks/ratelimit-ts

---

**Setup time:** 5 minutes  
**Cost:** Free (10k commands/day)  
**Security:** ✅ Production-ready  
**Compatibility:** ✅ Vercel, AWS, any serverless  

**Status:** Ready to deploy! 🚀
