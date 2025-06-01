# Mudra Quick Reference Guide

## 🚀 Project: Generative Engine Optimization Platform
**Tagline:** "Get your startup mentioned by AI"

## 🎯 Core Features (ACDR Framework)
1. **Analyze** - Measure AI visibility
2. **Create** - Generate optimized content (future)
3. **Distribute** - Strategic placement (future)
4. **Re-Audit** - Continuous monitoring (future)

## 🛠 Tech Stack
- **Frontend:** Next.js 14+, React 18+, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** PostgreSQL/Supabase, Prisma ORM
- **Auth:** Better Auth
- **AI:** Vercel AI SDK, OpenAI, Anthropic, Perplexity APIs
- **Payments:** Stripe
- **Hosting:** Vercel

## 📊 Analysis Features (Phase 1)

### 1. Query LLMs
- Query 100 prompts across AI models
- Calculate AI Visibility Score
- Track mentions and context quality

### 2. AI Crawlers Detection
- JavaScript tracking snippet
- Detect GPTBot, ClaudeBot, PerplexityBot, Google AI Overviews, etc.
- Monitor crawl frequency and coverage

### 3. Technical Structure
- HTML structure analysis
- Schema.org validation
- Content hierarchy assessment

### 4. Content Quality
- ICP question research
- Competitor content analysis
- Citation readiness scoring

### 5. External Footprint
- Track web-wide mentions
- Backlink profile analysis
- Identify outreach opportunities

## 🎨 UI/UX Guidelines
- Card-based dashboard layout
- Before/after comparisons
- Real-time data updates
- Mobile-first design
- Dark mode support

## 📁 Key Directories
```
app/           # Next.js pages and API
components/    # React components
lib/           # Business logic
prisma/        # Database schema
types/         # TypeScript types
```

## 🔐 Security Rules
- All secrets in `.env.local`
- Never commit sensitive data
- Validate all inputs
- Rate limit APIs
- RBAC implementation

## 🚦 Implementation Order
1. ✅ Setup project structure
2. ⏳ Frontend dashboard with mock data
3. ⏳ Authentication system
4. ⏳ Backend infrastructure
5. ⏳ AI integrations
6. ⏳ Payment system

## 📝 Key Commands
```bash
# Development
npm run dev

# Type checking
npm run type-check

# Database
npx prisma migrate dev
npx prisma generate
npx prisma studio

# Build
npm run build
```

## 💡 Remember
- Use Server Components by default
- Client Components only when needed
- Implement loading states
- Handle errors gracefully
- Follow mobile-first approach
- Use semantic HTML
- Optimize for performance

## 🔗 Important Files
- `.cursorrules` - Coding standards
- `project-context.md` - Business logic
- `structure.md` - Project structure
- `QUICK_REFERENCE.md` - This file 