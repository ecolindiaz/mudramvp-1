/**
 * Test DirectGEO analysis with all 3 providers: OpenAI, Anthropic, Gemini
 * Verifies web search, citations, and data extraction for each
 */

import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const GOOGLE_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

const TEST_PROMPT = "What's the best CRM for startups?";
const BRAND_NAME = "HubSpot";

interface ProviderResult {
  provider: string;
  success: boolean;
  responseLength: number;
  brandMentioned: boolean;
  citationsCount: number;
  sourcesCount: number;
  citations: { title: string; url: string }[];
  sources: { title: string; url: string }[];
  latencyMs: number;
  error?: string;
}

// ============================================================
// OpenAI with Responses API + web_search
// ============================================================
async function testOpenAI(): Promise<ProviderResult> {
  const result: ProviderResult = {
    provider: 'OpenAI (GPT-4o)',
    success: false,
    responseLength: 0,
    brandMentioned: false,
    citationsCount: 0,
    sourcesCount: 0,
    citations: [],
    sources: [],
    latencyMs: 0,
  };

  if (!OPENAI_KEY) {
    result.error = 'OPENAI_API_KEY not set';
    return result;
  }

  const start = Date.now();
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        tools: [{ type: 'web_search', search_context_size: 'high' }],
        tool_choice: { type: 'web_search' },
        input: TEST_PROMPT,
        include: ['web_search_call.action.sources'],
      }),
    });

    result.latencyMs = Date.now() - start;

    if (!response.ok) {
      result.error = `HTTP ${response.status}`;
      return result;
    }

    const data = await response.json();
    let text = '';

    for (const item of data.output || []) {
      if (item.type === 'web_search_call' && item.action?.sources) {
        for (const s of item.action.sources) {
          result.sources.push({
            url: s.url?.replace(/\?utm_source=openai$/, '') || '',
            title: s.title || '',
          });
        }
      }
      if (item.type === 'message') {
        for (const c of item.content || []) {
          if (c.type === 'output_text') {
            text = c.text || '';
            for (const a of c.annotations || []) {
              if (a.type === 'url_citation') {
                result.citations.push({
                  title: a.title || '',
                  url: a.url?.replace(/\?utm_source=openai$/, '') || '',
                });
              }
            }
          }
        }
      }
    }

    // Deduplicate
    result.citations = Array.from(new Map(result.citations.map(c => [c.url, c])).values());
    result.sources = Array.from(new Map(result.sources.map(s => [s.url, s])).values());
    
    result.success = true;
    result.responseLength = text.length;
    result.brandMentioned = text.toLowerCase().includes(BRAND_NAME.toLowerCase());
    result.citationsCount = result.citations.length;
    result.sourcesCount = result.sources.length;

  } catch (error: any) {
    result.latencyMs = Date.now() - start;
    result.error = error.message;
  }

  return result;
}

// ============================================================
// Anthropic with web_search_20250305 tool
// ============================================================
async function testAnthropic(): Promise<ProviderResult> {
  const result: ProviderResult = {
    provider: 'Anthropic (Claude 4.5 Sonnet)',
    success: false,
    responseLength: 0,
    brandMentioned: false,
    citationsCount: 0,
    sourcesCount: 0,
    citations: [],
    sources: [],
    latencyMs: 0,
  };

  if (!ANTHROPIC_KEY) {
    result.error = 'ANTHROPIC_API_KEY not set';
    return result;
  }

  const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });
  const start = Date.now();

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1500,
      messages: [{ role: 'user', content: TEST_PROMPT }],
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 5,
        } as any,
      ],
    });

    result.latencyMs = Date.now() - start;

    let text = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        text += block.text;
        const textBlock = block as any;
        if (textBlock.citations && Array.isArray(textBlock.citations)) {
          for (const citation of textBlock.citations) {
            if (citation.type === 'web_search_result_location') {
              result.citations.push({
                url: citation.url || '',
                title: citation.title || '',
              });
            }
          }
        }
      }
      // Sources from web_search_tool_result
      if (block.type === 'web_search_tool_result') {
        const resultBlock = block as any;
        if (resultBlock.content && Array.isArray(resultBlock.content)) {
          for (const r of resultBlock.content) {
            if (r.type === 'web_search_result' && r.url) {
              result.sources.push({
                url: r.url,
                title: r.title || '',
              });
            }
          }
        }
      }
    }

    // Deduplicate
    result.citations = Array.from(new Map(result.citations.map(c => [c.url, c])).values());
    result.sources = Array.from(new Map(result.sources.map(s => [s.url, s])).values());

    result.success = true;
    result.responseLength = text.length;
    result.brandMentioned = text.toLowerCase().includes(BRAND_NAME.toLowerCase());
    result.citationsCount = result.citations.length;
    result.sourcesCount = result.sources.length;

  } catch (error: any) {
    result.latencyMs = Date.now() - start;
    result.error = error.message?.substring(0, 100);
  }

  return result;
}

