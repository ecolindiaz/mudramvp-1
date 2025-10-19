# Docker Complete Guide - Mudra App

## Table of Contents
1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Architecture](#architecture)
4. [Production Setup](#production-setup)
5. [Development Setup](#development-setup)
6. [Configuration](#configuration)
7. [Health Monitoring](#health-monitoring)
8. [Troubleshooting](#troubleshooting)
9. [Best Practices](#best-practices)

---

## Overview

The Mudra app uses a **robust Docker setup** with:
- ✅ Multi-stage production builds (optimized image size)
- ✅ Development hot-reload (instant code updates)
- ✅ Health checks at multiple levels (Docker + API)
- ✅ Security hardening (non-root user, minimal privileges)
- ✅ Resource management (CPU/memory limits)
- ✅ Persistent storage (volumes for data/node_modules)
- ✅ Comprehensive logging (10MB rotation, 3 files)

### File Structure
```
mudra-app/
├── Dockerfile              # Production multi-stage build
├── Dockerfile.dev          # Development with hot-reload
├── docker-compose.yml      # Production orchestration
├── docker-compose.dev.yml  # Development orchestration
├── .dockerignore           # Build optimization
├── .env.docker.example     # Environment template
└── docker-helper.sh        # Management script
```

---

## Quick Start

### Prerequisites
- Docker Desktop 4.0+ (Windows/Mac) or Docker Engine 20.10+ (Linux)
- 4GB+ available RAM
- PostgreSQL database URL (Supabase or local)

### Development (Recommended for local work)

```bash
# 1. Navigate to mudra-app
cd mudra-app

# 2. Create environment file
cp .env.docker.example .env.docker
# Edit .env.docker with your values

# 3. Build and start
./docker-helper.sh build-dev
./docker-helper.sh start-dev

# 4. Access app
# Open http://localhost:3000
# Debugging: chrome://inspect (port 9229)

# 5. View logs
./docker-helper.sh logs-dev

# 6. Stop when done
./docker-helper.sh stop-dev
```

### Production (For deployment)

```bash
# 1. Build production image
./docker-helper.sh build-prod

# 2. Start production environment
./docker-helper.sh start-prod

# 3. Check health
./docker-helper.sh health

# 4. View logs
./docker-helper.sh logs-prod
```

---

## Architecture

### Multi-Stage Production Build

```
Stage 1: deps     → Install dependencies only
Stage 2: builder  → Build Next.js app
Stage 3: runner   → Minimal runtime image
```

**Benefits:**
- 60-70% smaller final image (only production files)
- Faster deployment (less data transfer)
- Improved security (no build tools in production)

### Health Check System

**Three-Level Monitoring:**

1. **Dockerfile Health Check**
   ```dockerfile
   HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
     CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1
   ```

2. **Docker Compose Health Check**
   ```yaml
   healthcheck:
     test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/api/health"]
     interval: 30s
     timeout: 10s
     retries: 3
     start_period: 40s
   ```

3. **API Health Endpoint** (`/api/health`)
   - Validates database connectivity (Prisma query)
   - Checks required environment variables
   - Returns JSON status with uptime/version

**Health Check Flow:**
```
Every 30s → HTTP GET /api/health
            ↓
         Database Check (SELECT 1)
            ↓
         Environment Check (required vars)
            ↓
         Return { status: "healthy", ... }
```

### Resource Management

**Production Limits:**
```yaml
deploy:
  resources:
    limits:
      cpus: '2'         # Maximum 2 CPU cores
      memory: 2048M     # Maximum 2GB RAM
    reservations:
      cpus: '1'         # Minimum 1 CPU core
      memory: 1024M     # Minimum 1GB RAM
```

**Why Limits Matter:**
- Prevents single container from consuming all host resources
- Ensures predictable performance under load
- Enables multi-container deployments on same host

---

## Production Setup

### 1. Environment Configuration

Create `.env.docker`:
```env
# Database (Required)
DATABASE_URL=postgresql://user:pass@host:5432/db?pgbouncer=true

# External APIs (Required)
DIRECTGEO_API_KEY=your_directgeo_key
DIRECTGEO_API_URL=https://directgeo.example.com
FIRECRAWL_API_KEY=your_firecrawl_key
OPENAI_API_KEY=sk-...

# NextAuth (Required)
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=your_nextauth_secret

# Node Environment
NODE_ENV=production
```

**Security Notes:**
- Never commit `.env.docker` to git (already in .gitignore)
- Use strong secrets (generate with `openssl rand -base64 32`)
- Rotate API keys regularly

### 2. Build Production Image

```bash
# Standard build
docker-compose -f docker-compose.yml build

# No-cache build (force fresh)
docker-compose -f docker-compose.yml build --no-cache

# Using helper script
./docker-helper.sh build-prod
```

**Build Process:**
1. Copy only necessary files (.dockerignore filters)
2. Install production dependencies (npm ci)
3. Generate Prisma client
4. Build Next.js app (optimized bundles)
5. Copy to minimal runtime image (Node 20 Alpine)

### 3. Start Production Container

```bash
# Start in background
docker-compose -f docker-compose.yml up -d

# View startup logs
docker-compose -f docker-compose.yml logs -f app

# Check health
curl http://localhost:3000/api/health
```

**What Happens:**
- Container starts as non-root user (node:1000)
- Health check begins after 40s start period
- Logs rotate at 10MB (max 3 files)
- Auto-restart on failure (unless manually stopped)

### 4. Monitoring

```bash
# Real-time logs
docker-compose -f docker-compose.yml logs -f app

# Container stats (CPU/memory)
docker stats mudra-app

# Health status
docker inspect mudra-app --format='{{.State.Health.Status}}'

# API health check
curl -s http://localhost:3000/api/health | jq
```

### 5. Updating

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.yml down
docker-compose -f docker-compose.yml build
docker-compose -f docker-compose.yml up -d

# Verify health
curl http://localhost:3000/api/health
```

---

## Development Setup

### 1. Development Environment

**Features:**
- 🔥 **Hot Reload**: Code changes reflect instantly
- 🐛 **Debugging**: Chrome DevTools on port 9229
- 📦 **Volume Mounts**: Edit code outside container
- 🔄 **Chokidar Polling**: Windows file watching support

### 2. Start Development

```bash
# Build dev image
./docker-helper.sh build-dev

# Start dev environment
./docker-helper.sh start-dev

# View logs (follow)
./docker-helper.sh logs-dev

# Open shell in container
./docker-helper.sh shell-dev
```

### 3. Volume Strategy

**Three Volume Types:**

1. **Bind Mount** (source code):
   ```yaml
   volumes:
     - ./:/app
   ```
   - Edits on host → instant sync to container
   - Enable hot reload

2. **Anonymous Volume** (node_modules):
   ```yaml
   volumes:
     - /app/node_modules
   ```
   - Prevents Windows/Linux module conflicts
   - Native modules compiled in container

3. **Anonymous Volume** (.next):
   ```yaml
   volumes:
     - /app/.next
   ```
   - Build cache stays in container
   - Faster rebuilds

### 4. Debugging in VS Code

**launch.json**:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Docker: Attach to Node",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "address": "localhost",
      "localRoot": "${workspaceFolder}/mudra-app",
      "remoteRoot": "/app",
      "protocol": "inspector",
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

**Steps:**
1. Start dev container: `./docker-helper.sh start-dev`
2. In VS Code: Press F5 or Run → Start Debugging
3. Set breakpoints in your code
4. Trigger breakpoint via browser
5. Debug in VS Code

### 5. Database Operations

```bash
# Generate Prisma client
./docker-helper.sh prisma-generate

# Run migrations
./docker-helper.sh prisma-migrate

# Open Prisma Studio
./docker-helper.sh prisma-studio
# Access at http://localhost:5555

# Manual Prisma commands
docker-compose -f docker-compose.dev.yml exec app npx prisma <command>
```

---

## Configuration

### Environment Variables

**Required:**
- `DATABASE_URL`: PostgreSQL connection string
- `NEXTAUTH_URL`: Application URL
- `NEXTAUTH_SECRET`: Auth encryption key
- `DIRECTGEO_API_KEY`: DirectGEO API key
- `FIRECRAWL_API_KEY`: Firecrawl API key

**Optional:**
- `OPENAI_API_KEY`: Fallback AI testing
- `NODE_ENV`: `development` | `production`
- `PORT`: Default 3000

**Database Connection:**
```env
# Supabase with PgBouncer
DATABASE_URL=postgresql://user:pass@host:5432/db?pgbouncer=true

# Direct connection
DATABASE_URL=postgresql://user:pass@host:5432/db?schema=public

# Connection pooling parameters
DATABASE_URL=postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=20
```

### Docker Compose Overrides

**Custom docker-compose.override.yml**:
```yaml
version: '3.8'

services:
  app:
    environment:
      - DEBUG=true
    ports:
      - "3001:3000"  # Custom port
    deploy:
      resources:
        limits:
          memory: 4096M  # More memory
```

**Apply:**
```bash
docker-compose -f docker-compose.yml -f docker-compose.override.yml up
```

---

## Health Monitoring

### API Health Endpoint

**Request:**
```bash
curl http://localhost:3000/api/health
```

**Response (Healthy):**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 3600,
  "version": "1.0.0",
  "checks": {
    "database": {
      "status": "healthy",
      "responseTime": 15
    },
    "environment": {
      "status": "healthy",
      "variables": [
        "DATABASE_URL",
        "NEXTAUTH_URL",
        "DIRECTGEO_API_KEY"
      ]
    }
  }
}
```

**Response (Unhealthy - HTTP 503):**
```json
{
  "status": "unhealthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "checks": {
    "database": {
      "status": "unhealthy",
      "error": "Connection timeout"
    }
  }
}
```

### Container Health Commands

```bash
# Check health status
docker inspect mudra-app --format='{{json .State.Health}}' | jq

# View health check logs
docker inspect mudra-app --format='{{range .State.Health.Log}}{{.Output}}{{end}}'

# Wait for healthy status
docker-compose -f docker-compose.yml up --wait

# Automated health monitoring
while true; do
  status=$(docker inspect mudra-app --format='{{.State.Health.Status}}')
  echo "$(date): $status"
  sleep 30
done
```

### External Monitoring Integration

**Uptime Kuma** (Docker monitoring):
```yaml
monitors:
  - name: Mudra App
    type: http
    url: http://mudra-app:3000/api/health
    interval: 60
    retries: 3
```

**Prometheus** (metrics scraping):
```yaml
scrape_configs:
  - job_name: 'mudra-app'
    static_configs:
      - targets: ['mudra-app:3000']
    metrics_path: /api/health
```

---

## Troubleshooting

### Common Issues

#### 1. Container Won't Start

**Symptoms:**
```
Error: Cannot find module '@prisma/client'
```

**Solution:**
```bash
# Rebuild with no cache
docker-compose -f docker-compose.yml build --no-cache

# Or regenerate Prisma client
docker-compose exec app npx prisma generate
```

---

#### 2. Database Connection Fails

**Symptoms:**
```
Error: Can't reach database server
```

**Checks:**
```bash
# 1. Verify DATABASE_URL
docker-compose exec app printenv DATABASE_URL

# 2. Test connection from container
docker-compose exec app sh
apk add postgresql-client
psql $DATABASE_URL -c "SELECT 1"

# 3. Check if host allows container IP
# For Supabase: Add container IP to allowlist
```

**Solution:**
```env
# Use host.docker.internal for local DB
DATABASE_URL=postgresql://user:pass@host.docker.internal:5432/db

# Or use Docker network
DATABASE_URL=postgresql://user:pass@postgres:5432/db
```

---

#### 3. Hot Reload Not Working

**Symptoms:**
- Code changes not reflected in browser
- No rebuild output in logs

**Solution:**
```yaml
# Add to docker-compose.dev.yml
environment:
  - WATCHPACK_POLLING=true  # ✅ Already added
  - CHOKIDAR_USEPOLLING=true

volumes:
  - ./:/app
  - /app/node_modules  # ✅ Already configured
  - /app/.next         # ✅ Already configured
```

**Verify:**
```bash
# Check if files are mounted
docker-compose -f docker-compose.dev.yml exec app ls -la /app

# Restart dev environment
./docker-helper.sh restart-dev
```

---

#### 4. Port Already in Use

**Symptoms:**
```
Error: bind: address already in use
```

**Solution:**
```bash
# Find process using port 3000
# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac:
lsof -i :3000
kill -9 <PID>

# Or change port in docker-compose.yml
ports:
  - "3001:3000"  # Use 3001 instead
```

---

#### 5. Out of Memory

**Symptoms:**
```
FATAL ERROR: Reached heap limit
```

**Solution:**
```yaml
# Increase memory limit
deploy:
  resources:
    limits:
      memory: 4096M  # Increase to 4GB

environment:
  - NODE_OPTIONS=--max-old-space-size=4096
```

---

#### 6. Slow Build Times

**Symptoms:**
- Build takes 10+ minutes

**Solutions:**
```bash
# 1. Check .dockerignore excludes node_modules
cat .dockerignore | grep node_modules

# 2. Use BuildKit (faster builds)
export DOCKER_BUILDKIT=1
docker-compose build

# 3. Layer caching
# Ensure package.json is copied before npm install

# 4. Parallel builds (docker-compose 1.28+)
docker-compose build --parallel
```

---

#### 7. Native Module Errors

**Symptoms:**
```
Error: /app/node_modules/sharp/lib/sharp.node: invalid ELF header
```

**Explanation:**
- Native modules compiled on Windows don't work in Linux container
- Volume mount shares host's node_modules (Windows binaries)

**Solution (Already Implemented):**
```yaml
volumes:
  - ./:/app
  - /app/node_modules  # Anonymous volume prevents host node_modules
```

**Rebuild modules in container:**
```bash
docker-compose -f docker-compose.dev.yml exec app npm rebuild
```

---

#### 8. Health Check Failing

**Symptoms:**
```
Health check failed: unhealthy
```

**Debug:**
```bash
# 1. Check logs
docker-compose logs app

# 2. Manual health check
docker-compose exec app wget -O- http://localhost:3000/api/health

# 3. Check database
docker-compose exec app npx prisma db pull

# 4. Verify environment
docker-compose exec app printenv | grep -E "(DATABASE|NEXTAUTH|DIRECTGEO)"
```

**Common Causes:**
- Database URL incorrect
- Missing environment variables
- Prisma client not generated
- Port 3000 not exposed

---

### Debug Commands

```bash
# View container logs (last 100 lines)
docker-compose logs --tail=100 app

# Follow logs in real-time
docker-compose logs -f app

# Check container resources
docker stats mudra-app

# Inspect container configuration
docker inspect mudra-app | jq

# View environment variables
docker-compose exec app printenv

# Test network connectivity
docker-compose exec app ping google.com

# Check disk usage
docker system df

# Prune unused resources
docker system prune -a
```

---

## Best Practices

### Security

1. **Non-Root User** ✅
   - Runs as `node` user (UID 1000)
   - Prevents privilege escalation

2. **No New Privileges** ✅
   ```yaml
   security_opt:
     - no-new-privileges:true
   ```

3. **Read-Only Root** (Optional)
   ```yaml
   read_only: true
   tmpfs:
     - /tmp
     - /app/.next
   ```

4. **Secret Management**
   ```bash
   # Use Docker secrets (production)
   docker secret create db_url /path/to/db_url.txt
   
   # Reference in compose
   secrets:
     - db_url
   ```

### Performance

1. **Multi-Stage Builds** ✅
   - Smaller images (faster deploys)
   - Fewer attack vectors

2. **Layer Caching**
   ```dockerfile
   # Copy package files first (cached if unchanged)
   COPY package*.json ./
   RUN npm ci
   
   # Then copy source (changes more often)
   COPY . .
   ```

3. **BuildKit**
   ```bash
   export DOCKER_BUILDKIT=1
   docker-compose build
   ```

### Reliability

1. **Health Checks** ✅
   - Automatic restart on failure
   - Graceful degradation

2. **Resource Limits** ✅
   - Prevents OOM kills
   - Predictable performance

3. **Restart Policy** ✅
   ```yaml
   restart: unless-stopped
   ```

4. **Graceful Shutdown**
   ```dockerfile
   # Use dumb-init for signal handling ✅
   RUN apk add --no-cache dumb-init
   ENTRYPOINT ["dumb-init", "--"]
   ```

### Monitoring

1. **Structured Logging** ✅
   ```yaml
   logging:
     driver: json-file
     options:
       max-size: "10m"
       max-file: "3"
   ```

2. **Metrics Export**
   ```typescript
   // Add to /api/metrics endpoint
   export async function GET() {
     const metrics = {
       uptime: process.uptime(),
       memory: process.memoryUsage(),
       cpu: process.cpuUsage()
     }
     return Response.json(metrics)
   }
   ```

3. **Log Aggregation**
   - Use Loki, ELK, or CloudWatch
   - Centralize logs from multiple containers

### Development

1. **Hot Reload** ✅
   - Instant feedback loop
   - Faster development

2. **Volume Strategy** ✅
   - Bind mount for code
   - Anonymous volumes for dependencies

3. **Debugging Support** ✅
   - Chrome DevTools integration
   - Breakpoint debugging

---

## Deployment Checklist

### Pre-Deployment

- [ ] Update `.env.docker` with production values
- [ ] Test health endpoint locally
- [ ] Run database migrations
- [ ] Build production image without errors
- [ ] Test production image locally
- [ ] Check resource limits appropriate for host
- [ ] Verify all external APIs accessible
- [ ] Backup database

### Deployment

- [ ] Pull latest code on production server
- [ ] Build production image
- [ ] Stop old container gracefully
- [ ] Start new container
- [ ] Wait for healthy status
- [ ] Verify health endpoint returns 200
- [ ] Test critical user flows
- [ ] Monitor logs for errors

### Post-Deployment

- [ ] Set up external monitoring (Uptime Kuma, etc.)
- [ ] Configure log aggregation
- [ ] Test auto-restart on failure
- [ ] Document rollback procedure
- [ ] Update deployment documentation

---

## Additional Resources

- **Docker Docs**: https://docs.docker.com/
- **Next.js Docker**: https://nextjs.org/docs/deployment#docker-image
- **Prisma in Docker**: https://www.prisma.io/docs/guides/deployment/docker
- **Health Check Patterns**: https://docs.docker.com/engine/reference/builder/#healthcheck

---

## Support

**Common Questions:**

**Q: Should I use development or production in production?**  
A: Always use production (`docker-compose.yml`) in production. Development mode includes debugging tools, hot reload, and looser security.

**Q: How do I scale horizontally?**  
A: Use Docker Swarm or Kubernetes. Update `docker-compose.yml` with `deploy.replicas: 3` for Swarm mode.

**Q: Can I use this with Railway/Fly.io?**  
A: Yes! Both platforms support Dockerfile deployments. They'll use the production `Dockerfile` automatically.

**Q: How do I update dependencies?**  
A: Update `package.json` on host → Rebuild image → Restart container. The build process installs updated dependencies.

**Q: What if health check keeps failing?**  
A: Check logs (`./docker-helper.sh logs-prod`), verify environment variables, test database connection, ensure Prisma client generated.

---

**Last Updated**: 2024-01-15  
**Version**: 1.0.0  
**Maintainer**: Mudra Development Team
