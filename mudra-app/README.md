# Mudra - Generative Engine Optimization Platform

> **"Get your startup mentioned by AI"** - A platform that helps startups increase their visibility in AI-generated responses.

## 🚀 Overview

Mudra is a GEO (Generative Engine Optimization) platform designed to analyze, optimize, and track how AI systems perceive and reference your brand. As AI becomes the primary information source, Mudra ensures startups are discoverable and authoritative in AI responses.

## 📋 Prerequisites

### Local Development
- Node.js 20+ 
- PostgreSQL (local or Supabase)
- API Keys: DirectGEO, Firecrawl, OpenAI

### Docker Development (Recommended)
- Docker Desktop 4.0+ (Windows/Mac) or Docker Engine 20.10+ (Linux)
- 4GB+ available RAM
- API Keys: DirectGEO, Firecrawl, OpenAI

## 🛠 Installation

### Option 1: Docker (Recommended) ⭐

**Quick Start:**
```bash
# 1. Create environment file
cp .env.docker.example .env.docker
# Edit .env.docker with your values

# 2. Build and start (PowerShell on Windows)
.\docker-helper.ps1 build-dev
.\docker-helper.ps1 start-dev

# 3. Access app at http://localhost:3000
```

**What You Get:**
- ✅ Production-ready multi-stage builds
- ✅ Hot-reload development environment
- ✅ Health monitoring and auto-restart
- ✅ Chrome DevTools debugging (port 9229)
- ✅ Resource management (CPU/memory limits)
- ✅ Security hardening (non-root user)

**Documentation:**
- **Complete Guide**: `/docs/deployment/DOCKER_COMPLETE_GUIDE.md` (700+ lines)
- **Quick Reference**: `/docs/deployment/DOCKER_QUICK_REFERENCE.md`
- **Setup Summary**: `/docs/deployment/DOCKER_SETUP_COMPLETE.md`

---

### Option 2: Local Development

1. **Clone the repository**
   ```bash
   git clone [repository-url]
   cd mudra-app
   ```

2. **Install dependencies**
   ```bash
   npm install --force
   ```

3. **Set up environment variables**
   ```bash
   node setup-env.js
   # Then edit .env.local with your actual values
   ```

4. **Set up the database**
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

## 🏗 Project Structure

```
mudra-app/
├── app/              # Next.js App Router
├── components/       # React components
├── lib/             # Business logic & utilities
├── prisma/          # Database schema
├── types/           # TypeScript definitions
└── public/          # Static assets
```

## 🎯 Core Features

### Phase 1: Analyze (Current)
- **AI Visibility Score** - Query multiple AI models
- **Crawler Detection** - Track AI bot access
- **Technical Analysis** - SEO & structure optimization
- **Content Quality** - Authority and citation readiness
- **External Footprint** - Web-wide brand presence

### Phase 2-4: Coming Soon
- Create (Content generation)
- Distribute (Strategic placement)
- Re-Audit (Continuous monitoring)

## 💻 Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run type-check   # Run TypeScript checks
npm run lint         # Run ESLint
```

### Database Commands

```bash
npx prisma studio    # Open Prisma Studio
npx prisma migrate dev   # Run migrations
npx prisma generate  # Generate Prisma Client
```

## 🧪 Testing

```bash
npm run test         # Run tests (coming soon)
npm run test:e2e     # Run E2E tests (coming soon)
```

## � Analysis Engine Configuration

### DirectGEO vs Firegeo

Mudra uses **DirectGEO** (local OpenAI-powered analysis) as the **default** analysis engine. This provides:
- ✅ Better position/ranking extraction from AI responses
- ✅ Multi-model sentiment analysis
- ✅ Custom prompt support (50 prompts from database)
- ✅ Detailed brand mention detection
- ✅ Competitor comparison tracking

**Firegeo** (external API) can be enabled as an **optional fallback**:
```bash
# In .env.local or .env.docker
USE_FIREGEO_FALLBACK=true
FIREGEO_API_URL=https://api.firegeo.com
FIREGEO_API_TOKEN=your_token_here
```

**Required Environment Variables:**
```bash
OPENAI_API_KEY=sk-...        # Required for DirectGEO
FIRECRAWL_API_KEY=fc-...     # Required for web scraping
DATABASE_URL=postgresql://... # Required for Prisma
```

## �📚 Documentation

- [Project Context](../project-context.md) - Business logic & requirements
- [Structure](../structure.md) - Detailed project structure
- [Quick Reference](../QUICK_REFERENCE.md) - Quick lookup guide
- [Development Workflow](./DEVELOPMENT_WORKFLOW.md) - Coding practices

## 🔒 Security

- All sensitive data in `.env.local` (never commit!)
- Input validation on all forms
- Rate limiting on API endpoints
- RBAC for user permissions

## 🚀 Deployment

The app is configured for deployment on Vercel:

```bash
vercel deploy
```

## 🤝 Contributing

Please follow the guidelines in [DEVELOPMENT_WORKFLOW.md](./DEVELOPMENT_WORKFLOW.md)

## 📄 License

Private and confidential - All rights reserved

---

**Built with ❤️ for startups seeking AI visibility**
