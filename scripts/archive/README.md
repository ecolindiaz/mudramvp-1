# Archived Scripts

This directory contains one-off test scripts, debug utilities, and setup scripts that were used during development but are no longer actively maintained.

## 📦 Contents

### Test Scripts (mudra-app)
- `test-api.js` - API endpoint testing
- `test-brand-integration.js` - Brand integration testing
- `test-brand-profile.js` - Brand profile testing
- `test-direct-geo.js` - DirectGEO API testing
- `test-firegeo-integration.js` - Firegeo integration testing

### Debug Scripts (firegeo)
- `debug-autumn.js` - Autumn user debugging
- `debug-customer-credits.js` - Customer credits debugging
- `debug-db.js` - Database debugging
- `debug-user-credits.js` - User credits debugging

### Check Scripts (firegeo)
- `check-api-token.ts` - API token verification
- `check-auth-tables.js` - Auth tables verification
- `check-brand-profile.js` - Brand profile verification
- `check-credits.js` - Credits verification
- `check-database.js` - Database verification
- `check-tables.js` - Tables verification
- `quick-check.js` - Quick status check
- `quick-test.js` - Quick testing

### Setup Scripts (firegeo)
- `activate-pro.js` - Pro subscription activation
- `allocate-free-credits.js` - Free credits allocation
- `apply-auth-migration.js` - Auth migration application
- `create-firegeo-tables.js` - Firegeo tables creation
- `fix-free-credits.js` - Free credits fix
- `push-schema.js` - Schema push utility
- `run-auth-migrations.js` - Auth migrations runner
- `run-brand-analysis-simple.js` - Simple brand analysis
- `run-brand-analysis.js` - Full brand analysis
- `seed-database.js` - Database seeding
- `setup-api-tokens.js` - API tokens setup
- `setup-brand-data.js` - Brand data setup
- `setup-dev.js` - Development environment setup
- `setup-free-subscription.js` - Free subscription setup
- `setup.js` - General setup utility
- `test-prompt-generator.js` - Prompt generator testing
- `update-token-scopes.js` - Token scopes update

### Utility Scripts
- `check-brand-profile-detailed.js` (mudra-app) - Detailed brand profile check
- `create-firegeo-token.js` (mudra-app) - Firegeo token creation
- `get-token-alternative.js` (mudra-app) - Alternative token retrieval
- `setup-env.js` (mudra-app) - Environment setup
- `setup-prompt-management.js` (root) - Prompt management setup
- `setup-api-key.sh` (root) - API key setup shell script

### SQL Files
- `create_brand_profile_table.sql` - Brand profile table creation

## ⚠️ Usage Warning

These scripts are archived and may not work with the current codebase. They are kept for reference and historical purposes only.

If you need to run any of these scripts:
1. Review the code first to ensure compatibility
2. Update environment variables and database connections
3. Test in a development environment before production use

## 🔄 Modern Alternatives

For current development tasks, use:
- **Testing**: `npm test` or `npm run test:e2e`
- **Database operations**: Prisma CLI (`npx prisma studio`, `npx prisma migrate`)
- **Setup**: Follow setup guides in `/docs/mudra-app/SETUP.md`
- **Debugging**: Use VS Code debugger or `console.log` with proper logging
