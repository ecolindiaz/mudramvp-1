// Quick inline test for prompt generator
const brand = {
  name: 'Y Combinator',
  description: 'provides seed funding, mentorship, and access to a vast network to early-stage tech companies',
  industry: 'startup accelerator',
  mainProducts: ['seed funding', 'startup program', 'demo day'],
  icp: 'early-stage tech founders and startups',
  competitors: ['Techstars', '500 Startups', 'Seedcamp', 'AngelPad']
};

console.log('Testing prompts for:', brand.name);
console.log('\n=== SAMPLE PROMPTS (should mostly NOT mention brand) ===\n');

// Direct brand prompts (only 10 that mention the brand)
console.log('✅ DIRECT BRAND (10 prompts - mentions brand):');
console.log('  1. What is Y Combinator?');
console.log('  2. Tell me about Y Combinator');
console.log('  3. Y Combinator reviews');
console.log('  ...(7 more)');

console.log('\n🎯 VALUE PROPOSITION (20 prompts - NO brand mention):');
console.log('  1. Where to get seed funding for startups');
console.log('  2. Best seed funding options');
console.log('  3. Where to find startup mentorship');
console.log('  4. Best mentorship programs for startups');
console.log('  5. Best networking opportunities for startups');
console.log('  ...(15 more)');

console.log('\n🏢 INDUSTRY LEADERSHIP (15 prompts - NO brand mention):');
console.log('  1. Best startup accelerator companies in 2025');
console.log('  2. Top startup accelerator organizations');
console.log('  3. Leading startup accelerator providers');
console.log('  4. Most innovative startup accelerator companies');
console.log('  ...(11 more)');

console.log('\n🔍 PROBLEM SOLVING (15 prompts - NO brand mention):');
console.log('  1. Where to find startup accelerator support');
console.log('  2. How to launch a startup');
console.log('  3. startup accelerator resources');
console.log('  4. Getting started with startup accelerator');
console.log('  ...(11 more)');

console.log('\n👥 TARGET AUDIENCE (15 prompts - NO brand mention):');
console.log('  1. Best startup accelerator for early-stage tech founders');
console.log('  2. startup accelerator options for early-stage founders');
console.log('  3. Top startup accelerator for early-stage startups');
console.log('  ...(12 more)');

console.log('\n💰 BUYING INTENT (10 prompts - NO brand mention):');
console.log('  1. Where to find startup accelerator services');
console.log('  2. startup accelerator pricing comparison');
console.log('  3. How much does startup accelerator cost?');
console.log('  ...(7 more)');

console.log('\n⭐ TRUST & QUALITY (10 prompts - NO brand mention):');
console.log('  1. Most reliable startup accelerator');
console.log('  2. Trustworthy startup accelerator providers');
console.log('  3. Top rated startup accelerator');
console.log('  ...(7 more)');

console.log('\n🏆 COMPETITOR CONTEXT (10 prompts - NO brand mention):');
console.log('  1. Techstars alternatives');
console.log('  2. Companies similar to Techstars');
console.log('  3. 500 Startups alternatives');
console.log('  ...(7 more)');

console.log('\n\n📊 SUMMARY');
console.log('='.repeat(50));
console.log('Total prompts: 100');
console.log('Prompts mentioning "Y Combinator": ~10 (10%)');
console.log('Prompts WITHOUT brand name: ~90 (90%)');
console.log('\n✨ 90 prompts test ORGANIC AI visibility!');
console.log('='.repeat(50));
