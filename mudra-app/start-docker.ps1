Write-Host "🐳 Starting Mudra MVP in Docker..." -ForegroundColor Cyan

# Build and start the development environment
docker-compose -f docker-compose.dev.yml up --build

Write-Host "✅ Mudra MVP is running at http://localhost:3000" -ForegroundColor Green
Write-Host "📊 PostgreSQL is running on localhost:5432" -ForegroundColor Blue
Write-Host "🛑 To stop: Ctrl+C or run: docker-compose -f docker-compose.dev.yml down" -ForegroundColor Yellow
