/**
 * Unit Test: Topic Detection for Query Generator
 * 
 * Tests the subreddit detection logic without needing Apify API calls.
 * 
 * Run: npx tsx scripts/test-topic-detection.ts
 */

import { generateSearchQueries, type BrandContext } from '../lib/conversation-radar/query-generator';

const c = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

// Test cases covering various industries
const TEST_CASES: Array<{
  name: string;
  prompt: string;
  brandContext?: Partial<BrandContext>;
  expectedSubreddits: string[];  // At least some of these should appear
}> = [
  // AI/ML
  {
    name: 'Data Labeling (AI/ML)',
    prompt: 'Best data labeling platforms for machine learning',
    expectedSubreddits: ['MachineLearning', 'datascience', 'MLQuestions'],
  },
  {
    name: 'LLM Tools',
    prompt: 'What are the best LLM frameworks for production',
    expectedSubreddits: ['LocalLLaMA', 'MachineLearning', 'ChatGPT'],
  },
  
  // Fintech
  {
    name: 'Payment Processing',
    prompt: 'Best payment processing for SaaS subscriptions',
    expectedSubreddits: ['fintech', 'SaaS', 'Entrepreneur'],
  },
  {
    name: 'Accounting Software',
    prompt: 'Invoicing and accounting software for small business',
    expectedSubreddits: ['Accounting', 'smallbusiness', 'Entrepreneur'],
  },
  
  // Logistics
  {
    name: 'Supply Chain',
    prompt: 'Supply chain management software for e-commerce',
    expectedSubreddits: ['supplychain', 'logistics', 'ecommerce'],
  },
  {
    name: 'Warehouse Management',
    prompt: 'Best warehouse inventory management system',
    expectedSubreddits: ['supplychain', 'ecommerce', 'smallbusiness'],
  },
  
  // DevTools
  {
    name: 'API Development',
    prompt: 'Best API development tools for REST APIs',
    expectedSubreddits: ['programming', 'webdev'],
  },
  {
    name: 'DevOps/CI-CD',
    prompt: 'CI/CD pipeline tools for Kubernetes',
    expectedSubreddits: ['devops', 'kubernetes', 'programming'],
  },
  
  // B2B/Enterprise
  {
    name: 'CRM Solutions',
    prompt: 'Best CRM alternative to Salesforce',
    expectedSubreddits: ['sales', 'salesforce', 'SaaS'],
  },
  {
    name: 'Enterprise Software',
    prompt: 'Enterprise resource planning for manufacturing',
    expectedSubreddits: ['ERP', 'sysadmin', 'smallbusiness'],
  },
  
  // Marketing
  {
    name: 'SEO Tools',
    prompt: 'Best SEO tools for ranking in Google',
    expectedSubreddits: ['SEO', 'bigseo', 'marketing'],
  },
  {
    name: 'Email Marketing',
    prompt: 'Email marketing automation platform',
    expectedSubreddits: ['Emailmarketing', 'marketing', 'Entrepreneur'],
  },
  
  // E-commerce
  {
    name: 'Shopify Apps',
    prompt: 'Best Shopify apps for dropshipping',
    expectedSubreddits: ['shopify', 'dropshipping', 'ecommerce'],
  },
  {
    name: 'Amazon FBA',
    prompt: 'Amazon FBA inventory management tools',
    expectedSubreddits: ['FulfillmentByAmazon', 'AmazonSeller', 'ecommerce'],
  },
  
  // HR/Recruiting
  {
    name: 'Recruiting Tools',
    prompt: 'Best ATS for small recruiting team',
    expectedSubreddits: ['recruiting', 'humanresources'],
  },
  {
    name: 'Payroll Software',
    prompt: 'Payroll and benefits administration software',
    expectedSubreddits: ['humanresources', 'smallbusiness', 'Accounting'],
  },
  
  // Healthcare
  {
    name: 'Telehealth',
    prompt: 'Telehealth platform for mental health providers',
    expectedSubreddits: ['healthIT', 'medicine', 'healthcare'],
  },
  
  // Real Estate
  {
    name: 'Property Management',
    prompt: 'Property management software for landlords',
    expectedSubreddits: ['Landlord', 'PropertyManagement', 'realestateinvesting'],
  },
  
  // Security
  {
    name: 'Cybersecurity',
    prompt: 'Best cybersecurity tools for small business',
    expectedSubreddits: ['cybersecurity', 'netsec', 'sysadmin'],
  },
  
  // Design
  {
    name: 'UI/UX Design',
    prompt: 'Best UI design tools for product teams',
    expectedSubreddits: ['userexperience', 'UI_Design', 'design'],
  },
  
  // Generic (should use defaults or partial matches)
  {
    name: 'Generic Software Question',
    prompt: 'Best software for small business',
    expectedSubreddits: ['SaaS', 'startups', 'smallbusiness', 'Entrepreneur'],
  },
  
  // Short keyword test (word boundary)
  {
    name: 'API (Short Keyword - Word Boundary)',
    prompt: 'Need a good API for data integration',
    expectedSubreddits: ['programming', 'webdev'],
  },
  
  // False positive test - "api" in "capital" should NOT match API
  {
    name: 'Capital (Should NOT Match API)',
    prompt: 'How to raise capital for startup',
    expectedSubreddits: ['startups', 'Entrepreneur'],  // Should NOT include programming/webdev
  },
];

