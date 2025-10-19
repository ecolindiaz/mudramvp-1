# Deployment Documentation

Complete guides for deploying Mudra App on various platforms.

---

## 🐳 Docker Deployment (Recommended)

### Quick Start
👉 **[DOCKER_QUICK_START.md](./DOCKER_QUICK_START.md)** - Get running in 5 minutes

**Steps:**
1. Copy `.env.docker.example` → `.env.docker`
2. Run `.\docker-helper.ps1 build-dev`
3. Run `.\docker-helper.ps1 start-dev`
4. Access http://localhost:3000

---

### Complete Docker Documentation

| Document | Purpose | Lines | When to Use |
|----------|---------|-------|-------------|
| **[DOCKER_QUICK_START.md](./DOCKER_QUICK_START.md)** | Get started in 5 minutes | ~250 | ⭐ Start here! |
| **[DOCKER_COMPLETE_GUIDE.md](./DOCKER_COMPLETE_GUIDE.md)** | Comprehensive reference | ~700 | Deep dive, troubleshooting |
| **[DOCKER_QUICK_REFERENCE.md](./DOCKER_QUICK_REFERENCE.md)** | Command cheat sheet | ~400 | Daily operations |
| **[DOCKER_SETUP_COMPLETE.md](./DOCKER_SETUP_COMPLETE.md)** | Implementation summary | ~400 | Understand what's included |
| **[DOCKER_ENHANCEMENT_SUMMARY.md](./DOCKER_ENHANCEMENT_SUMMARY.md)** | Technical deep-dive | ~500 | Architecture details |

---

### Docker Features

✅ **Production-Ready**
- Multi-stage builds (60% smaller images)
- Health checks + auto-restart
- Resource limits (CPU/memory)
- Security hardening (non-root user)
- Comprehensive logging (10MB rotation)

✅ **Developer-Friendly**
- Hot-reload development
- Chrome DevTools debugging (port 9229)
- Prisma Studio integration
- Helper scripts (PowerShell + Bash)

✅ **Well-Documented**
- 1,500+ lines of documentation
- 8+ troubleshooting scenarios
- Deployment checklists
- Best practices

---

## 📖 Docker Guide Breakdown

### For First-Time Users
1. **[DOCKER_QUICK_START.md](./DOCKER_QUICK_START.md)** - Follow step-by-step
2. **[DOCKER_SETUP_COMPLETE.md](./DOCKER_SETUP_COMPLETE.md)** - Understand features
3. **[DOCKER_QUICK_REFERENCE.md](./DOCKER_QUICK_REFERENCE.md)** - Bookmark for commands

### For Daily Development
1. **[DOCKER_QUICK_REFERENCE.md](./DOCKER_QUICK_REFERENCE.md)** - Common commands
2. `.\docker-helper.ps1` - Helper script usage
3. **[DOCKER_COMPLETE_GUIDE.md](./DOCKER_COMPLETE_GUIDE.md)** → Troubleshooting (when needed)

### For DevOps/Deployment
1. **[DOCKER_COMPLETE_GUIDE.md](./DOCKER_COMPLETE_GUIDE.md)** - Full reference
2. **[DOCKER_ENHANCEMENT_SUMMARY.md](./DOCKER_ENHANCEMENT_SUMMARY.md)** - Architecture details
3. **[DOCKER_COMPLETE_GUIDE.md](./DOCKER_COMPLETE_GUIDE.md)** → Production Setup section

---

## 🚀 Vercel Deployment

### Quick Deploy
👉 **[VERCEL_QUICKSTART.md](./VERCEL_QUICKSTART.md)** - Deploy to Vercel in minutes

### Complete Guide
📚 **[VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)** - Full Vercel setup with environment variables, database, and custom domains

---

## 🔧 Platform Comparison

| Platform | Best For | Pros | Cons |
|----------|----------|------|------|
| **Docker (Local)** | Development, Testing | Full control, debugging | Requires Docker Desktop |
| **Docker (Server)** | Production hosting | Customizable, cost-effective | Requires server management |
| **Vercel** | Quick deployments | Zero-config, fast CDN | Vendor lock-in, serverless limits |
| **Railway** | Hobby projects | Simple, affordable | Limited free tier |
| **AWS/GCP** | Enterprise | Scalable, feature-rich | Complex, expensive |

