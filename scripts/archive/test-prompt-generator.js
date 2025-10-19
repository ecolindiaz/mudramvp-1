/**
 * Test script for prompt generator
 * Run: node test-prompt-generator.js
 */

import { generate100Prompts, getPromptsGroupedByCategory } from './lib/prompt-generator.ts';

// Example brand data (Y Combinator style)
const exampleBrand = {
  name: 'Y Combinator',
  description: 'provides seed funding, mentorship, and access to a vast network to early-stage tech companies',
  industry: 'startup accelerator',
  mainProducts: ['seed funding', 'startup program', 'demo day'],
  icp: 'early-stage tech founders and startups',
  competitors: ['Techstars', '500 Startups', 'Seedcamp', 'AngelPad', 'MassChallenge']
};

console.log('='.repeat(80));
console.log('🎯 PROMPT GENERATOR TEST');
console.log('='.repeat(80));
console.log(`\nBrand: ${exampleBrand.name}`);
console.log(`Industry: ${exampleBrand.industry}`);
console.log(`Products: ${exampleBrand.mainProducts.join(', ')}`);
console.log(`Competitors: ${exampleBrand.competitors.join(', ')}`);
console.log(`ICP: ${exampleBrand.icp}`);
console.log('\n' + '='.repeat(80));

// Generate prompts
const prompts = generate100Prompts(exampleBrand);

console.log(`\n✅ Generated ${prompts.length} prompts\n`);

// Group by category
const grouped = getPromptsGroupedByCategory(exampleBrand);

// Display by category
Object.entries(grouped).forEach(([category, categoryPrompts]) => {
  console.log(`\n📁 ${category.toUpperCase()} (${categoryPrompts.length} prompts)`);
  console.log('-'.repeat(80));
  categoryPrompts.forEach((prompt, index) => {
    console.log(`${index + 1}. ${prompt.text}`);
  });
});

console.log('\n' + '='.repeat(80));
console.log('📊 CATEGORY BREAKDOWN');
console.log('='.repeat(80));
Object.entries(grouped).forEach(([category, categoryPrompts]) => {
  console.log(`  ${category.padEnd(25)} : ${categoryPrompts.length} prompts`);
});

// Count prompts that mention brand name
const brandMentions = prompts.filter(p => p.text.includes(exampleBrand.name)).length;
const nonBrandMentions = prompts.length - brandMentions;

console.log('\n' + '='.repeat(80));
console.log('🎯 BRAND NAME ANALYSIS');
console.log('='.repeat(80));
console.log(`  Prompts mentioning brand name    : ${brandMentions} (${((brandMentions/prompts.length)*100).toFixed(1)}%)`);
console.log(`  Prompts WITHOUT brand name       : ${nonBrandMentions} (${((nonBrandMentions/prompts.length)*100).toFixed(1)}%)`);
console.log(`\n  ✨ ${nonBrandMentions} prompts test organic visibility!`);

console.log('\n' + '='.repeat(80));
console.log('✅ All prompts generated successfully!');
console.log('='.repeat(80) + '\n');
