# Docker Native Modules Fix

## Problem
The error `Failed to load native binding` for `@tailwindcss/oxide` occurs because:
1. Tailwind CSS v4 uses native bindings (Rust-based)
2. These bindings are platform-specific (Windows vs Alpine Linux)
3. When node_modules from Windows host gets copied to Linux container, native modules break

## Solution Applied

### 1. Updated Dockerfile.dev
- Added build tools: `python3`, `make`, `g++` (required for compiling native modules)
- Added explicit rebuild step: `npm rebuild @tailwindcss/oxide`
- Ensured npm install runs in container (not copying host's node_modules)

### 2. Docker Ignore Configuration
- `.dockerignore` already excludes `node_modules` from being copied
- This ensures container builds its own node_modules with correct binaries

### 3. Docker Compose Volumes
- Volume mounts configured to preserve container's `node_modules`
- `/app/node_modules` volume prevents host's Windows modules from overwriting

## Rebuild Steps

```powershell
# Clean rebuild
cd C:\Users\emawe\Documents\GitHub\MudraMVP\mudra-app
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml build --no-cache
docker compose -f docker-compose.dev.yml up
```

## Alternative: Use Tailwind CSS v3

If the native binding issue persists, consider downgrading to Tailwind CSS v3:

```powershell
npm install tailwindcss@^3 @tailwindcss/typography@^0.5 --save
```

Tailwind v3 uses JavaScript-based tooling (no native bindings).

## Verify Native Modules

To check if native modules are built correctly in container:

```powershell
docker compose -f docker-compose.dev.yml run app ls -la node_modules/@tailwindcss/oxide
```

Should show binaries for `linux-x64-musl` or similar Alpine-compatible architecture.
