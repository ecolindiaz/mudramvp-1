#!/usr/bin/env node

// Simple Firegeo setup script
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('🔧 Setting up Firegeo for development...\n');

// Generate a proper BETTER_AUTH_SECRET if needed
const generateBetterAuthSecret = () => {
  return crypto.randomBytes(32).toString('base64');
};

// Generate webhook secret
const generateWebhookSecret = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Read current .env.local
const envPath = path.join(__dirname, '.env.local');
let envContent = '';

try {
  envContent = fs.readFileSync(envPath, 'utf8');
} catch (error) {
  console.log('Creating new .env.local file...');
}

// Update or add necessary environment variables
const newBetterAuthSecret = generateBetterAuthSecret();
const webhookSecret = generateWebhookSecret();

const updatedEnv = `# Database
DATABASE_URL="postgresql://postgres.bqobjllkucuskllghosv:qn07kYcU0MUqxvDK@aws-0-us-east-1.pooler.supabase.com:6543/postgres"

# Better Auth (Required for registration)
BETTER_AUTH_SECRET="${newBetterAuthSecret}"
NEXT_PUBLIC_APP_URL="http://localhost:3001"

# Webhook Secret for API integration
WEBHOOK_SECRET="${webhookSecret}"

# Optional - can be left as placeholder for now
AUTUMN_SECRET_KEY="your-autumn-api-key"
STRIPE_SECRET_KEY="sk_test_placeholder"
STRIPE_PUBLISHABLE_KEY="pk_test_placeholder"
STRIPE_WEBHOOK_SECRET="whsec_placeholder"
RESEND_API_KEY="re_placeholder"

# AI Providers (Optional - add real keys if you want)
OPENAI_API_KEY="sk-placeholder"
ANTHROPIC_API_KEY="sk-ant-placeholder"
GOOGLE_GENERATIVE_AI_API_KEY="placeholder"
PERPLEXITY_API_KEY="pplx-placeholder"

# Environment
NODE_ENV="development"
`;

// Write the updated .env.local
fs.writeFileSync(envPath, updatedEnv);

console.log('✅ Updated .env.local with proper secrets');
console.log('🔑 Generated BETTER_AUTH_SECRET for authentication');
console.log('🎣 Generated WEBHOOK_SECRET:', webhookSecret);
console.log('\n📋 Next steps:');
console.log('1. Run: npm run db:push (if not done already)');
console.log('2. Start Firegeo: npm run dev');
console.log('3. Visit: http://localhost:3001');
console.log('4. Try registering again');
console.log(`\n🎣 Use this webhook secret in your Mudra app .env:`);
console.log(`FIREGEO_WEBHOOK_SECRET=${webhookSecret}`);
