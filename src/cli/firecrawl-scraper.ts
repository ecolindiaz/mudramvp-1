#!/usr/bin/env node
import 'dotenv/config';
import { scrapeToMarkdown, crawlToMarkdown } from '../lib/firecrawl.js';
import { promises as fs } from 'fs';

type CliOptions = {
  crawl: boolean;
  limit?: number;
  out?: string;
  timeout?: number;
  waitFor?: number;
  onlyMain?: boolean;
};

function help(): never {
  console.log(`Usage: firecrawl [options] <url>

Options:
  -c, --crawl           Crawl entire site (multi-page)
  -l, --limit <n>       Max pages to crawl (default: 50)
  -o, --out <path>      Output file path (default: stdout)
      --timeout <ms>    Request timeout in ms (e.g., 30000)
      --wait-for <ms>   Wait before scraping to let JS load (e.g., 2000)
      --only-main       Only main content (default: false)
  -h, --help            Show this help
`);
  process.exit(0);
}

function parseArgs(argv: string[]): { url: string; opts: CliOptions } {
  const opts: CliOptions = { crawl: false };
  const args: string[] = [];
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a) break;
    if (a === '-c' || a === '--crawl') opts.crawl = true;
    else if (a === '-l' || a === '--limit') opts.limit = parseInt(argv[++i] ?? '50', 10);
    else if (a === '-o' || a === '--out') opts.out = argv[++i] ?? '';
    else if (a === '--timeout') opts.timeout = parseInt(argv[++i] ?? '0', 10);
    else if (a === '--wait-for') opts.waitFor = parseInt(argv[++i] ?? '0', 10);
    else if (a === '--only-main') opts.onlyMain = true;
    else if (a === '-h' || a === '--help') help();
    else if (a.startsWith('-')) { console.error(`Unknown option: ${a}`); help(); }
    else args.push(a);
  }
  if (args.length === 0) { console.error('Missing <url>'); help(); }
  return { url: args[0]!, opts };
}

async function main() {
  const { url, opts } = parseArgs(process.argv);
  const result = opts.crawl
    ? await crawlToMarkdown(url, { limit: opts.limit, timeoutMs: opts.timeout, waitForMs: opts.waitFor, onlyMainContent: opts.onlyMain })
    : await scrapeToMarkdown(url, { timeoutMs: opts.timeout, waitForMs: opts.waitFor, onlyMainContent: opts.onlyMain });

  if (opts.out && opts.out.length > 0) {
    await fs.writeFile(opts.out, result, 'utf8');
    console.log(`Saved markdown to ${opts.out}`);
  } else {
    process.stdout.write(result + '\n');
  }
}

main().catch((err) => {
  console.error(err?.message || String(err));
  process.exit(1);
});


