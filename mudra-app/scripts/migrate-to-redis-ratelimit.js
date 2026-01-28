/**
 * Migration script to update all API routes from in-memory to Redis rate limiter
 * 
 * Usage: node scripts/migrate-to-redis-ratelimit.js
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const OLD_IMPORT = `from '@/lib/auth/rate-limiter'`;
const NEW_IMPORT = `from '@/lib/auth/rate-limiter-redis'`;

// Find all TypeScript files in app/api
const apiFiles = glob.sync('app/api/**/*.ts', {
  cwd: path.join(__dirname, '..'),
  absolute: true
});

let updatedCount = 0;
let errorCount = 0;

console.log(`Found ${apiFiles.length} API route files to check\n`);

apiFiles.forEach(file => {
  try {
    const content = fs.readFileSync(file, 'utf8');
    
    // Check if file uses the old rate limiter
    if (content.includes(OLD_IMPORT)) {
      const newContent = content.replace(
        new RegExp(OLD_IMPORT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        NEW_IMPORT
      );
      
      fs.writeFileSync(file, newContent, 'utf8');
      updatedCount++;
      console.log(`✅ Updated: ${path.relative(process.cwd(), file)}`);
    }
  } catch (error) {
    errorCount++;
    console.error(`❌ Error processing ${file}:`, error.message);
  }
});

console.log(`\n${'='.repeat(60)}`);
console.log(`Migration Complete!`);
console.log(`${'='.repeat(60)}`);
console.log(`✅ Files updated: ${updatedCount}`);
console.log(`⏭️  Files skipped: ${apiFiles.length - updatedCount - errorCount}`);
console.log(`❌ Errors: ${errorCount}`);

if (updatedCount > 0) {
  console.log(`\n📝 Next steps:`);
  console.log(`1. Set up Upstash Redis:`);
  console.log(`   - Visit https://upstash.com`);
  console.log(`   - Create a Redis database (free tier available)`);
  console.log(`   - Copy credentials to .env.local:`);
  console.log(`     UPSTASH_REDIS_REST_URL=https://your-endpoint.upstash.io`);
  console.log(`     UPSTASH_REDIS_REST_TOKEN=your-token-here`);
  console.log(`\n2. Test in development:`);
  console.log(`   npm run dev`);
  console.log(`\n3. Deploy to production with env vars configured`);
  console.log(`\n⚠️  Without Redis credentials, the system will fall back to in-memory`);
  console.log(`   rate limiting (which is still vulnerable in production)`);
}
