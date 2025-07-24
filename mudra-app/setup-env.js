#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const envTemplate = `# Database
DATABASE_URL="postgresql://user:password@localhost:5432/mudra"
REDIS_URL="redis://localhost:6379"

# Authentication
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret-here"

# AI Services
OPENAI_API_KEY="your-openai-api-key"
ANTHROPIC_API_KEY="your-anthropic-api-key"
PERPLEXITY_API_KEY="your-perplexity-api-key"
GOOGLE_AI_API_KEY="your-google-ai-api-key"

# Stripe
STRIPE_SECRET_KEY="your-stripe-secret-key"
STRIPE_PUBLISHABLE_KEY="your-stripe-publishable-key"
STRIPE_WEBHOOK_SECRET="your-stripe-webhook-secret"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Job Queue
QUEUE_REDIS_URL="redis://localhost:6379/1"
`;

const envPath = path.join(__dirname, '.env.local');

if (fs.existsSync(envPath)) {
  console.log('⚠️  .env.local already exists. Not overwriting.');
  console.log('   Delete it first if you want to recreate it.');
} else {
  fs.writeFileSync(envPath, envTemplate);
  console.log('✅ Created .env.local file');
  console.log('📝 Please update it with your actual API keys and database URLs');
} 