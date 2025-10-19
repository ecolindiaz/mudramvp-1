# Docker Database Connection Fix

## Problem
The Docker container couldn't connect to Supabase because:
1. Missing `DIRECT_URL` environment variable (required by Prisma schema)
2. Environment variables not being loaded from `.env.local`
3. Missing critical API keys in docker-compose

## Solution Applied

### 1. Updated `docker-compose.dev.yml`
Added:
- `env_file: - .env.local` to auto-load environment variables
- `DIRECT_URL` environment variable (required for Prisma migrations)
- Additional API keys: `DIRECTGEO_API_KEY`, `DIRECTGEO_API_URL`, `FIRECRAWL_API_KEY`

### 2. Ensure `.env.local` has both database URLs
Your `.env.local` file should contain:

```bash
# Connection pooling URL (for app queries)
DATABASE_URL="postgresql://postgres.bqobjllkucuskllghosv:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Direct connection (for migrations)
DIRECT_URL="postgresql://postgres.bqobjllkucuskllghosv:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
```

**Important:** Replace `[YOUR-PASSWORD]` with your actual Supabase database password.

## How to Run

### Option 1: Using existing .env.local (Recommended)
```powershell
# Make sure .env.local has DATABASE_URL and DIRECT_URL
npm run docker:dev
```

### Option 2: Create separate Docker environment file
```powershell
# Copy the example
cp .env.docker.example .env.docker

# Edit .env.docker with your credentials
# Then update docker-compose.dev.yml to use .env.docker instead of .env.local
```

## Verify Environment Variables
Before running Docker, verify your `.env.local` contains:

```powershell
# Check if environment variables are set
Get-Content .env.local | Select-String "DATABASE_URL|DIRECT_URL"
```

## Troubleshooting

### If you still get "Can't reach database server"
1. **Check password:** Ensure `[YOUR-PASSWORD]` is replaced with actual password
2. **Check network:** Supabase requires internet connection
3. **Check Supabase status:** Verify your project is running in Supabase dashboard
4. **Test connection locally:**
   ```powershell
   # Test if you can connect from host machine
   npm run dev
   ```

### If Prisma can't find schema during build
The Dockerfile now copies `prisma/` directory before running `npm ci`, so this should be resolved.

### View Docker logs
```powershell
# See what environment variables Docker sees
docker-compose -f docker-compose.dev.yml run app env | grep DATABASE

# View full container logs
docker-compose -f docker-compose.dev.yml logs app
```

## Next Steps
1. Update your `.env.local` with both `DATABASE_URL` and `DIRECT_URL`
2. Replace `[YOUR-PASSWORD]` with your actual Supabase password
3. Run `npm run docker:dev`
4. Container should now connect successfully to Supabase
