# Docker Quick Reference - Mudra App

## 🚀 Quick Commands

### Development
```bash
# PowerShell (Windows)
.\docker-helper.ps1 build-dev
.\docker-helper.ps1 start-dev
.\docker-helper.ps1 logs-dev

# Bash (Linux/Mac)
./docker-helper.sh build-dev
./docker-helper.sh start-dev
./docker-helper.sh logs-dev
```

### Production
```bash
# PowerShell
.\docker-helper.ps1 build-prod
.\docker-helper.ps1 start-prod
.\docker-helper.ps1 health

# Bash
./docker-helper.sh build-prod
./docker-helper.sh start-prod
./docker-helper.sh health
```

---

## 📋 Common Tasks

### First Time Setup
```bash
# 1. Copy environment file
cp .env.docker.example .env.docker

# 2. Edit with your values
notepad .env.docker  # Windows
nano .env.docker     # Linux/Mac

# 3. Build and start
.\docker-helper.ps1 build-dev
.\docker-helper.ps1 start-dev
```

### Daily Development
```bash
# Start working
.\docker-helper.ps1 start-dev

# View logs
.\docker-helper.ps1 logs-dev

# Stop when done
.\docker-helper.ps1 stop-dev
```

### Database Operations
```bash
# Generate Prisma client
.\docker-helper.ps1 prisma-generate

# Run migrations
.\docker-helper.ps1 prisma-migrate

# Open database GUI
.\docker-helper.ps1 prisma-studio
```

### Debugging
```bash
# Open container shell
.\docker-helper.ps1 shell-dev

# Inside container:
npx prisma db pull        # Check database connection
printenv | grep DATABASE  # Check environment
npm run build            # Test build
```

---

## 🔧 Manual Docker Commands

### Build Commands
```bash
# Development build
docker-compose -f docker-compose.dev.yml build

# Production build
docker-compose -f docker-compose.yml build

# No-cache build (force fresh)
docker-compose -f docker-compose.yml build --no-cache

# Build specific service
docker-compose -f docker-compose.yml build app
```

### Start/Stop Commands
```bash
# Start in background
docker-compose -f docker-compose.yml up -d

# Start with logs
docker-compose -f docker-compose.yml up

# Stop containers
docker-compose -f docker-compose.yml down

# Stop and remove volumes
docker-compose -f docker-compose.yml down -v
```

### Log Commands
```bash
# View logs (follow)
docker-compose -f docker-compose.yml logs -f app

# View logs (last 100 lines)
docker-compose -f docker-compose.yml logs --tail=100 app

# View logs (timestamp)
docker-compose -f docker-compose.yml logs -f -t app
```

### Execution Commands
```bash
# Execute command in running container
docker-compose -f docker-compose.yml exec app <command>

# Examples:
docker-compose -f docker-compose.yml exec app npx prisma generate
docker-compose -f docker-compose.yml exec app npm run build
docker-compose -f docker-compose.yml exec app sh
```

---

## 🏥 Health & Monitoring

### Health Check
```bash
# API health check
curl http://localhost:3000/api/health

# Pretty output (with jq)
curl -s http://localhost:3000/api/health | jq

# Container health status
docker inspect mudra-app --format='{{.State.Health.Status}}'

# Health check logs
docker inspect mudra-app --format='{{range .State.Health.Log}}{{.Output}}{{end}}'
```

### Resource Monitoring
```bash
# Container stats (CPU/Memory)
docker stats mudra-app

# Container processes
docker top mudra-app

# Disk usage
docker system df

# Container details
docker inspect mudra-app
```

---

## 🐛 Troubleshooting

### Container Won't Start
```bash
# View startup errors
docker-compose -f docker-compose.yml logs app

# Rebuild with no cache
docker-compose -f docker-compose.yml build --no-cache

# Check environment variables
docker-compose -f docker-compose.yml config
```

### Database Connection Issues
```bash
# Test from container
docker-compose exec app sh
apk add postgresql-client
psql $DATABASE_URL -c "SELECT 1"

# Check environment
docker-compose exec app printenv | grep DATABASE
```

### Hot Reload Not Working
```bash
# Check volume mounts
docker inspect mudra-app | jq '.[0].Mounts'

# Restart with clean volumes
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d
```

### Port Already in Use
```bash
# Windows: Find process
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac: Find process
lsof -i :3000
kill -9 <PID>

# Or change port in docker-compose.yml
# ports:
#   - "3001:3000"
```

### Out of Memory
```bash
# Increase memory limit in docker-compose.yml
# deploy:
#   resources:
#     limits:
#       memory: 4096M

# Or set Node options
# environment:
#   - NODE_OPTIONS=--max-old-space-size=4096
```

---

## 🧹 Cleanup Commands

### Remove Containers
```bash
# Stop and remove containers
docker-compose -f docker-compose.yml down

# Remove containers and volumes
docker-compose -f docker-compose.yml down -v

# Remove containers, volumes, and images
docker-compose -f docker-compose.yml down -v --rmi all
```

### Prune Resources
```bash
# Remove stopped containers
docker container prune

# Remove unused images
docker image prune

# Remove unused volumes
docker volume prune

# Remove everything (nuclear option)
docker system prune -a --volumes

# Helper script cleanup
.\docker-helper.ps1 cleanup
```

---

## 📦 Image Management

### List Images
```bash
# List all images
docker images

# List Mudra images
docker images | grep mudra

# Image details
docker inspect mudra-app:latest
```

