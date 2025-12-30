/**
 * Test Script for Conversation Radar - Phase 1: Foundation
 * 
 * Tests:
 * 1. Database schema - ConversationOpportunity table exists
 * 2. Apify client initialization
 * 3. Reddit scraper (search mode)
 * 4. Reddit scraper (URL mode)
 * 5. LinkedIn scraper (search mode only)
 * 
 * Run: npx tsx scripts/test-conversation-radar-phase1.ts
 */

// Load environment variables from .env.local
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { PrismaClient } from '@prisma/client';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') {
  const prefix = {
    info: `${colors.cyan}[INFO]${colors.reset}`,
    success: `${colors.green}[✓]${colors.reset}`,
    error: `${colors.red}[✗]${colors.reset}`,
    warn: `${colors.yellow}[⚠]${colors.reset}`,
  };
  console.log(`${prefix[type]} ${message}`);
}

function logSection(title: string) {
  console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.cyan}  ${title}${colors.reset}`);
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
}

async function testDatabase() {
  logSection('Test 1: Database Schema');
  
  const prisma = new PrismaClient();
  
  try {
    // Check if ConversationOpportunity table exists by querying it
    const count = await prisma.conversationOpportunity.count();
    log(`ConversationOpportunity table exists with ${count} records`, 'success');
    
    // Check if we can create a test record (then delete it)
    log('Testing create/delete operations...', 'info');
    
    // First, get or create a test brand profile
    let testBrand = await prisma.brandProfile.findFirst({
      where: { companyName: 'Test Company for Conversation Radar' },
    });
    
    if (!testBrand) {
      testBrand = await prisma.brandProfile.create({
        data: {
          companyName: 'Test Company for Conversation Radar',
          companyDescription: 'Test description',
        },
      });
      log(`Created test brand profile (ID: ${testBrand.id})`, 'info');
    }
    
    // Create a test opportunity
    const testOpportunity = await prisma.conversationOpportunity.create({
      data: {
        brandProfileId: testBrand.id,
        postUrl: 'https://www.reddit.com/r/test/comments/test123/test_post',
        platform: 'reddit',
        mode: 'cited',
        discoveredVia: [{ test: true }],
        postTitle: 'Test Post',
        score: 100,
        numComments: 50,
        engagementString: '100 upvotes · 50 comments',
      },
    });
    log(`Created test opportunity (ID: ${testOpportunity.id})`, 'success');
    
    // Delete the test opportunity
    await prisma.conversationOpportunity.delete({
      where: { id: testOpportunity.id },
    });
    log('Deleted test opportunity', 'success');
    
    log('Database schema test PASSED', 'success');
    return true;
  } catch (error) {
    log(`Database test FAILED: ${error}`, 'error');
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

async function testApifyClient() {
  logSection('Test 2: Apify Client');
  
  try {
    // Check if APIFY_API_KEY is set
    const apiKey = process.env.APIFY_API_KEY;
    
    if (!apiKey) {
      log('APIFY_API_KEY is NOT set in environment', 'error');
      log('Please add APIFY_API_KEY to your .env.local file:', 'warn');
      log('  APIFY_API_KEY=apify_api_YOUR_KEY_HERE', 'info');
      return false;
    }
    
    log(`APIFY_API_KEY is set (${apiKey.slice(0, 15)}...)`, 'success');
    
    // Import and test client
    const { getApifyClient } = await import('../lib/apify/client');
    const client = getApifyClient();
    
    if (client) {
      log('Apify client initialized successfully', 'success');
      return true;
    } else {
      log('Apify client initialization returned null', 'error');
      return false;
    }
  } catch (error) {
    log(`Apify client test FAILED: ${error}`, 'error');
    return false;
  }
}

async function testRedditSearch() {
  logSection('Test 3: Reddit Search (Mode 2 - Proactive)');
  
  try {
    const { searchReddit } = await import('../lib/apify/reddit-scraper');
    
    log('Searching Reddit for "AI visibility SEO tools"...', 'info');
    
    const result = await searchReddit({
      queries: ['AI visibility SEO tools'],
      sort: 'hot',
      timeframe: 'week',
      maxPosts: 10, // Minimum required by Apify actor
    });
    
    if (result.success) {
      log(`Search successful! Found ${result.posts.length} posts`, 'success');
      
      // Display sample post
      if (result.posts.length > 0) {
        const post = result.posts[0];
        console.log(`\n${colors.dim}Sample post:${colors.reset}`);
        console.log(`  Title: ${post.title?.slice(0, 60)}...`);
        console.log(`  Subreddit: r/${post.subreddit}`);
        console.log(`  Score: ${post.score} | Comments: ${post.num_comments}`);
        console.log(`  URL: ${post.url}`);
      }
      
      return true;
    } else {
      log(`Reddit search failed: ${result.error}`, 'error');
      return false;
    }
  } catch (error) {
    log(`Reddit search test FAILED: ${error}`, 'error');
    return false;
  }
}

async function testRedditUrlScrape() {
  logSection('Test 4: Reddit URL Scrape (Mode 1 - Cited)');
  
  try {
    const { scrapeRedditUrls } = await import('../lib/apify/reddit-scraper');
    
    // Use a relevant subreddit for GEO/SEO
    const testUrl = 'https://www.reddit.com/r/SEO/';
    
    log(`Scraping Reddit URL: ${testUrl}`, 'info');
    
    const result = await scrapeRedditUrls([testUrl], false);
    
    if (result.success) {
      log(`Scrape successful! Found ${result.posts.length} posts`, 'success');
      
      if (result.posts.length > 0) {
        const post = result.posts[0];
        console.log(`\n${colors.dim}Sample scraped post:${colors.reset}`);
        console.log(`  Title: ${post.title?.slice(0, 60)}...`);
        console.log(`  Author: u/${post.author}`);
        console.log(`  Score: ${post.score}`);
      }
      
      return true;
    } else {
      log(`Reddit URL scrape failed: ${result.error}`, 'error');
      return false;
    }
  } catch (error) {
    log(`Reddit URL scrape test FAILED: ${error}`, 'error');
    return false;
  }
}

async function testLinkedInSearch() {
  logSection('Test 5: LinkedIn Search (Mode 2 - Proactive Only)');
  
  try {
    const { searchLinkedIn } = await import('../lib/apify/linkedin-scraper');
    
    log('Searching LinkedIn for "GEO optimization AI search"...', 'info');
    log('Note: LinkedIn only supports keyword search, not URL scraping', 'warn');
    
    const result = await searchLinkedIn({
      keyword: 'GEO optimization AI search',
      sortBy: 'date_posted',
      limit: 5,
    });
    
    if (result.success) {
      log(`Search successful! Found ${result.posts.length} posts`, 'success');
      
      if (result.posts.length > 0) {
        const post = result.posts[0];
        console.log(`\n${colors.dim}Sample LinkedIn post:${colors.reset}`);
        console.log(`  Author: ${post.author?.name}`);
        console.log(`  Text: ${post.text?.slice(0, 80)}...`);
        console.log(`  Likes: ${post.numLikes} | Comments: ${post.numComments}`);
        console.log(`  Posted: ${post.postedAt}`);
      }
      
      return true;
    } else {
      log(`LinkedIn search failed: ${result.error}`, 'error');
      return false;
    }
  } catch (error) {
    log(`LinkedIn search test FAILED: ${error}`, 'error');
    return false;
  }
}

async function main() {
  console.log('\n');
  console.log(`${colors.cyan}╔══════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║   CONVERSATION RADAR - PHASE 1 TEST SUITE                ║${colors.reset}`);
  console.log(`${colors.cyan}╚══════════════════════════════════════════════════════════╝${colors.reset}`);
  
  const results: Record<string, boolean> = {};
  
  // Test 1: Database
  results['Database Schema'] = await testDatabase();
  
  // Test 2: Apify Client
  results['Apify Client'] = await testApifyClient();
  
  // Only run Apify tests if client works
  if (results['Apify Client']) {
    // Test 3: Reddit Search
    results['Reddit Search'] = await testRedditSearch();
    
    // Test 4: Reddit URL Scrape
    results['Reddit URL Scrape'] = await testRedditUrlScrape();
    
    // Test 5: LinkedIn Search
    results['LinkedIn Search'] = await testLinkedInSearch();
  } else {
    log('Skipping Apify tests - client not configured', 'warn');
    results['Reddit Search'] = false;
    results['Reddit URL Scrape'] = false;
    results['LinkedIn Search'] = false;
  }
  
  // Summary
  logSection('TEST SUMMARY');
  
  let passed = 0;
  let failed = 0;
  
  for (const [test, success] of Object.entries(results)) {
    if (success) {
      log(`${test}: PASSED`, 'success');
      passed++;
    } else {
      log(`${test}: FAILED`, 'error');
      failed++;
    }
  }
  
  console.log(`\n${colors.dim}${'─'.repeat(40)}${colors.reset}`);
  console.log(`Total: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log(`\n${colors.green}✅ Phase 1 Foundation is COMPLETE!${colors.reset}`);
    console.log(`${colors.dim}You can now proceed to Phase 2: Mode 1 - Cited Radar${colors.reset}\n`);
  } else {
    console.log(`\n${colors.yellow}⚠️  Some tests failed. Please fix issues before proceeding.${colors.reset}\n`);
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);

