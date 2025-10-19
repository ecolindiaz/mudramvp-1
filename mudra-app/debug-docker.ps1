# Docker Debug Script for "Stuck on Starting" Issue
# Run this from mudra-app directory

Write-Host "=== DOCKER DEBUG DIAGNOSTICS ===" -ForegroundColor Cyan

# 1. Check container status
Write-Host "`n1. Container Status:" -ForegroundColor Yellow
docker ps -a | Select-String "mudra"

# 2. Stop and remove existing container
Write-Host "`n2. Stopping existing containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.dev.yml down

# 3. Rebuild with no cache
Write-Host "`n3. Rebuilding image (this may take a few minutes)..." -ForegroundColor Yellow
docker-compose -f docker-compose.dev.yml build --no-cache

# 4. Start in foreground with verbose output
Write-Host "`n4. Starting container (watching logs)..." -ForegroundColor Yellow
Write-Host "Press Ctrl+C if it hangs for more than 60 seconds" -ForegroundColor Red
docker-compose -f docker-compose.dev.yml up