function main() {
  console.log(`\n${c.cyan}${'═'.repeat(75)}${c.reset}`);
  console.log(`${c.cyan}${c.bold}  TOPIC DETECTION TEST${c.reset}`);
  console.log(`${c.cyan}${'═'.repeat(75)}${c.reset}\n`);
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of TEST_CASES) {
    const brandContext: BrandContext = {
      companyName: 'TestCo',
      trackedPrompts: [testCase.prompt],
      competitors: [],
      ...(testCase.brandContext || {}),
    };
    
    // Suppress console.log from generateSearchQueries
    const originalLog = console.log;
    console.log = () => {};
    
    const result = generateSearchQueries(brandContext);
    
    console.log = originalLog;
    
    const query = result.trackedPromptQueries[0];
    if (!query) {
      console.log(`${c.red}✗${c.reset} ${c.bold}${testCase.name}${c.reset}`);
      console.log(`  ${c.dim}Prompt: "${testCase.prompt}"${c.reset}`);
      console.log(`  ${c.red}ERROR: No query generated${c.reset}\n`);
      failed++;
      continue;
    }
    
    // Check if expected subreddits are in the result
    const foundExpected = testCase.expectedSubreddits.filter(
      expected => query.subreddits.includes(expected)
    );
    
    const success = foundExpected.length >= Math.min(2, testCase.expectedSubreddits.length);
    
    if (success) {
      console.log(`${c.green}✓${c.reset} ${c.bold}${testCase.name}${c.reset}`);
      console.log(`  ${c.dim}Prompt: "${testCase.prompt.slice(0, 50)}..."${c.reset}`);
      console.log(`  ${c.green}Detected: r/${query.subreddits.join(', r/')}${c.reset}`);
      passed++;
    } else {
      console.log(`${c.red}✗${c.reset} ${c.bold}${testCase.name}${c.reset}`);
      console.log(`  ${c.dim}Prompt: "${testCase.prompt}"${c.reset}`);
      console.log(`  ${c.yellow}Expected: r/${testCase.expectedSubreddits.join(', r/')}${c.reset}`);
      console.log(`  ${c.red}Got: r/${query.subreddits.join(', r/')}${c.reset}`);
      failed++;
    }
    console.log('');
  }
  
  // Summary
  console.log(`${c.cyan}${'═'.repeat(75)}${c.reset}`);
  console.log(`${c.bold}SUMMARY:${c.reset}`);
  console.log(`  ${c.green}Passed: ${passed}/${TEST_CASES.length}${c.reset}`);
  if (failed > 0) {
    console.log(`  ${c.red}Failed: ${failed}/${TEST_CASES.length}${c.reset}`);
  }
  console.log(`${c.cyan}${'═'.repeat(75)}${c.reset}\n`);
  
  // Exit with error code if any failed
  process.exit(failed > 0 ? 1 : 0);
}

main();
