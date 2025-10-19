# Mudra App - Vercel Deployment Guide

Complete guide to deploy your Mudra GEO platform to Vercel.

## 📋 Prerequisites

Before deploying, ensure you have:

1. ✅ A [Vercel account](https://vercel.com/signup)
2. ✅ A PostgreSQL database (Supabase, Neon, or Vercel Postgres)
3. ✅ All required API keys (see Environment Variables section)
4. ✅ Your code pushed to GitHub

## 🚀 Deployment Steps

### 1. Prepare Your Database

#### Option A: Supabase (Recommended)
```bash
# 1. Create a new project at https://supabase.com
# 2. Get your connection string from Settings > Database
# 3. Run Prisma migrations
cd mudra-app
npx prisma migrate deploy
```

#### Option B: Vercel Postgres
```bash
# 1. Go to your Vercel dashboard
# 2. Add Vercel Postgres from the Storage tab
# 3. Copy the DATABASE_URL from Vercel
```

### 2. Push Code to GitHub

```bash
# Initialize git if not already done
git init
git add .
git commit -m "Initial commit"

# Create a new repository on GitHub
# Then push your code
git remote add origin https://github.com/YOUR_USERNAME/MudraMVP.git
git branch -M main
git push -u origin main
```

### 3. Import Project to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repository
4. **Root Directory:** Select `mudra-app`
5. Click **"Deploy"** (it will fail without environment variables - that's expected)

### 4. Configure Environment Variables

In your Vercel project settings, go to **Settings** → **Environment Variables** and add:

#### Required Variables

```bash
# Database (CRITICAL)
DATABASE_URL="postgresql://user:password@host:5432/database?pgbouncer=true&connection_limit=1"

# DirectGEO API (for AI Visibility Analysis)
DIRECTGEO_API_KEY="your-directgeo-api-key"
DIRECTGEO_API_URL="https://your-directgeo-api.com"

# Firecrawl (for web scraping)
FIRECRAWL_API_KEY="fc-your-key"

# OpenAI (fallback AI testing)
OPENAI_API_KEY="sk-proj-your-key"
```

#### Optional Variables

```bash
# Supabase (if using)
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Google Analytics & Search Console
GOOGLE_CLIENT_EMAIL="service-account@project.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_ANALYTICS_PROPERTY_ID="properties/123456789"

# Stripe (if using payments)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_..."
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Firegeo Integration (if self-hosted)
FIREGEO_API_URL="https://your-firegeo-instance.vercel.app"
FIREGEO_API_TOKEN="your-api-token"
```

#### Important Notes for Environment Variables:

- **DATABASE_URL**: Must include connection pooling for Vercel (`?pgbouncer=true&connection_limit=1`)
- **GOOGLE_PRIVATE_KEY**: Ensure newlines are properly escaped (`\n`)
- **All variables**: Set for all environments (Production, Preview, Development)

### 5. Configure Build Settings

In **Settings** → **General** → **Build & Development Settings**:

```bash
Framework Preset: Next.js
Build Command: npm run build
Output Directory: .next
Install Command: npm install --legacy-peer-deps
Root Directory: mudra-app
Node Version: 20.x
```

### 6. Run Database Migrations

After environment variables are set:

```bash
# Option 1: Run locally then deploy
npx prisma migrate deploy

# Option 2: Use Vercel CLI
vercel env pull .env.production
npx prisma migrate deploy
```

### 7. Redeploy

1. Go to **Deployments** tab
2. Click **"Redeploy"** on the latest deployment
3. Check **"Use existing Build Cache"** = OFF
4. Click **"Redeploy"**

## 🔧 Vercel Configuration File (Optional)

Create `mudra-app/vercel.json` for advanced configuration:

```json
{
  "buildCommand": "prisma generate && next build",
  "installCommand": "npm install --legacy-peer-deps",
  "framework": "nextjs",
  "regions": ["iad1"],
  "env": {
    "NEXT_TELEMETRY_DISABLED": "1"
  },
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 60
    }
  }
}
```

## 🐛 Common Issues & Solutions

### Issue 1: `Prisma Client` errors

**Error:** `@prisma/client did not initialize yet`

**Solution:**
```bash
# Add postinstall script to package.json
"scripts": {
  "postinstall": "prisma generate"
}
```

### Issue 2: Database connection timeout

**Error:** `Can't reach database server`

**Solution:**
- Ensure `DATABASE_URL` includes connection pooling
- Use Prisma Data Proxy or PgBouncer
- Example: `postgresql://user:pass@host:5432/db?pgbouncer=true&connection_limit=1`

### Issue 3: Environment variables not loading

**Solution:**
1. Verify variables are set for all environments
2. Redeploy without cache
3. Check variable names match exactly (case-sensitive)

### Issue 4: Build fails with ESLint errors

**Solution:** Already handled in `next.config.ts`:
```typescript
eslint: {
  ignoreDuringBuilds: true,
}
```

### Issue 5: API routes timeout

**Solution:** Increase function timeout in `vercel.json`:
```json
{
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 60
    }
  }
}
```

## 📊 Post-Deployment Checklist

- [ ] Visit your deployment URL and verify homepage loads
- [ ] Test authentication flow
- [ ] Run a website analysis from dashboard
- [ ] Check Vercel logs for errors: `vercel logs --follow`
- [ ] Set up custom domain (optional)
- [ ] Configure Vercel Analytics
- [ ] Set up monitoring/error tracking (Sentry, etc.)

## 🔐 Security Best Practices

1. **Never commit `.env` files** - Already in `.gitignore`
2. **Use production API keys** - Separate from development
3. **Enable Vercel Authentication** - Restrict access if needed
4. **Set up CORS** - If using external APIs
5. **Rate limiting** - Implement for API routes

## 🌐 Custom Domain Setup

1. Go to **Settings** → **Domains**
2. Add your domain (e.g., `mudra.app`)
3. Configure DNS records:
   ```
   Type: CNAME
   Name: @
   Value: cname.vercel-dns.com
   ```
4. Wait for SSL certificate provisioning

## 📈 Monitoring & Analytics

### Vercel Analytics
```bash
# Already included in Next.js 15
# View at: vercel.com/your-project/analytics
```

### Custom Monitoring
Add to `app/layout.tsx`:
```typescript
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

## 🚀 CI/CD Setup

Vercel automatically deploys:
- **Production**: On push to `main` branch
- **Preview**: On pull requests
- **Development**: On push to other branches

### Custom Deployment Workflow

```bash
# Deploy from CLI
npm i -g vercel
vercel login
vercel --prod
```

## 📝 Environment-Specific Configurations

### Production
- Use production API keys
- Enable error tracking
- Set `NODE_ENV=production`

### Preview (Staging)
- Use staging API keys
- Enable debug logs
- Test new features

### Development
- Use test API keys
- Enable all logs
- Local database

## 🔄 Updating Your Deployment

```bash
# 1. Make changes locally
git add .
git commit -m "Your changes"

# 2. Push to GitHub
git push origin main

# 3. Vercel auto-deploys
# Monitor at: vercel.com/your-project/deployments
```

## 📞 Support Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Prisma on Vercel](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel)
- [Mudra Documentation](../README.md)

---

## Quick Deploy Button

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FYOUR_USERNAME%2FMudraMVP&root-directory=mudra-app)

---

**Need Help?** Check the [troubleshooting section](#-common-issues--solutions) or open an issue on GitHub.