### Remove Images
```bash
# Remove specific image
docker rmi mudra-app:latest

# Remove all Mudra images
docker images | grep mudra | awk '{print $3}' | xargs docker rmi

# Force remove
docker rmi -f mudra-app:latest
```

### Tag and Push
```bash
# Tag image
docker tag mudra-app:latest myregistry.com/mudra-app:v1.0.0

# Push to registry
docker push myregistry.com/mudra-app:v1.0.0

# Pull from registry
docker pull myregistry.com/mudra-app:v1.0.0
```

---

## 🔐 Environment Variables

### Check Variables
```bash
# List all environment variables
docker-compose -f docker-compose.yml exec app printenv

# Check specific variable
docker-compose -f docker-compose.yml exec app printenv DATABASE_URL

# Check all DB variables
docker-compose -f docker-compose.yml exec app printenv | grep DATABASE
```

### Update Variables
```bash
# 1. Edit .env.docker
notepad .env.docker

# 2. Restart container
docker-compose -f docker-compose.yml down
docker-compose -f docker-compose.yml up -d

# Or restart helper
.\docker-helper.ps1 restart-prod
```

---

## 🌐 Network Commands

### List Networks
```bash
# List all networks
docker network ls

# Inspect network
docker network inspect mudra-network
```

### Connect Container
```bash
# Connect to network
docker network connect mudra-network other-container

# Disconnect from network
docker network disconnect mudra-network other-container
```

### Test Connectivity
```bash
# Ping another container
docker-compose -f docker-compose.yml exec app ping postgres

# Test DNS resolution
docker-compose -f docker-compose.yml exec app nslookup postgres

# Curl another service
docker-compose -f docker-compose.yml exec app curl http://postgres:5432
```

---

## 📊 Logs & Debugging

### Export Logs
```bash
# Save logs to file
docker-compose -f docker-compose.yml logs app > logs.txt

# Save with timestamps
docker-compose -f docker-compose.yml logs -t app > logs-timestamped.txt

# Last 1000 lines
docker-compose -f docker-compose.yml logs --tail=1000 app > logs-recent.txt
```

### Follow Logs
```bash
# Follow all services
docker-compose -f docker-compose.yml logs -f

# Follow specific service
docker-compose -f docker-compose.yml logs -f app

# Follow with timestamps
docker-compose -f docker-compose.yml logs -f -t app
```

### Debug Mode
```bash
# Enable Node debug logging
docker-compose -f docker-compose.dev.yml exec app sh
export NODE_OPTIONS="--inspect=0.0.0.0:9229"
npm run dev

# Connect Chrome DevTools to localhost:9229
```

---

## 🚀 Deployment

### Pre-Deploy Checklist
```bash
# 1. Test build locally
docker-compose -f docker-compose.yml build

# 2. Test run locally
docker-compose -f docker-compose.yml up -d

# 3. Check health
curl http://localhost:3000/api/health

# 4. Run tests
docker-compose -f docker-compose.yml exec app npm test

# 5. Stop local
docker-compose -f docker-compose.yml down
```

### Deploy to Server
```bash
# SSH to server
ssh user@server

# Pull code
cd /app/mudra-app
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.yml build
docker-compose -f docker-compose.yml up -d

# Check health
curl http://localhost:3000/api/health

# Monitor logs
docker-compose -f docker-compose.yml logs -f app
```

---

## 📖 File Reference

| File | Purpose |
|------|---------|
| `Dockerfile` | Production multi-stage build |
| `Dockerfile.dev` | Development with hot-reload |
| `docker-compose.yml` | Production orchestration |
| `docker-compose.dev.yml` | Development orchestration |
| `.dockerignore` | Build optimization |
| `.env.docker` | Environment variables |
| `docker-helper.sh` | Bash helper script |
| `docker-helper.ps1` | PowerShell helper script |

---

## 🆘 Getting Help

### Documentation
- **Complete Guide**: `/docs/deployment/DOCKER_COMPLETE_GUIDE.md`
- **Architecture**: `/docs/architecture/MERMAID_ARCHITECTURE.md`
- **Troubleshooting**: See "Troubleshooting" section in Complete Guide

### Commands
```bash
# Helper usage
.\docker-helper.ps1 help

# Docker Compose help
docker-compose --help

# Docker help
docker --help
```

### Support Resources
- Docker Docs: https://docs.docker.com/
- Next.js Docker: https://nextjs.org/docs/deployment#docker-image
- Prisma Docker: https://www.prisma.io/docs/guides/deployment/docker

---

## ⚡ Performance Tips

1. **Use BuildKit** (faster builds):
   ```bash
   $env:DOCKER_BUILDKIT=1  # PowerShell
   export DOCKER_BUILDKIT=1  # Bash
   ```

2. **Parallel Builds**:
   ```bash
   docker-compose build --parallel
   ```

3. **Cache Layers**:
   - Keep `package.json` copy before `npm install`
   - Don't change early layers unnecessarily

4. **Minimize Context**:
   - Add more patterns to `.dockerignore`
   - Keep build context small

5. **Multi-Stage Builds** ✅:
   - Already implemented in `Dockerfile`
   - Reduces final image by 60-70%

---

**Quick Access**:
- 🏠 Home: `http://localhost:3000`
- 🏥 Health: `http://localhost:3000/api/health`
- 🗄️ Prisma Studio: `http://localhost:5555`
- 🐛 Debugger: `chrome://inspect` (port 9229)

**Last Updated**: 2024-01-15
