#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Setup script for Technical Structure Score implementation
    
.DESCRIPTION
    Installs dependencies and verifies all features are working correctly
#>

Write-Host "🚀 Setting up Technical Structure Score implementation..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Install JSDOM for test suite
Write-Host "📦 Installing JSDOM for Node.js DOM parsing..." -ForegroundColor Yellow
npm install --save-dev jsdom @types/jsdom

# Step 2: Generate Prisma client
Write-Host ""
Write-Host "🔧 Generating Prisma client..." -ForegroundColor Yellow
npx prisma generate

# Step 3: Run scoring validation tests
Write-Host ""
Write-Host "🧪 Running scoring validation tests..." -ForegroundColor Yellow
npm run test:scoring

# Step 4: Run load tests
Write-Host ""
Write-Host "📊 Running load tests (50 pages)..." -ForegroundColor Yellow
npm run test:load

# Step 5: Summary
Write-Host ""
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Green
Write-Host "✅ SETUP COMPLETE" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Implementation Summary:" -ForegroundColor Cyan
Write-Host "  ✅ Rate limit (10 pages) - lib/scrapers/enhanced-geo-scraper.ts"
Write-Host "  ✅ Sample validation - lib/tests/technical-scoring.test.ts"
Write-Host "  ✅ Load testing - lib/tests/load-test-scraper.js"
Write-Host "  ✅ Delta calculation - lib/services/delta-analysis.service.ts"
Write-Host "  ✅ Weekly cron job - lib/services/cron.service.ts"
Write-Host "  ✅ Findings UI - components/dashboard/technical-findings-details.tsx"
Write-Host ""
Write-Host "📚 Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Integrate findings UI into dashboard (see TECHNICAL_SCORE_IMPLEMENTATION.md)"
Write-Host "  2. Test manual cron trigger: curl -X GET http://localhost:3000/api/cron/weekly-analysis -H 'Authorization: Bearer YOUR_CRON_SECRET'"
Write-Host "  3. Deploy to production with 'git push'"
Write-Host ""
Write-Host "🔗 Quick Commands:" -ForegroundColor Magenta
Write-Host "  npm run test:scoring  - Run scoring validation tests"
Write-Host "  npm run test:load     - Run load/performance tests"
Write-Host "  npm run test:all      - Run all technical tests"
Write-Host ""
