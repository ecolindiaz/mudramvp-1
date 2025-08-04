#!/usr/bin/env node

/**
 * Script to switch from the fallback model to the actual OpenAI o3 model
 * Run this script when OpenAI o3 becomes publicly available
 */

const fs = require('fs');
const path = require('path');

const configFile = path.join(__dirname, '../lib/config/ai-models.ts');

console.log('🔄 Switching to OpenAI o3 model...');

try {
  // Read the current config file
  let content = fs.readFileSync(configFile, 'utf8');
  
  // Replace the fallback model with the actual o3 model
  const updatedContent = content.replace(
    /model: 'gpt-4-0125-preview',.*\/\/ TODO: Change to 'o3' when OpenAI o3 becomes publicly available/,
    "model: 'o3',"
  );
  
  // Write the updated content back
  fs.writeFileSync(configFile, updatedContent);
  
  console.log('✅ Successfully switched to OpenAI o3 model');
  console.log('📝 Don\'t forget to:');
  console.log('   1. Update your OpenAI API key if needed');
  console.log('   2. Test the deep think functionality');
  console.log('   3. Monitor usage and costs');
  console.log('   4. Update documentation if needed');
  
} catch (error) {
  console.error('❌ Error switching to o3 model:', error.message);
  process.exit(1);
}