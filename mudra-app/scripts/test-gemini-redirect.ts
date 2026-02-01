/**
 * Test script to verify Gemini grounding redirect URL resolution
 * Run with: npx tsx scripts/test-gemini-redirect.ts
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

if (!GOOGLE_API_KEY) {
  console.error('❌ No Google/Gemini API key found in .env.local');
  console.error('   Set GOOGLE_API_KEY or GEMINI_API_KEY');
  process.exit(1);
}

interface Citation {
  title?: string;
  url: string;
  position?: number;
}

/**
 * Resolves a Gemini grounding redirect URL to get the actual source URL.
 */
async function resolveGeminiGroundingUrl(
  redirectUrl: string,
  originalTitle?: string
): Promise<{ url: string; title: string; wasRedirect: boolean }> {
  const isRedirect = redirectUrl.includes('vertexaisearch.cloud.google.com/grounding-api-redirect');

  if (!isRedirect) {
    return { url: redirectUrl, title: originalTitle || '', wasRedirect: false };
  }

  try {
    // Try HEAD request first (faster)
    const response = await fetch(redirectUrl, {
      method: 'HEAD',
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MudraBot/1.0)',
      },
      signal: AbortSignal.timeout(5000),
    });

    const location = response.headers.get('location');
    if (location && location !== redirectUrl) {
      let resolvedTitle = originalTitle || '';
      try {
        const urlObj = new URL(location);
        if (!resolvedTitle || resolvedTitle.length < 5) {
          resolvedTitle = urlObj.hostname;
        }
      } catch {}
      return { url: location, title: resolvedTitle, wasRedirect: true };
    }

    // Fallback: follow redirect chain
    const followResponse = await fetch(redirectUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MudraBot/1.0)',
      },
      signal: AbortSignal.timeout(8000),
    });

    const finalUrl = followResponse.url;
    if (finalUrl && finalUrl !== redirectUrl) {
      let resolvedTitle = originalTitle || '';
      try {
        const urlObj = new URL(finalUrl);
        if (!resolvedTitle || resolvedTitle.length < 5) {
          resolvedTitle = urlObj.hostname;
        }
      } catch {}
      return { url: finalUrl, title: resolvedTitle, wasRedirect: true };
    }
  } catch (error: any) {
    console.warn(`   ⚠️  Failed to resolve: ${error.message}`);
  }

  return { url: redirectUrl, title: originalTitle || '', wasRedirect: true };
}

async function testGeminiGrounding() {
  console.log('🧪 Testing Gemini Grounding URL Resolution\n');
  console.log('━'.repeat(60));

  const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY!);

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    tools: [{ googleSearch: {} }] as any,
  });

  const testPrompt = 'What are the best cloud providers for enterprise AI workloads in 2024?';

  console.log(`\n📝 Test Prompt: "${testPrompt}"\n`);
  console.log('Calling Gemini API with Google Search grounding...\n');

  try {
    const result = await model.generateContent(testPrompt);
    const response = result.response;
    const text = response.text();

    console.log('✅ Response received:\n');
    console.log(text.substring(0, 500) + '...\n');
    console.log('━'.repeat(60));

    // Extract grounding metadata
    const groundingMetadata = (response as any).candidates?.[0]?.groundingMetadata;

    if (!groundingMetadata?.groundingChunks) {
      console.log('\n⚠️  No grounding chunks found in response');
      console.log('   This might mean Google Search was not used for this query');
      return;
    }

    const rawCitations: Citation[] = [];
    groundingMetadata.groundingChunks.forEach((chunk: any, idx: number) => {
      if (chunk.web) {
        rawCitations.push({
          url: chunk.web.uri || '',
          title: chunk.web.title,
          position: idx + 1,
        });
      }
    });

    console.log(`\n📚 Found ${rawCitations.length} grounding sources:\n`);

    // Show raw URLs first
    console.log('RAW URLs from API (before resolution):');
    console.log('─'.repeat(60));
    rawCitations.forEach((c, i) => {
      const isRedirect = c.url.includes('grounding-api-redirect');
      console.log(`${i + 1}. ${c.title || '(no title)'}`);
      console.log(`   ${isRedirect ? '🔒 REDIRECT: ' : '✅ DIRECT: '}${c.url.substring(0, 80)}...`);
    });

    // Resolve redirects
    console.log('\n\nRESOLVED URLs (after resolution):');
    console.log('─'.repeat(60));

    for (const citation of rawCitations) {
      const resolved = await resolveGeminiGroundingUrl(citation.url, citation.title);
      console.log(`${citation.position}. ${resolved.title || citation.title || '(no title)'}`);
      if (resolved.wasRedirect) {
        console.log(`   ✅ RESOLVED: ${resolved.url.substring(0, 100)}${resolved.url.length > 100 ? '...' : ''}`);
      } else {
        console.log(`   ➡️  DIRECT: ${resolved.url.substring(0, 100)}${resolved.url.length > 100 ? '...' : ''}`);
      }
    }

    // Summary
    const redirectCount = rawCitations.filter(c =>
      c.url.includes('grounding-api-redirect')
    ).length;

    console.log('\n' + '━'.repeat(60));
    console.log('\n📊 Summary:');
    console.log(`   Total sources: ${rawCitations.length}`);
    console.log(`   Redirect URLs: ${redirectCount}`);
    console.log(`   Direct URLs: ${rawCitations.length - redirectCount}`);
    console.log('\n✅ Test complete!\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.status === 429) {
      console.error('   Rate limited - try again later');
    }
  }
}

testGeminiGrounding();
