@echo off
echo 🐳 Starting Mudra MVP in Docker...

REM Build and start the development environment
docker-compose -f docker-compose.dev.yml up --build

echo ✅ Mudra MVP is running at http://localhost:3000
echo 📊 PostgreSQL is running on localhost:5432
echo 🛑 To stop: Ctrl+C or run: docker-compose -f docker-compose.dev.yml down
