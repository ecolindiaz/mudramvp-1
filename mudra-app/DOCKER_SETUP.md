# Running Mudra MVP with Docker

## Why Docker?
Docker solves the ARM64 compatibility issues with Prisma on Windows ARM machines by running the app in a Linux container with proper binaries.

## Quick Start

### Option 1: Using Scripts
```bash
# Windows Command Prompt
start-docker.bat

# PowerShell
.\start-docker.ps1

# Git Bash / WSL
./start-docker.sh
```

### Option 2: Using npm scripts
```bash
# Start development environment
npm run docker:dev

# View logs
npm run docker:logs

# Stop containers
npm run docker:down

# Access database
npm run docker:db
```

### Option 3: Direct Docker commands
```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up --build

# Stop and remove containers
docker-compose -f docker-compose.dev.yml down

# View logs
docker-compose -f docker-compose.dev.yml logs -f
```

## What's Included

- **App Container**: Your Next.js app running on Node.js 18 Alpine
- **Database Container**: PostgreSQL 15 for local development
- **Volume Mounting**: Live code reloading during development
- **Prisma Support**: Automatic client generation with correct Linux binaries

## Database Options

### Local Docker Database (Default)
- Uses PostgreSQL container
- Data persists in Docker volume
- Database URL: `postgresql://postgres:postgres@db:5432/mudra`

### Supabase (Production)
- Change `DATABASE_URL` in `.env` to your Supabase URL
- Run `docker-compose exec app npx prisma db push` to sync schema

## Environment Variables

Make sure your `.env` file contains:
```env
DATABASE_URL="postgresql://postgres:postgres@db:5432/mudra"
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_secret
OPENAI_API_KEY=your_openai_key
# ... other variables
```

## Useful Commands

```bash
# Generate Prisma client inside container
docker-compose -f docker-compose.dev.yml exec app npx prisma generate

# Push schema to database
docker-compose -f docker-compose.dev.yml exec app npx prisma db push

# Open Prisma Studio
docker-compose -f docker-compose.dev.yml exec app npx prisma studio

# Access app container shell
docker-compose -f docker-compose.dev.yml exec app sh

# Access database container
docker-compose -f docker-compose.dev.yml exec db psql -U postgres -d mudra

# View container logs
docker-compose -f docker-compose.dev.yml logs -f app
```

## Troubleshooting

### Port Already in Use
```bash
# Stop all containers
docker-compose -f docker-compose.dev.yml down

# Check what's using port 3000
netstat -an | find "3000"
```

### Database Connection Issues
```bash
# Restart database container
docker-compose -f docker-compose.dev.yml restart db

# Check database logs
docker-compose -f docker-compose.dev.yml logs db
```

### Prisma Issues
```bash
# Regenerate Prisma client
docker-compose -f docker-compose.dev.yml exec app npx prisma generate

# Reset database
docker-compose -f docker-compose.dev.yml exec app npx prisma db push --force-reset
```

## Production Deployment

For production, use the main `docker-compose.yml`:
```bash
docker-compose up --build -d
```

This will:
- Build optimized production image
- Use your production database URL
- Run in detached mode
