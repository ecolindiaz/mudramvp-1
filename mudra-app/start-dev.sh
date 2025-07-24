#!/bin/bash
set -euo pipefail
echo "🧹 Cleaning up existing processes..."
pkill -15 -f "next dev" || true

# Wait for processes to fully terminate
echo "⏳ Waiting for processes to fully terminate..."
while pgrep -f "next dev" > /dev/null 2>&1; do
  echo "   Still waiting for next dev processes to terminate..."
  sleep 1
done
echo "✅ All next dev processes terminated"

echo "🗑️  Clearing Next.js cache..."
rm -rf .next

echo "🔍 Checking port 3000..."
if lsof -i :3000 > /dev/null 2>&1; then
  echo "⚠️  Port 3000 is still in use. Waiting..."
  sleep 3
  if lsof -i :3000 > /dev/null 2>&1; then
    echo "❌ Port 3000 still occupied. Please check manually:"
    lsof -i :3000
    exit 1
  fi
fi

echo "🚀 Starting development server..."
npm run dev 