---

## 📋 Deployment Checklists

### Docker Development
- [ ] Copy `.env.docker.example` → `.env.docker`
- [ ] Update with your API keys
- [ ] Run `.\docker-helper.ps1 build-dev`
- [ ] Run `.\docker-helper.ps1 start-dev`
- [ ] Verify http://localhost:3000/api/health returns healthy
- [ ] Test hot-reload (edit code, see changes)

### Docker Production
- [ ] Update `.env.docker` with production values
- [ ] Test build: `.\docker-helper.ps1 build-prod`
- [ ] Test locally: `.\docker-helper.ps1 start-prod`
- [ ] Verify health check passes
- [ ] Deploy to production server
- [ ] Monitor health endpoint
- [ ] Set up external monitoring (Uptime Kuma, etc.)

### Vercel Deployment
- [ ] Connect GitHub repository
- [ ] Configure environment variables
- [ ] Set up database (Supabase, Railway)
- [ ] Deploy and test
- [ ] Configure custom domain (optional)
- [ ] Set up monitoring

---

## 🆘 Common Issues

### Docker: Container Won't Start
```powershell
# View errors
.\docker-helper.ps1 logs-dev

# Rebuild with no cache
docker-compose -f docker-compose.dev.yml build --no-cache
```

**Solution:** See [DOCKER_COMPLETE_GUIDE.md](./DOCKER_COMPLETE_GUIDE.md) → Troubleshooting → Container Won't Start

### Docker: Database Connection Failed
```powershell
# Check environment
docker-compose -f docker-compose.dev.yml exec app printenv DATABASE_URL
```

**Solution:** See [DOCKER_COMPLETE_GUIDE.md](./DOCKER_COMPLETE_GUIDE.md) → Troubleshooting → Database Connection Fails

### Docker: Hot Reload Not Working
```powershell
# Restart with clean volumes
docker-compose -f docker-compose.dev.yml down -v
.\docker-helper.ps1 start-dev
```

**Solution:** See [DOCKER_COMPLETE_GUIDE.md](./DOCKER_COMPLETE_GUIDE.md) → Troubleshooting → Hot Reload Not Working

### Vercel: Build Fails
**Solution:** Check [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) → Troubleshooting section

---

## 📊 Docker vs Vercel

### Use Docker When:
- ✅ You need full control over infrastructure
- ✅ Debugging with breakpoints is important
- ✅ Cost optimization is a priority
- ✅ Complex background jobs or websockets
- ✅ Custom server configuration needed

### Use Vercel When:
- ✅ You want zero-config deployments
- ✅ Fast global CDN is important
- ✅ Automatic SSL and domains needed
- ✅ Git-based CI/CD workflow preferred
- ✅ Serverless architecture is acceptable

---

## 🎓 Learning Path

### Beginner
1. Start with **[DOCKER_QUICK_START.md](./DOCKER_QUICK_START.md)**
2. Run development environment locally
3. Make code changes, see hot-reload work
4. Explore Prisma Studio (database GUI)

### Intermediate
1. Read **[DOCKER_COMPLETE_GUIDE.md](./DOCKER_COMPLETE_GUIDE.md)** → Architecture
2. Understand multi-stage builds
3. Set up Chrome DevTools debugging
4. Deploy to production server

### Advanced
1. Review **[DOCKER_ENHANCEMENT_SUMMARY.md](./DOCKER_ENHANCEMENT_SUMMARY.md)**
2. Customize resource limits
3. Set up external monitoring
4. Implement CI/CD pipeline

---

## 🔗 Quick Links

