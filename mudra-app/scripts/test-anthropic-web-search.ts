/**
 * Test script for Anthropic web_search tool
 * Run with: npx tsx scripts/test-anthropic-web-search.ts
 */

import Anthropic from '@anthropic-ai/sdk';

const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY environment variable is required');
  console.error('   Run with: ANTHROPIC_API_KEY=your-key npx tsx scripts/test-anthropic-web-search.ts');
  process.exit(1);
}

async function testWebSearch() {
  console.log('='.repeat(60));
  console.log('Testing Anthropic Web Search Tool');
  console.log('='.repeat(60));
  console.log('API Key:', API_KEY.substring(0, 15) + '...' + API_KEY.substring(API_KEY.length - 4));
  console.log('');

  const anthropic = new Anthropic({
    apiKey: API_KEY,
  });

  const testPrompt = 'What are the top project management software tools in 2024? List the top 5 with brief descriptions.';

  console.log('Test Prompt:', testPrompt);
  console.log('');
  console.log('Making API request with web_search_20250305 tool...');
  console.log('');

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: testPrompt,
        },
      ],
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 5,
        } as any,
      ],
    });

    console.log('✅ API Response Received!');
    console.log('');
    console.log('Stop Reason:', response.stop_reason);
    console.log('Usage:', JSON.stringify(response.usage, null, 2));
    console.log('');

    // Process response content
    let fullText = '';
    const citations: Array<{ url: string; title?: string; snippet?: string }> = [];
    let searchQueries: string[] = [];

    console.log('Content Blocks:');
    console.log('-'.repeat(40));

    for (const block of response.content) {
      console.log(`  Block Type: ${block.type}`);

      if (block.type === 'text') {
        fullText += block.text;

        // Extract citations from text blocks
        const textBlock = block as any;
        if (textBlock.citations && Array.isArray(textBlock.citations)) {
          console.log(`    Citations found: ${textBlock.citations.length}`);
          for (const citation of textBlock.citations) {
            if (citation.type === 'web_search_result_location') {
              citations.push({
                url: citation.url || '',
                title: citation.title,
                snippet: citation.cited_text,
              });
            }
          }
        }
      }

      if (block.type === 'server_tool_use') {
        const toolBlock = block as any;
        console.log(`    Tool: ${toolBlock.name}`);
        console.log(`    Query: ${toolBlock.input?.query || 'N/A'}`);
        if (toolBlock.input?.query) {
          searchQueries.push(toolBlock.input.query);
        }
      }

      if (block.type === 'web_search_tool_result') {
        const resultBlock = block as any;
        if (resultBlock.content && Array.isArray(resultBlock.content)) {
          console.log(`    Search Results: ${resultBlock.content.length}`);
          for (const result of resultBlock.content) {
            if (result.type === 'web_search_result') {
              console.log(`      - ${result.title || 'No title'}`);
              console.log(`        URL: ${result.url}`);
              // Add to citations if not already present
              const existingUrls = citations.map(c => c.url);
              if (!existingUrls.includes(result.url)) {
                citations.push({
                  url: result.url,
                  title: result.title,
                });
              }
            }
            if (result.type === 'web_search_tool_result_error') {
              console.log(`      ❌ Error: ${result.error_code}`);
            }
          }
        }
      }
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('RESULTS SUMMARY');
    console.log('='.repeat(60));
    console.log('');

    console.log('Search Queries Used:', searchQueries.length > 0 ? searchQueries.join(', ') : 'None');
    console.log('');

    console.log('Full Response Text:');
    console.log('-'.repeat(40));
    console.log(fullText.substring(0, 1000) + (fullText.length > 1000 ? '...' : ''));
    console.log('');

    console.log('Citations Extracted:', citations.length);
    console.log('-'.repeat(40));
    citations.forEach((c, i) => {
      console.log(`${i + 1}. ${c.title || 'No title'}`);
      console.log(`   URL: ${c.url}`);
      if (c.snippet) {
        console.log(`   Snippet: ${c.snippet.substring(0, 100)}...`);
      }
      console.log('');
    });

    console.log('');
    console.log('✅ Test completed successfully!');
    console.log('');
    console.log('Web search is working correctly. The GEO analysis should now');
    console.log('be able to use Claude with real-time web search for accurate');
    console.log('AI visibility tracking.');

  } catch (error: any) {
    console.error('');
    console.error('❌ API Request Failed!');
    console.error('');
    console.error('Error Details:');
    console.error('  Message:', error.message || 'Unknown error');
    console.error('  Status:', error.status || 'N/A');
    console.error('  Type:', error.type || error.error?.type || 'N/A');

    if (error.status === 405) {
      console.error('');
      console.error('⚠️  HTTP 405 - Method Not Allowed');
      console.error('   This may indicate the web_search tool format is incorrect.');
    }

    if (error.status === 400) {
      console.error('');
      console.error('⚠️  HTTP 400 - Bad Request');
      console.error('   Possible causes:');
      console.error('   1. Web search not enabled in Anthropic Console');
      console.error('   2. Invalid tool configuration');
      console.error('   3. API key lacks web search permissions');
    }

    if (error.status === 401) {
      console.error('');
      console.error('⚠️  HTTP 401 - Unauthorized');
      console.error('   Please check your API key is valid.');
    }

    console.error('');
    console.error('Full error:', JSON.stringify(error, null, 2));
    process.exit(1);
  }
}

testWebSearch();
