# Mudra MVP Documentation

This directory contains all project documentation organized by category.

## 📁 Documentation Structure

### `/architecture`
System architecture, design patterns, and technical diagrams:
- `MERMAID_ARCHITECTURE.md` - Visual system diagrams (sequence, flow, architecture)
- `SYSTEM_ARCHITECTURE.md` - ASCII architecture diagrams
- `UNIFIED_ANALYSIS_ARCHITECTURE.md` - Unified analysis service architecture

### `/implementation`
Feature implementation guides and technical specifications:
- `UNIFIED_ANALYSIS_IMPLEMENTATION.md` - Detailed unified service implementation
- `TRACKED_PROMPTS_DEEP_VIEW.md` - Tracked prompts deep view frontend specification
- `DROIDS_LAB_UI_FRONTEND_IMPLEMENTATION.md` - **NEW**: Complete frontend implementation guide for droids lab UI
- `PROMPT_MANAGEMENT_IMPLEMENTATION.md` - Prompt generation and storage system
- `TECHNICAL_ANALYSIS.md` - Technical analysis scoring system
- `TECHNICAL_STRUCTURE_ANALYSIS_FLOW.md` - Technical analysis workflow
- `ONBOARDING_PIPELINE_OUTLINE.md` - User onboarding process
- `ONBOARDING_TECHNICAL_ANALYSIS_INTEGRATION.md` - Technical analysis in onboarding
- `IMPLEMENTATION_COMPLETE.md` - Completed implementation tracker

### `/fixes`
Bug fixes and debugging documentation:
- `DATABASE_MIGRATION_FIXED.md` - Database migration fixes
- `ONBOARDING_DEBUG.md` - Onboarding debugging guide
- `ONBOARDING_ANALYSIS_STATUS.md` - Analysis status tracking fixes
- `ORGANIC_TRAFFIC_REMOVAL.md` - Organic traffic feature removal
- All mudra-app `FIX_*.md` files - Various bug fixes

### `/deployment`
Deployment guides and Docker documentation:
- `VERCEL_DEPLOYMENT.md` - Vercel deployment guide
- `VERCEL_QUICKSTART.md` - Quick start deployment
- `DOCKER_*.md` - Docker setup and troubleshooting

### `/guides`
User guides, reference materials, and business documentation:
- `QUICK_REFERENCE.md` - Quick reference for developers
- `project-context.md` - Business logic and feature specs
- `structure.md` - Project structure overview
- `dashboard-frontend.md` - Dashboard UI guide (see also: DROIDS_LAB_UI_FRONTEND_IMPLEMENTATION.md for latest)
- `onboarding-frontend.md` - Onboarding UI guide
- `AI_VISIBILITY_ONBOARDING_VERIFICATION.md` - AI visibility testing
- `GEO_IMPROVEMENT_RESULTS.md` - GEO improvement tracking

### `/mudra-app`
mudra-app specific documentation:
- `ACCOUNT_ONBOARDING.md` - Account setup
- `AI_VISIBILITY_ARCHITECTURE.md` - AI visibility system
- `CONTEXT_API_IMPROVEMENT.md` - Context API patterns
- `DEVELOPMENT_WORKFLOW.md` - Development workflow
- `DEV_TROUBLESHOOTING.md` - Troubleshooting guide
- `EMAIL_INTEGRATION.md` - Email system integration
- `GOOGLE_*.md` - Google Analytics/API integration
- `PERFORMANCE_OPTIMIZATIONS.md` - Performance improvements
- `SETUP.md` - mudra-app setup guide
- `TASK_*.md` - Task management system
- `TYPESCRIPT_FIXES.md` - TypeScript issues and fixes
- `UNIFIED_ANALYSIS_DASHBOARD_INTEGRATION.md` - Dashboard integration

### `/firegeo`
firegeo (SaaS starter) specific documentation:
- `DASHBOARD_INTEGRATION.md` - Dashboard integration
- `FASTER_PARALLELIZATION.md` - Performance optimizations
- `FIX_100_PROMPTS.md` - 100 prompts implementation
- `FIX_NULL_USERID_ERROR.md` - User ID error fixes
- `OPTIMIZED_30_PROMPTS.md` - Optimized prompts
- `PROMPT_GENERATOR.md` - Prompt generation system

### `/llm`
LLM service documentation:
- `faiss_api_README.md` - FAISS API documentation
- `execution_layer_README.md` - Execution layer documentation

### `/migrations/archive`
Historical SQL migration scripts (already applied to database)

## 📚 Knowledge Base Files (Not Moved)

The following documentation remains in their original locations as they are actively used by the codebase:

- `mudra-app/lib/ai/rag/kb/*.md` - RAG knowledge base content
- `mudra-app/lib/analysis/technical/kb/*.md` - Technical analysis rules
- `mudra-app/lib/scrapers/README.md` - Scraper documentation
- `mudra-app/docs/AI_MODELS.md` - AI model specifications

## 📝 Quick Links

- **Main README**: `../README.md`
- **Copilot Instructions**: `../.github/copilot-instructions.md`
- **Setup Guide**: `/mudra-app/SETUP.md`
- **Quick Reference**: `/guides/QUICK_REFERENCE.md`
- **Architecture Overview**: `/architecture/SYSTEM_ARCHITECTURE.md`

## 🗂️ Archived Files

Test scripts, debug utilities, and temporary files have been moved to:
- `../scripts/archive/` - Test and utility scripts
- `/migrations/archive/` - Historical SQL migrations
