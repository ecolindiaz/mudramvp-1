# 🚀 Quick Vercel Deployment Checklist

Use this checklist to deploy Mudra to Vercel in under 10 minutes.

## ✅ Pre-Deployment (5 minutes)

- [ ] **Database Setup**
  - Create PostgreSQL database (Supabase/Neon/Vercel Postgres)
  - Copy `DATABASE_URL` connection string
  - Add `?pgbouncer=true&connection_limit=1` to connection string

- [ ] **API Keys Ready**
  - [ ] `DIRECTGEO_API_KEY` - Contact DirectGEO team
  - [ ] `DIRECTGEO_API_URL` - DirectGEO API endpoint
  - [ ] `FIRECRAWL_API_KEY` - Get from firecrawl.dev
  - [ ] `OPENAI_API_KEY` - Get from platform.openai.com

- [ ] **GitHub Repository**
  - [ ] Code pushed to GitHub
  - [ ] Repository is public or Vercel has access

## 🚀 Deployment (3 minutes)

- [ ] **Import to Vercel**
  1. Go to [vercel.com/new](https://vercel.com/new)
  2. Import your GitHub repo
  3. Set **Root Directory** to `mudra-app`
  4. Click Deploy (will fail - that's OK)

- [ ] **Add Environment Variables**
  1. Go to Settings → Environment Variables
  2. Add the following (copy from `.env.local.example`):
  
  ```bash
  DATABASE_URL="postgresql://..."
  DIRECTGEO_API_KEY="..."
  DIRECTGEO_API_URL="..."
  FIRECRAWL_API_KEY="fc-..."
  OPENAI_API_KEY="sk-..."
  ```
  
  3. Apply to: Production, Preview, Development

- [ ] **Run Database Migrations**
  ```bash
  # Option 1: Local
  cd mudra-app
  npx prisma migrate deploy
  
  # Option 2: Vercel CLI
  vercel env pull .env.production
  npx prisma migrate deploy
  ```

- [ ] **Redeploy**
  1. Go to Deployments tab
  2. Click "..." on latest deployment
  3. Click "Redeploy"
  4. Uncheck "Use existing Build Cache"
  5. Click "Redeploy"

## ✅ Post-Deployment (2 minutes)

- [ ] **Verify Deployment**
  - [ ] Visit deployment URL
  - [ ] Homepage loads without errors
  - [ ] Can access /dashboard
  - [ ] No console errors in browser DevTools

- [ ] **Test Core Features**
  - [ ] Complete onboarding flow
  - [ ] Run "Analyze Website"
  - [ ] View analysis results
  - [ ] Check Vercel logs for errors

- [ ] **Optional: Custom Domain**
  - [ ] Add domain in Settings → Domains
  - [ ] Configure DNS (CNAME → cname.vercel-dns.com)
  - [ ] Wait for SSL certificate

## 🐛 If Something Fails

### Build fails with "Prisma Client not found"
```bash
# Already fixed by adding postinstall script in package.json ✅
"postinstall": "prisma generate"
```

### Database connection timeout
```bash
# Ensure DATABASE_URL includes connection pooling
DATABASE_URL="postgresql://user:pass@host:5432/db?pgbouncer=true&connection_limit=1"
```

### API routes return 500 errors
- Check Vercel logs: Settings → Logs
- Verify all environment variables are set
- Check function timeout (set to 60s in vercel.json)

### Still having issues?
- Check [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) for detailed troubleshooting
- Review Vercel logs: `vercel logs --follow`
- Check [Vercel documentation](https://vercel.com/docs)

---

## 🎉 Success!

Your Mudra app is now live on Vercel!

**Next Steps:**
- Share your deployment URL with your team
- Set up monitoring (Vercel Analytics, Sentry)
- Configure custom domain
- Set up CI/CD pipelines

**Your deployment URL:** `https://your-project.vercel.app`

---

**Total Time:** ~10 minutes 🚀
