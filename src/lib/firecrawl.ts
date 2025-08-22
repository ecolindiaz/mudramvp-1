import FirecrawlApp from '@mendable/firecrawl-js';

export type ScrapeOptions = {
  timeoutMs?: number;
  waitForMs?: number;
  onlyMainContent?: boolean;
};

export type CrawlOptions = {
  limit?: number;
  timeoutMs?: number;
  waitForMs?: number;
  onlyMainContent?: boolean;
  maxDepth?: number;
};

function getApp(): FirecrawlApp {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error('FIRECRAWL_API_KEY is not set');
  return new FirecrawlApp({ apiKey });
}

export async function scrapeToMarkdown(url: string, opts: ScrapeOptions = {}): Promise<string> {
  const app = getApp();
  const res = await app.scrapeUrl(url, {
    formats: ['markdown'],
    onlyMainContent: opts.onlyMainContent ?? false,
    timeout: opts.timeoutMs,
    waitFor: opts.waitForMs,
  } as any);

  if (!('success' in res) || !(res as any).success) {
    throw new Error(`Scrape failed: ${(res as any)?.error ?? 'unknown error'}`);
  }
  const md = (res as any)?.markdown ?? (res as any)?.data?.markdown ?? '';
  if (!md) throw new Error('No markdown returned');
  return md;
}

export async function crawlToMarkdown(url: string, opts: CrawlOptions = {}): Promise<string> {
  const app = getApp();
  const res = await app.crawlUrl(
    url,
    {
      limit: opts.limit ?? 50,
      maxDepth: opts.maxDepth,
      scrapeOptions: {
        formats: ['markdown'],
        onlyMainContent: opts.onlyMainContent ?? false,
        timeout: opts.timeoutMs,
        waitFor: opts.waitForMs,
      },
    } as any,
    3
  );

  if (!('success' in res) || !(res as any).success) {
    throw new Error(`Crawl failed: ${(res as any)?.error ?? 'unknown error'}`);
  }

  const pages = (res as any)?.data ?? [];
  const sections: string[] = [];
  for (const page of pages) {
    const href = page?.metadata?.sourceURL || page?.url || '';
    const md = page?.markdown || page?.data?.markdown || '';
    if (md) sections.push(`# ${href}\n\n${md}`);
  }
  return sections.join('\n\n---\n\n');
}


