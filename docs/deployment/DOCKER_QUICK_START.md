# 🚀 Docker Quick Start Guide

Get up and running with Mudra in under 5 minutes!

---

## Prerequisites
- ✅ Docker Desktop installed and running
- ✅ 4GB+ available RAM
- ✅ PostgreSQL database URL (Supabase or local)
- ✅ API keys (DirectGEO, Firecrawl, OpenAI)

---

## Step 1: Setup Environment (2 minutes)

```powershell
# Navigate to mudra-app
cd mudra-app

# Copy environment template
cp .env.docker.example .env.docker
```

**Edit `.env.docker`** with your values:
```env
DATABASE_URL=postgresql://user:pass@host:5432/db?pgbouncer=true
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_secret_here
DIRECTGEO_API_KEY=your_key
FIRECRAWL_API_KEY=your_key
OPENAI_API_KEY=sk-...
```

💡 **Tip**: Generate secret with `openssl rand -base64 32`

---

## Step 2: Start Development (2 minutes)

### PowerShell (Windows)
```powershell
# Build development image
.\docker-helper.ps1 build-dev

# Start development environment
.\docker-helper.ps1 start-dev
```

### Bash (Linux/Mac)
```bash
# Build development image
./docker-helper.sh build-dev

# Start development environment
./docker-helper.sh start-dev
```

**Wait ~40 seconds** for health checks to complete.

---

## Step 3: Verify It Works (1 minute)

### Check Health
```powershell
.\docker-helper.ps1 health
```

**Expected output:**
```json
{
  "status": "healthy",
  "checks": {
    "database": { "status": "healthy" },
    "environment": { "status": "healthy" }
  }
}
```

### Access Application
- 🌐 **App**: http://localhost:3000
- 🏥 **Health**: http://localhost:3000/api/health
- 🗄️ **Database GUI**: Run `.\docker-helper.ps1 prisma-studio` → http://localhost:5555

---

## 🎉 You're Ready!

Your Docker environment is now running with:
- ✅ Hot-reload (code changes update instantly)
- ✅ Health monitoring (auto-restart on failure)
- ✅ Debugging support (Chrome DevTools on port 9229)

---

## Common Commands

### View Logs
```powershell
.\docker-helper.ps1 logs-dev
```

### Stop Environment
```powershell
.\docker-helper.ps1 stop-dev
```

### Restart (after code changes)
```powershell
.\docker-helper.ps1 restart-dev
```

### Open Container Shell
```powershell
.\docker-helper.ps1 shell-dev
```

### Database Operations
```powershell
# Generate Prisma client
.\docker-helper.ps1 prisma-generate

# Run migrations
.\docker-helper.ps1 prisma-migrate

# Open Prisma Studio (database GUI)
.\docker-helper.ps1 prisma-studio
```

---

## 🐛 Debugging

### Chrome DevTools
1. Open Chrome: `chrome://inspect`
2. Click "Configure" → Add `localhost:9229`
3. Click "inspect" under Remote Target
4. Set breakpoints in your code
5. Trigger breakpoint via browser

### VS Code Debugging
Add to `.vscode/launch.json`:
```json
{
  "name": "Docker: Attach to Node",
  "type": "node",
  "request": "attach",
  "port": 9229,
  "address": "localhost",
  "localRoot": "${workspaceFolder}/mudra-app",
  "remoteRoot": "/app"
}
```

Press **F5** to start debugging!

---

## ⚠️ Troubleshooting

### Container Won't Start
```powershell
# View errors
.\docker-helper.ps1 logs-dev

# Rebuild with no cache
docker-compose -f docker-compose.dev.yml build --no-cache
.\docker-helper.ps1 start-dev
```

### Database Connection Failed
```powershell
# Check environment variable
docker-compose -f docker-compose.dev.yml exec app printenv DATABASE_URL

# Test connection
docker-compose -f docker-compose.dev.yml exec app sh
# Inside container:
apk add postgresql-client
psql $DATABASE_URL -c "SELECT 1"
```

### Hot Reload Not Working
```powershell
# Restart with clean volumes
docker-compose -f docker-compose.dev.yml down -v
.\docker-helper.ps1 start-dev
```

### Port 3000 Already in Use
```powershell
# Find and kill process using port 3000
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Then restart
.\docker-helper.ps1 start-dev
```

**More help:** See `/docs/deployment/DOCKER_COMPLETE_GUIDE.md` → Troubleshooting

---

## 📚 Full Documentation

- **Complete Guide**: `/docs/deployment/DOCKER_COMPLETE_GUIDE.md` (700+ lines)
- **Quick Reference**: `/docs/deployment/DOCKER_QUICK_REFERENCE.md` (commands)
- **Setup Summary**: `/docs/deployment/DOCKER_SETUP_COMPLETE.md` (overview)
- **Enhancement Details**: `/docs/deployment/DOCKER_ENHANCEMENT_SUMMARY.md` (technical)

---

## 🎯 Next Steps

1. **Start coding!** - Edit files and see changes instantly
2. **Explore Prisma Studio** - Visual database browser at http://localhost:5555
3. **Try debugging** - Set breakpoints in Chrome DevTools
4. **Read docs** - Learn about health checks, resource limits, and best practices

---

## 💡 Pro Tips

### Speed Up Builds
```powershell
# Enable BuildKit for parallel builds
$env:DOCKER_BUILDKIT=1
.\docker-helper.ps1 build-dev
```

### Clean Up Resources
```powershell
# Remove all containers and volumes
.\docker-helper.ps1 cleanup
```

### Check Resource Usage
```powershell
# View CPU/Memory usage
docker stats mudra-app
```

### Export Logs
```powershell
# Save logs to file
docker-compose -f docker-compose.dev.yml logs app > logs.txt
```

---

## 🆘 Get Help

```powershell
# Helper script usage
.\docker-helper.ps1 help

# Docker Compose help
docker-compose --help

# Docker help
docker --help
```

---

**That's it! You're ready to build amazing GEO features! 🚀**

**Questions?** Check the documentation or run `.\docker-helper.ps1 help`

---

**Version**: 1.0.0  
**Last Updated**: 2024-01-15
