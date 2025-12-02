/**
 * Growth Opportunity Scout Agent Test Suite
 * 
 * Tests the Growth Scout agent with competitive intelligence and outreach scenarios
 * Uses E2B sandboxes for secure code execution
 */

import { growthScoutAgent } from '../agents/growth-scout';

async function testCitationSearch() {
  console.log('\n🧪 TEST 1: AI Citation Search');
  console.log('='.repeat(60));
  
  try {
    const response = await growthScoutAgent.generate([
      {
        role: 'user',
        content: `Find which websites and authors are most frequently cited by AI systems for the topic "TypeScript best practices". 
        
I want to understand:
- Who dominates this space
- What content formats work best
- Which AI systems cite them most
- Key patterns I should replicate`,
      },
    ]);
    
    console.log('\n✅ Citation Search Result:');
    console.log(response.text);
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

async function testRedditMonitoring() {
  console.log('\n🧪 TEST 2: Reddit Thread Monitoring');
  console.log('='.repeat(60));
  
  try {
    const response = await growthScoutAgent.generate([
      {
        role: 'user',
        content: `Monitor Reddit for outreach opportunities related to "React performance optimization".
        
Focus on:
- r/reactjs
- r/webdev
- r/javascript

Show me threads with:
- High engagement (100+ upvotes)
- Being cited by AI systems
- Where I can add expert value

Include timing and approach recommendations.`,
      },
    ]);
    
    console.log('\n✅ Reddit Monitoring Result:');
    console.log(response.text);
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

async function testCompetitorAnalysis() {
  console.log('\n🧪 TEST 3: Competitor Citation Analysis');
  console.log('='.repeat(60));
  
  try {
    const response = await growthScoutAgent.generate([
      {
        role: 'user',
        content: `Analyze these competitors for "Next.js tutorials":

1. https://nextjs.org/docs
2. https://vercel.com/guides
3. https://blog.logrocket.com

I need to know:
- Why AI systems cite them
- Their content strategies
- Weaknesses I can exploit
- Content gaps I should fill
- Specific tactics to beat them

Topic context: Next.js App Router and Server Components`,
      },
    ]);
    
    console.log('\n✅ Competitor Analysis Result:');
    console.log(response.text);
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

async function testMultiToolWorkflow() {
  console.log('\n🧪 TEST 4: Multi-Tool Growth Strategy');
  console.log('='.repeat(60));
  
  try {
    const response = await growthScoutAgent.generate([
      {
        role: 'user',
        content: `I'm launching a blog about "Web performance optimization" and want maximum AI visibility.
        
My competitors:
- web.dev
- developer.chrome.com
- webpagetest.org

Help me build a comprehensive growth strategy:
1. Find who AI cites most in this space
2. Analyze top 3 competitors
3. Find Reddit communities for outreach
4. Identify content gaps I can exploit
5. Create a 30-day action plan

I have:
- Strong technical expertise
- Can write 2-3 posts per week
- Budget for tools/software
- Time for community engagement`,
      },
    ]);
    
    console.log('\n✅ Growth Strategy Result:');
    console.log(response.text);
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

async function testTrendingTopicsDiscovery() {
  console.log('\n🧪 TEST 5: Trending Topics Discovery');
  console.log('='.repeat(60));
  
  try {
    const response = await growthScoutAgent.generate([
      {
        role: 'user',
        content: `What are the trending topics in web development that:
- AI systems are actively citing
- Have high Reddit engagement
- Low competitor saturation
- Good search volume

Focus on:
- JavaScript frameworks
- Developer tools  
- Performance topics
- Architecture patterns

Show me the top 5 opportunities with difficulty ratings and estimated traffic potential.`,
      },
    ]);
    
    console.log('\n✅ Trending Topics Result:');
    console.log(response.text);
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

async function testOutreachTiming() {
  console.log('\n🧪 TEST 6: Optimal Outreach Timing');
  console.log('='.repeat(60));
  
  try {
    const response = await growthScoutAgent.generate([
      {
        role: 'user',
        content: `I found a high-engagement Reddit thread about "State management in React" with 350 upvotes and 120 comments.

Thread details:
- Posted 6 hours ago
- r/reactjs community
- Question: "Redux vs Zustand vs Jotai in 2024?"
- Top answer has 45 upvotes but is incomplete
- Several follow-up questions unanswered
- Cited by ChatGPT and Perplexity

Should I engage now? What's my approach? What value can I add?`,
      },
    ]);
    
    console.log('\n✅ Outreach Strategy Result:');
    console.log(response.text);
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run all tests
async function runAllTests() {
  console.log('\n🚀 Starting Growth Opportunity Scout Agent Tests');
  console.log('='.repeat(60));
  
  await testCitationSearch();
  await testRedditMonitoring();
  await testCompetitorAnalysis();
  await testMultiToolWorkflow();
  await testTrendingTopicsDiscovery();
  await testOutreachTiming();
  
  console.log('\n✅ All tests completed!');
  console.log('='.repeat(60));
}

// Execute tests
runAllTests().catch(console.error);
