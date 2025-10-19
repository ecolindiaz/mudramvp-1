#!/usr/bin/env node

/**
 * Setup Script for Prompt Management System
 * Run this after implementation to initialize the database
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Setting up Prompt Management System...\n');

const mudraAppPath = path.join(__dirname, 'mudra-app');

try {
  // Step 1: Generate Prisma Client
  console.log('📦 Step 1: Generating Prisma Client...');
  execSync('npx prisma generate', {
    cwd: mudraAppPath,
    stdio: 'inherit'
  });
  console.log('✅ Prisma Client generated\n');

  // Step 2: Create and apply migration
  console.log('🗄️  Step 2: Creating database migration...');
  execSync('npx prisma migrate dev --name add_prompt_management', {
    cwd: mudraAppPath,
    stdio: 'inherit'
  });
  console.log('✅ Migration created and applied\n');

  console.log('🎉 Setup complete!\n');
  console.log('Next steps:');
  console.log('1. Start your development server: npm run dev');
  console.log('2. Complete onboarding to test prompt generation');
  console.log('3. Visit /dashboard/prompts to manage prompts');
  console.log('4. Run analysis to test the full flow\n');

} catch (error) {
  console.error('❌ Setup failed:', error.message);
  console.error('\nTroubleshooting:');
  console.error('- Make sure you are in the project root directory');
  console.error('- Verify DATABASE_URL is set in mudra-app/.env.local');
  console.error('- Check that PostgreSQL is running');
  console.error('- Ensure you have write permissions\n');
  process.exit(1);
}
