# Development Server Troubleshooting Guide

## Quick Fix for Server Issues

If you're having trouble starting the development server, use one of these methods:

### Method 1: Clean Start Script
```bash
./start-dev.sh
```

### Method 2: NPM Clean Script
```bash
npm run dev:clean
```

### Method 3: Manual Cleanup
```bash
# Kill existing processes
pkill -f "next dev"

# Clear cache
rm -rf .next

# Start fresh
npm run dev
```

## Common Issues & Solutions

### 1. "Port 3000 is already in use"
**Cause**: Previous Next.js process didn't terminate properly
**Solution**: 
```bash
# Find what's using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

### 2. "Server appears running but not responding"
**Cause**: Multiple processes or corrupted cache
**Solution**: 
```bash
# Kill all Next.js processes
pkill -f "next dev"

# Clear all cache
rm -rf .next node_modules/.cache

# Restart
npm run dev
```

### 3. "Webpack caching errors"
**Cause**: Corrupted webpack cache
**Solution**:
```bash
# Clear Next.js cache
rm -rf .next

# Or clear everything
rm -rf .next node_modules/.cache
```

### 4. "Module not found errors after dependency changes"
**Cause**: Node modules cache issues
**Solution**:
```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

## Best Practices

1. **Always use Ctrl+C to stop the server** (don't just close terminal)
2. **Use the clean startup scripts** when you encounter issues
3. **Check for running processes** before starting: `ps aux | grep "next dev"`
4. **Monitor port usage**: `lsof -i :3000`
5. **Clear cache regularly** if you're making dependency changes

## Prevention Tips

- Don't run multiple development servers simultaneously
- Close terminal sessions properly
- Use process managers like PM2 for production
- Regularly clear cache when switching branches
- Keep Node.js and npm up to date

## Quick Commands Reference

```bash
# Check if server is running
lsof -i :3000

# Check Next.js processes
ps aux | grep "next dev"

# Test server response
curl -s -w "%{http_code}\n" http://localhost:3000 -o /dev/null

# Kill all Next.js processes
pkill -f "next dev"

# Clear all cache
rm -rf .next node_modules/.cache
``` 