### Docker Documentation
- **Quick Start**: [DOCKER_QUICK_START.md](./DOCKER_QUICK_START.md)
- **Complete Guide**: [DOCKER_COMPLETE_GUIDE.md](./DOCKER_COMPLETE_GUIDE.md)
- **Quick Reference**: [DOCKER_QUICK_REFERENCE.md](./DOCKER_QUICK_REFERENCE.md)
- **Setup Summary**: [DOCKER_SETUP_COMPLETE.md](./DOCKER_SETUP_COMPLETE.md)
- **Technical Details**: [DOCKER_ENHANCEMENT_SUMMARY.md](./DOCKER_ENHANCEMENT_SUMMARY.md)

### Vercel Documentation
- **Quick Deploy**: [VERCEL_QUICKSTART.md](./VERCEL_QUICKSTART.md)
- **Complete Setup**: [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)

### Helper Scripts
- **PowerShell**: `mudra-app/docker-helper.ps1`
- **Bash**: `mudra-app/docker-helper.sh`

### Application URLs (Local Docker)
- 🏠 **App**: http://localhost:3000
- 🏥 **Health**: http://localhost:3000/api/health
- 🗄️ **Prisma Studio**: http://localhost:5555 (after running `.\docker-helper.ps1 prisma-studio`)
- 🐛 **Debugger**: chrome://inspect → localhost:9229

---

## 📦 File Reference

### Active Docker Files (mudra-app/)
- `Dockerfile` - Production multi-stage build
- `Dockerfile.dev` - Development with hot-reload
- `docker-compose.yml` - Production orchestration
- `docker-compose.dev.yml` - Development orchestration
- `.dockerignore` - Build optimization
- `.env.docker.example` - Environment template
- `docker-helper.sh` - Bash management script
- `docker-helper.ps1` - PowerShell management script

### Health Endpoint
- `app/api/health/route.ts` - Health check API

---

## 🎯 Recommended Workflow

### Starting a Feature
1. `.\docker-helper.ps1 start-dev` - Start environment
2. Edit code in your IDE
3. Save → Auto-reload in browser
4. Check `.\docker-helper.ps1 logs-dev` for errors

### Testing Changes
1. `.\docker-helper.ps1 health` - Check health
2. Test in browser at http://localhost:3000
3. Use `.\docker-helper.ps1 prisma-studio` to verify database
4. Set breakpoints with Chrome DevTools (chrome://inspect)

### Committing Code
1. `.\docker-helper.ps1 stop-dev` - Stop environment
2. Git commit and push
3. CI/CD runs Docker build
4. Deploy to production

### Deploying to Production
1. `.\docker-helper.ps1 build-prod` - Test production build locally
2. Push to production server
3. `.\docker-helper.ps1 start-prod` - Start production environment
4. `.\docker-helper.ps1 health` - Verify health
5. Monitor logs with `.\docker-helper.ps1 logs-prod`

---

## 🎉 Getting Help

### Documentation
- Start with **[DOCKER_QUICK_START.md](./DOCKER_QUICK_START.md)** for immediate guidance
- Use **[DOCKER_QUICK_REFERENCE.md](./DOCKER_QUICK_REFERENCE.md)** for command lookups
- Read **[DOCKER_COMPLETE_GUIDE.md](./DOCKER_COMPLETE_GUIDE.md)** for deep troubleshooting

### Commands
```powershell
# Helper usage
.\docker-helper.ps1 help

# Docker Compose help
docker-compose --help

# Docker help
docker --help
```

### External Resources
- **Docker Docs**: https://docs.docker.com/
- **Next.js Docker**: https://nextjs.org/docs/deployment#docker-image
- **Prisma Docker**: https://www.prisma.io/docs/guides/deployment/docker

---

## 📝 Document Maintenance

### Adding New Guides
1. Create markdown file in `/docs/deployment/`
2. Add entry to this README
3. Link from related documents
4. Update Table of Contents

### Updating Existing Guides
1. Edit markdown file
2. Update "Last Updated" date at bottom
3. Increment version if major changes
4. Update this README if TOC changes

---

**Maintained by**: Mudra Development Team  
**Last Updated**: 2024-01-15  
**Version**: 1.0.0

---

**Ready to deploy? Start with [DOCKER_QUICK_START.md](./DOCKER_QUICK_START.md)!** 🚀
