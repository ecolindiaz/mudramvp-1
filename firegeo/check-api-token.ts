import { db } from './lib/db';
import { apiTokens } from './lib/db/schema';

async function checkTokens() {
  try {
    console.log('Checking API tokens...\n');
    
    const tokens = await db.select().from(apiTokens);
    
    console.log(`Found ${tokens.length} token(s):\n`);
    
    tokens.forEach((token, index) => {
      console.log(`Token ${index + 1}:`);
      console.log(`  ID: ${token.id}`);
      console.log(`  Name: ${token.name}`);
      console.log(`  User ID: ${token.userId || 'NULL ⚠️'}`);
      console.log(`  Scopes: ${JSON.stringify(token.scopes)}`);
      console.log(`  Is Active: ${token.isActive}`);
      console.log(`  Created: ${token.createdAt}`);
      console.log(`  Last Used: ${token.lastUsed || 'Never'}`);
      console.log(`  Expires: ${token.expiresAt || 'Never'}\n`);
    });
    
    const nullUserIdTokens = tokens.filter(t => !t.userId);
    if (nullUserIdTokens.length > 0) {
      console.log(`⚠️  WARNING: ${nullUserIdTokens.length} token(s) have NULL userId!`);
      console.log('This will cause the "null value in column user_id" error.\n');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error checking tokens:', error);
    process.exit(1);
  }
}

checkTokens();
