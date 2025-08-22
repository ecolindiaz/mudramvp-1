import 'dotenv/config';
import express from 'express';
import { scrapeToMarkdown, crawlToMarkdown } from '../lib/firecrawl.js';

const app = express();
app.use(express.json());

app.post('/scrape', async (req, res) => {
  try {
    const { url, crawl, limit, timeoutMs, waitForMs, onlyMainContent } = req.body || {};
    if (!url) return res.status(400).json({ error: 'url is required' });
    const md = crawl
      ? await crawlToMarkdown(url, { limit, timeoutMs, waitForMs, onlyMainContent })
      : await scrapeToMarkdown(url, { timeoutMs, waitForMs, onlyMainContent });
    return res.json({ success: true, markdown: md });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'unknown error' });
  }
});

app.listen(3000, () => console.log('Listening on :3000'));