// ============================================================
// Google Gemini with googleSearch grounding
// ============================================================
async function testGemini(): Promise<ProviderResult> {
  const result: ProviderResult = {
    provider: 'Google (Gemini 3 Flash)',
    success: false,
    responseLength: 0,
    brandMentioned: false,
    citationsCount: 0,
    sourcesCount: 0,
    citations: [],
    sources: [],
    latencyMs: 0,
  };

  if (!GOOGLE_KEY) {
    result.error = 'GOOGLE_GENERATIVE_AI_API_KEY not set';
    return result;
  }

  const genAI = new GoogleGenerativeAI(GOOGLE_KEY);
  const start = Date.now();

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-3-flash-preview',
      tools: [{ googleSearch: {} }] as any,
    });

    const genResult = await model.generateContent(TEST_PROMPT);
    result.latencyMs = Date.now() - start;

    const response = genResult.response;
    const text = response.text();

    // Extract from grounding metadata
    const groundingMetadata = (response as any).candidates?.[0]?.groundingMetadata;
    if (groundingMetadata?.groundingChunks) {
      for (const chunk of groundingMetadata.groundingChunks) {
        if (chunk.web) {
          result.citations.push({
            url: chunk.web.uri || '',
            title: chunk.web.title || '',
          });
        }
      }
    }

    // Deduplicate
    result.citations = Array.from(new Map(result.citations.map(c => [c.url, c])).values());

    result.success = true;
    result.responseLength = text.length;
    result.brandMentioned = text.toLowerCase().includes(BRAND_NAME.toLowerCase());
    result.citationsCount = result.citations.length;
    result.sourcesCount = 0; // Gemini doesn't separate sources from citations

  } catch (error: any) {
    result.latencyMs = Date.now() - start;
    result.error = error.message?.substring(0, 100);
  }

  return result;
}

// ============================================================
// Main
// ============================================================
async function main() {
  console.log('═'.repeat(80));
  console.log('DIRECTGEO PROVIDER TEST - OpenAI, Anthropic, Gemini');
  console.log('═'.repeat(80));
  console.log(`\nPrompt: "${TEST_PROMPT}"`);
  console.log(`Brand: ${BRAND_NAME}\n`);

  const results: ProviderResult[] = [];

  // Test OpenAI
  console.log('─'.repeat(80));
  console.log('[1/3] Testing OpenAI (GPT-4o with web_search)...');
  const openaiResult = await testOpenAI();
  results.push(openaiResult);
  console.log(openaiResult.success ? '✅ OpenAI: Success' : `❌ OpenAI: ${openaiResult.error}`);

  // Test Anthropic
  console.log('─'.repeat(80));
  console.log('[2/3] Testing Anthropic (Claude with web_search)...');
  const anthropicResult = await testAnthropic();
  results.push(anthropicResult);
  console.log(anthropicResult.success ? '✅ Anthropic: Success' : `❌ Anthropic: ${anthropicResult.error}`);

  // Test Gemini
  console.log('─'.repeat(80));
  console.log('[3/3] Testing Google (Gemini with googleSearch)...');
  const geminiResult = await testGemini();
  results.push(geminiResult);
  console.log(geminiResult.success ? '✅ Gemini: Success' : `❌ Gemini: ${geminiResult.error}`);

  // Summary Table
  console.log('\n' + '═'.repeat(80));
  console.log('SUMMARY');
  console.log('═'.repeat(80));
  console.log('');
  console.log('┌─────────────────────────────┬────────┬──────────┬──────────┬───────────┬──────────┬──────────┐');
  console.log('│ Provider                    │ Status │ Response │ Brand    │ Citations │ Sources  │ Latency  │');
  console.log('├─────────────────────────────┼────────┼──────────┼──────────┼───────────┼──────────┼──────────┤');

  for (const r of results) {
    const provider = r.provider.padEnd(27).substring(0, 27);
    const status = r.success ? '  ✅  ' : '  ❌  ';
    const resp = `${r.responseLength}`.padStart(6).padEnd(8);
    const brand = r.brandMentioned ? '   ✅   ' : '   ❌   ';
    const cites = `${r.citationsCount}`.padStart(5).padEnd(9);
    const sources = `${r.sourcesCount}`.padStart(5).padEnd(8);
    const latency = `${(r.latencyMs / 1000).toFixed(1)}s`.padStart(6).padEnd(8);
    console.log(`│ ${provider} │${status}│${resp}│${brand}│${cites}│${sources}│${latency}│`);
  }

  console.log('└─────────────────────────────┴────────┴──────────┴──────────┴───────────┴──────────┴──────────┘');

  // Detailed citations per provider
  for (const r of results) {
    if (r.success && (r.citations.length > 0 || r.sources.length > 0)) {
      console.log(`\n${'─'.repeat(80)}`);
      console.log(`${r.provider} - Citations & Sources`);
      console.log('─'.repeat(80));
      
      if (r.citations.length > 0) {
        console.log(`\nCitations (${r.citations.length}):`);
        r.citations.slice(0, 5).forEach((c, i) => {
          console.log(`  ${i + 1}. ${c.title || c.url}`);
        });
        if (r.citations.length > 5) console.log(`  ... and ${r.citations.length - 5} more`);
      }

      if (r.sources.length > 0) {
        console.log(`\nSources (${r.sources.length}):`);
        r.sources.slice(0, 5).forEach((s, i) => {
          console.log(`  ${i + 1}. ${s.url}`);
        });
        if (r.sources.length > 5) console.log(`  ... and ${r.sources.length - 5} more`);
      }
    }
  }

  // Errors
  const errors = results.filter(r => !r.success);
  if (errors.length > 0) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log('ERRORS');
    console.log('─'.repeat(80));
    errors.forEach(e => {
      console.log(`❌ ${e.provider}: ${e.error}`);
    });
  }

  console.log('\n' + '═'.repeat(80));
  console.log('TEST COMPLETE');
  console.log('═'.repeat(80));
}

main().catch(console.error);
