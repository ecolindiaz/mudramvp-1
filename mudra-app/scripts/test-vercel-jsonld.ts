import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env.local') });

import { createFirecrawlApp } from '../lib/config/firecrawl-config';

function extractJsonLdScripts(html: string): any[] {
  const scripts: any[] = [];
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const jsonData = JSON.parse(match[1].trim());
      scripts.push(jsonData);
    } catch (error) {
      console.warn('Failed to parse JSON-LD script:', error);
    }
  }
  return scripts;
}

async function main() {
  const url = 'https://lambda.ai/';

  // Step 1: Plain fetch
  console.log('\n=== Step 1: Plain fetch() ===');
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  const html = await resp.text();
  const plainResults = extractJsonLdScripts(html);
  console.log(`JSON-LD found via plain fetch: ${plainResults.length}`);
  if (plainResults.length > 0) {
    for (const s of plainResults) {
      console.log(`  @type: ${s['@type']}, name: ${s['name'] || 'N/A'}`);
    }
  }

  // Step 2: Firecrawl rawHtml
  console.log('\n=== Step 2: Firecrawl rawHtml ===');
  try {
    const app = await createFirecrawlApp();
    const firecrawlResult = await app.scrapeUrl(url, {
      formats: ["rawHtml"],
      onlyMainContent: false,
      timeout: 60000
    });
    const rawHtml = (firecrawlResult as any).rawHtml || '';
    console.log(`rawHtml length: ${rawHtml.length}`);
    const firecrawlResults = extractJsonLdScripts(rawHtml);
    console.log(`JSON-LD found via Firecrawl rawHtml: ${firecrawlResults.length}`);
    if (firecrawlResults.length > 0) {
      for (const s of firecrawlResults) {
        console.log(`  @type: ${s['@type']}`);
        console.log(`  Full JSON-LD:`, JSON.stringify(s, null, 2));
      }
    } else {
      console.log('No JSON-LD found via Firecrawl either.');
    }
  } catch (err) {
    console.error('Firecrawl error:', err);
  }
}

main();
