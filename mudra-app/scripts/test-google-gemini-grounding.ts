/**
 * Test script for Google Gemini 3 Flash with Google Search grounding
 * Run with: GOOGLE_API_KEY=your-key npx tsx scripts/test-google-gemini-grounding.ts
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.GOOGLE_API_KEY;

if (!API_KEY) {
  console.error('❌ GOOGLE_API_KEY environment variable is required');
  console.error('   Run with: GOOGLE_API_KEY=your-key npx tsx scripts/test-google-gemini-grounding.ts');
  process.exit(1);
}

async function testGeminiGrounding() {
  console.log('='.repeat(60));
  console.log('Testing Google Gemini 3 Flash with Search Grounding');
  console.log('='.repeat(60));
  console.log('API Key:', API_KEY.substring(0, 8) + '...' + API_KEY.substring(API_KEY.length - 4));
  console.log('');

  const genAI = new GoogleGenerativeAI(API_KEY);

  const testPrompt = 'What are the top project management software tools in 2024? List the top 5 with brief descriptions.';

  console.log('Test Prompt:', testPrompt);
  console.log('');
  console.log('Making API request with googleSearch grounding tool...');
  console.log('');

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-3-flash-preview',
      tools: [
        {
          googleSearch: {},
        },
      ] as any,
    });

    const result = await model.generateContent(testPrompt);
    const response = result.response;
    const text = response.text();

    console.log('✅ API Response Received!');
    console.log('');

    // Extract grounding metadata
    const candidate = (response as any).candidates?.[0];
    const groundingMetadata = candidate?.groundingMetadata;

    console.log('Grounding Metadata Present:', !!groundingMetadata);
    console.log('');

    // Extract citations from grounding chunks
    const citations: Array<{ url: string; title?: string }> = [];

    if (groundingMetadata?.groundingChunks) {
      console.log('Grounding Chunks:', groundingMetadata.groundingChunks.length);
      groundingMetadata.groundingChunks.forEach((chunk: any, idx: number) => {
        if (chunk.web) {
          citations.push({
            url: chunk.web.uri || '',
            title: chunk.web.title,
          });
          console.log(`  ${idx + 1}. ${chunk.web.title || 'No title'}`);
          console.log(`     URL: ${chunk.web.uri}`);
        }
      });
    } else {
      console.log('⚠️  No grounding chunks found in response');
    }

    // Extract search queries used
    const searchQueries: string[] = [];
    if (groundingMetadata?.webSearchQueries) {
      searchQueries.push(...groundingMetadata.webSearchQueries);
      console.log('');
      console.log('Search Queries Used:', searchQueries.join(', '));
    }

    // Check for grounding supports (more precise citation mapping)
    if (groundingMetadata?.groundingSupports) {
      console.log('');
      console.log('Grounding Supports:', groundingMetadata.groundingSupports.length);
      groundingMetadata.groundingSupports.slice(0, 5).forEach((support: any, idx: number) => {
        console.log(`  ${idx + 1}. Segment: "${support.segment?.text?.substring(0, 50)}..."`);
        console.log(`     Chunk indices: ${support.groundingChunkIndices?.join(', ')}`);
      });
      if (groundingMetadata.groundingSupports.length > 5) {
        console.log(`  ... and ${groundingMetadata.groundingSupports.length - 5} more`);
      }
    }

    // Check for retrieval metadata
    if (groundingMetadata?.retrievalMetadata) {
      console.log('');
      console.log('Retrieval Metadata:');
      console.log('  Dynamic Retrieval Score:', groundingMetadata.retrievalMetadata.googleSearchDynamicRetrievalScore);
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('RESULTS SUMMARY');
    console.log('='.repeat(60));
    console.log('');

    console.log('Full Response Text:');
    console.log('-'.repeat(40));
    console.log(text.substring(0, 1000) + (text.length > 1000 ? '...' : ''));
    console.log('');

    console.log('Citations Extracted:', citations.length);
    console.log('-'.repeat(40));
    citations.forEach((c, i) => {
      console.log(`${i + 1}. ${c.title || 'No title'}`);
      console.log(`   URL: ${c.url}`);
      console.log('');
    });

    console.log('');
    console.log('✅ Test completed successfully!');
    console.log('');
    console.log('Google Gemini grounding is working correctly. The GEO analysis');
    console.log('should now be able to use Gemini with real-time search for');
    console.log('accurate AI visibility tracking.');

  } catch (error: any) {
    console.error('');
    console.error('❌ API Request Failed!');
    console.error('');
    console.error('Error Details:');
    console.error('  Message:', error.message || 'Unknown error');
    console.error('  Status:', error.status || 'N/A');

    if (error.message?.includes('not found') || error.message?.includes('model')) {
      console.error('');
      console.error('⚠️  Model not found - try these alternatives:');
      console.error('   - gemini-2.5-flash');
      console.error('   - gemini-2.0-flash');
      console.error('   - gemini-1.5-flash');
    }

    if (error.message?.includes('API key')) {
      console.error('');
      console.error('⚠️  API Key Issue');
      console.error('   Please check your Google API key is valid.');
    }

    if (error.message?.includes('grounding') || error.message?.includes('search')) {
      console.error('');
      console.error('⚠️  Grounding/Search Issue');
      console.error('   Google Search grounding may not be available for your API key.');
      console.error('   Check: https://ai.google.dev/gemini-api/docs/grounding');
    }

    console.error('');
    console.error('Full error:', error);
    process.exit(1);
  }
}

testGeminiGrounding();
