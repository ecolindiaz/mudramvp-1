/**
 * AEO/GEO Optimizer Agent Test Suite
 * 
 * Tests the AEO/GEO Optimizer agent with real-world scenarios
 * Uses E2B sandboxes for secure code execution
 */

import { aeoGeoOptimizerAgent } from '../agents/aeo-geo-optimizer';

async function testCodebaseAnalysis() {
  console.log('\n🧪 TEST 1: Codebase Analysis');
  console.log('=' .repeat(60));
  
  const sampleHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>React Hooks Guide - Best Practices 2024</title>
  <meta name="description" content="Learn React Hooks">
</head>
<body>
  <h1>React Hooks Guide</h1>
  
  <h2>Understanding useState</h2>
  <p>The useState hook allows you to add state to functional components...</p>
  
  <h2>useEffect Hook</h2>
  <p>useEffect lets you perform side effects in functional components...</p>
  
  <ul>
    <li>Run code after render</li>
    <li>Clean up resources</li>
    <li>Fetch data</li>
  </ul>
  
  <h2>Common Mistakes</h2>
  <p>Here are some common pitfalls when using hooks...</p>
</body>
</html>
  `;
  
  try {
    const response = await aeoGeoOptimizerAgent.generate([
      {
        role: 'user',
        content: `Analyze this HTML for AEO/GEO optimization opportunities:\n\n${sampleHtml}`,
      },
    ]);
    
    console.log('\n✅ Analysis Result:');
    console.log(response.text);
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

async function testSchemaGeneration() {
  console.log('\n🧪 TEST 2: FAQ Schema Generation');
  console.log('=' .repeat(60));
  
  try {
    const response = await aeoGeoOptimizerAgent.generate([
      {
        role: 'user',
        content: `Generate FAQ schema for these React Hooks questions:
        
1. What is useState in React?
   Answer: useState is a Hook that lets you add state to functional components. It returns an array with the current state value and a function to update it.

2. How does useEffect work?
   Answer: useEffect lets you perform side effects in functional components. It runs after every render by default and can be used for data fetching, subscriptions, or manually changing the DOM.

3. When should I use useCallback?
   Answer: Use useCallback to memoize functions and prevent unnecessary re-renders. It's especially useful when passing callbacks to optimized child components that rely on reference equality.`,
      },
    ]);
    
    console.log('\n✅ Schema Generation Result:');
    console.log(response.text);
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

async function testAeoScoring() {
  console.log('\n🧪 TEST 3: AEO Score Calculation');
  console.log('=' .repeat(60));
  
  try {
    const response = await aeoGeoOptimizerAgent.generate([
      {
        role: 'user',
        content: `Calculate AEO score for a page with these characteristics:
- No schema markup (0/20)
- 3 question-based headers (10/15)
- No FAQ section (0/15)  
- 5 bulleted lists, 1 table (18/20)
- 2 citations with statistics (6/10)
- Meta description present, 140 chars (8/10)
- Author bio with credentials (9/10)

Provide the full breakdown with recommendations.`,
      },
    ]);
    
    console.log('\n✅ Scoring Result:');
    console.log(response.text);
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

async function testEndToEndOptimization() {
  console.log('\n🧪 TEST 4: End-to-End Optimization Workflow');
  console.log('=' .repeat(60));
  
  try {
    const response = await aeoGeoOptimizerAgent.generate([
      {
        role: 'user',
        content: `I have a blog post about "Next.js Server Components" that's getting zero AI citations. 
        
Current state:
- 2,500 words
- 5 H2 headers (not question-based)
- Code examples
- No schema markup
- No FAQ section
- Updated 3 months ago

Help me optimize it for maximum AI visibility. Provide a step-by-step action plan.`,
      },
    ]);
    
    console.log('\n✅ Optimization Plan:');
    console.log(response.text);
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run all tests
async function runAllTests() {
  console.log('\n🚀 Starting AEO/GEO Optimizer Agent Tests');
  console.log('='  .repeat(60));
  
  await testCodebaseAnalysis();
  await testSchemaGeneration();
  await testAeoScoring();
  await testEndToEndOptimization();
  
  console.log('\n✅ All tests completed!');
  console.log('=' .repeat(60));
}

// Execute tests
runAllTests().catch(console.error);
