/**
 * Test OpenAI web_search - Show ALL sources to check for Reddit, etc.
 */

const API_KEY = process.env.OPENAI_API_KEY;

if (!API_KEY) {
  console.error('❌ OPENAI_API_KEY required');
  process.exit(1);
}

const prompt = "What's the best CRM for startups?";

async function test() {
  console.log('Testing OpenAI Responses API - Full Source Analysis');
  console.log(`Prompt: "${prompt}"`);
  console.log('');

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      tools: [{ type: 'web_search', search_context_size: 'high' }],
      tool_choice: { type: 'web_search' },
      input: prompt,
      include: ['web_search_call.action.sources'],
    }),
  });

  if (!response.ok) {
    console.error('❌ Error:', response.status, await response.text());
    return;
  }

  const data = await response.json();

  const allSources: { url: string; title: string; domain: string }[] = [];
  const citations: { url: string; title: string; domain: string }[] = [];
  let responseText = '';

  for (const item of data.output || []) {
    if (item.type === 'web_search_call' && item.action?.sources) {
      for (const s of item.action.sources) {
        const url = s.url?.replace(/\?utm_source=openai$/, '') || '';
        const domain = new URL(url).hostname.replace('www.', '');
        allSources.push({
          url,
          title: s.title || '',
          domain,
        });
      }
    }

    if (item.type === 'message') {
      for (const c of item.content || []) {
        if (c.type === 'output_text') {
          responseText = c.text || '';
          for (const a of c.annotations || []) {
            if (a.type === 'url_citation') {
              const url = a.url?.replace(/\?utm_source=openai$/, '') || '';
              const domain = new URL(url).hostname.replace('www.', '');
              citations.push({
                url,
                title: a.title || '',
                domain,
              });
            }
          }
        }
      }
    }
  }

  // Deduplicate
  const uniqueSources = Array.from(new Map(allSources.map(s => [s.url, s])).values());
  const uniqueCitations = Array.from(new Map(citations.map(c => [c.url, c])).values());

  // Group by domain
  const domainCounts: Record<string, number> = {};
  uniqueSources.forEach(s => {
    domainCounts[s.domain] = (domainCounts[s.domain] || 0) + 1;
  });

  console.log('═'.repeat(70));
  console.log('SUMMARY');
  console.log('═'.repeat(70));
  console.log(`Total Sources: ${uniqueSources.length}`);
  console.log(`Total Citations: ${uniqueCitations.length}`);
  console.log(`Response length: ${responseText.length} chars`);
  console.log('');

  console.log('─'.repeat(70));
  console.log('DOMAINS (sorted by count)');
  console.log('─'.repeat(70));
  Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([domain, count]) => {
      const isReddit = domain.includes('reddit') ? ' ⭐ REDDIT' : '';
      console.log(`  ${count}x  ${domain}${isReddit}`);
    });

  // Check for Reddit
  const redditSources = uniqueSources.filter(s => s.domain.includes('reddit'));
  console.log('');
  console.log('─'.repeat(70));
  console.log(`REDDIT SOURCES: ${redditSources.length}`);
  console.log('─'.repeat(70));
  if (redditSources.length > 0) {
    redditSources.forEach((s, i) => {
      console.log(`${i + 1}. ${s.url}`);
      console.log(`   Title: ${s.title}`);
    });
  } else {
    console.log('  ❌ No Reddit sources found');
  }

  console.log('');
  console.log('═'.repeat(70));
  console.log('ALL SOURCES (by domain)');
  console.log('═'.repeat(70));
  
  // Group sources by domain for display
  const byDomain: Record<string, typeof uniqueSources> = {};
  uniqueSources.forEach(s => {
    if (!byDomain[s.domain]) byDomain[s.domain] = [];
    byDomain[s.domain].push(s);
  });

  Object.entries(byDomain)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([domain, sources]) => {
      console.log(`\n[${domain}] (${sources.length} sources)`);
      sources.forEach((s, i) => {
        console.log(`  ${i + 1}. ${s.url}`);
      });
    });

  console.log('');
  console.log('═'.repeat(70));
  console.log('INLINE CITATIONS');
  console.log('═'.repeat(70));
  uniqueCitations.forEach((c, i) => {
    console.log(`${i + 1}. [${c.domain}] ${c.title || c.url}`);
  });
}

test().catch(console.error);
