import 'dotenv/config';
import { scrapeToMarkdown } from '../lib/scrapers/firecrawl';

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: tsx scripts/test-firecrawl-lib.ts <url>');
    process.exit(1);
  }
  try {
    const md = await scrapeToMarkdown(url, {
      onlyMainContent: true,
      timeoutMs: 45000,
      waitForMs: 1500,
    });
    const fs = await import('fs');
    const path = await import('path');
    const outPath = path.join('output', 'paradigmai-lib.md');
    fs.writeFileSync(outPath, md, 'utf8');
    console.log(`✅ Saved markdown to ${outPath}`);
  } catch (err: any) {
    console.error('❌ scrapeToMarkdown failed:', err?.message || String(err));
    process.exit(1);
  }
}

main();


