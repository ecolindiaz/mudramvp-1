/**
 * SSE streaming endpoint for the Answer Optimizer pipeline.
 * Runs up to 9 phases, streaming progress events to the frontend.
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import type { PromptTest, Citation } from '@/lib/services/direct-geo-analysis.service';
import { analyzePromptWithProvider, createDirectGEOConfig } from '@/lib/services/direct-geo-analysis.service';
import { isDomainBlocked } from '@/lib/utils/domain-utils';
import { getFirecrawlClient } from '@/src/mastra/tools/firecrawl-client';
import { gapAnalysisAgent, gapAnalysisOutputSchema } from '@/src/mastra/agents/gap-analysis-agent';
import { researchAgent, researchOutputSchema } from '@/src/mastra/agents/research-agent';
import { contentOptimizerAgent, optimizationOutputSchema } from '@/src/mastra/agents/content-optimizer-agent';
import { computeContentDiff, computeDiffStats } from '@/lib/utils/compute-content-diff';
import { countWordsInMarkdown } from '@/lib/utils/count-words';
import { trimSections, enforceOrder } from '@/lib/utils/optimize-sections';
import { prisma } from '@/lib/prisma';

async function scrapeUrl(url: string) {
  const fc = getFirecrawlClient();
  try {
    const r = await fc.scrapeUrl(url, { formats: ['markdown'], onlyMainContent: true, timeout: 30000 });
    if (!r.success) return { success: false as const, url, markdown: '', title: '', error: r.error };
    return { success: true as const, url, title: r.metadata?.title || '', markdown: r.markdown || '' };
  } catch (e: any) {
    return { success: false as const, url, markdown: '', title: '', error: e.message };
  }
}

async function searchWeb(query: string, limit = 5, maxAgeMonths = 10) {
  const fc = getFirecrawlClient();
  const now = new Date();
  const min = new Date(now); min.setMonth(min.getMonth() - maxAgeMonths);
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  try {
    const res = await fc.search(query, { limit, tbs: `cdr:1,cd_min:${fmt(min)},cd_max:${fmt(now)}`, scrapeOptions: { formats: ['markdown'], onlyMainContent: true } });
    if (!res.success) return { success: false as const, results: [] as any[] };
    return { success: true as const, results: (res.data || []).map((i: any) => ({ url: i.url || '', title: i.title || '', description: i.description || '', markdown: (i.markdown || '').slice(0, 2000) })) };
  } catch {
    return { success: false as const, results: [] as any[] };
  }
}

export const maxDuration = 540;

/** Maps SSE phase names to step IDs/labels for persistence in campaign metadata */
const STEP_TRACKING: Record<string, { id: string; label: string }> = {
  'scrape-page': { id: 'scrape', label: 'Scrape Existing Page' },
  'query-ai': { id: 'query-ai', label: 'Query AI Models' },
  'scrape-citations': { id: 'scrape-citations', label: 'Deep-Scrape Citations' },
  'derive-query': { id: 'derive-query', label: 'Derive Core Query' },
  'faq-research': { id: 'faq-research', label: 'FAQ Research' },
  'competitor-analysis': { id: 'competitor-analysis', label: 'Competitor Analysis' },
  'gap-analysis': { id: 'gap-analysis', label: 'Gap Analysis' },
  'research': { id: 'research', label: 'Fresh Research' },
  'optimize': { id: 'content-optimization', label: 'Content Optimization' },
  'finalize': { id: 'finalize', label: 'Finalize & Diff' },
};

interface ProgressEvent {
  phase: string;
  status: 'started' | 'progress' | 'completed' | 'failed';
  message?: string;
  data?: Record<string, any>;
  stepIndex?: number;
  totalSteps?: number;
  /** Milliseconds since pipeline start — used by frontend for accurate timing */
  pipelineMs?: number;
}

const DEPTH_TARGETS = {
  light: { floor: 1000, ceiling: 1200 },
  moderate: { floor: 1500, ceiling: 1800 },
  deep: { floor: 1800, ceiling: 2200 },
} as const;

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const {
    pageUrl,
    promptText,
    brandProfileId,
    depthLevel = 'moderate',
    voiceTone = 'professional',
    icpDescription = '',
    enabledTools = {},
    brandContext = {},
  } = body;

  if (!pageUrl || !promptText) {
    return new Response(JSON.stringify({ error: 'pageUrl and promptText required' }), { status: 400 });
  }

  // Validate pageUrl: must be HTTPS (or HTTP) with a public hostname
  try {
    const parsed = new URL(pageUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return new Response(JSON.stringify({ error: 'pageUrl must use http or https' }), { status: 400 });
    }
    const host = parsed.hostname.toLowerCase();
    const isRfc1918_172 = host.startsWith('172.') && (() => {
      const second = parseInt(host.split('.')[1], 10);
      return second >= 16 && second <= 31;
    })();
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' ||
        host.startsWith('10.') || host.startsWith('192.168.') || isRfc1918_172 ||
        host === '169.254.169.254' || host.endsWith('.internal') || host.endsWith('.local')) {
      return new Response(JSON.stringify({ error: 'pageUrl must be a public URL' }), { status: 400 });
    }
  } catch {
    return new Response(JSON.stringify({ error: 'pageUrl must be a valid URL' }), { status: 400 });
  }

  const runId = `ao_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const pipelineStart = Date.now();
  const elapsed = () => `${((Date.now() - pipelineStart) / 1000).toFixed(1)}s`;

  console.log(`[AnswerOptimizer ${runId}] Pipeline started`, {
    pageUrl,
    promptText: promptText.slice(0, 80),
    brandProfileId,
    depthLevel,
    voiceTone,
    icpDescription: icpDescription ? icpDescription.slice(0, 60) : '(none)',
    enabledTools,
    userId: authResult.user.id,
  });

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Auto-track completed pipeline steps for DB persistence
  const completedSteps: { id: string; label: string; status: string; elapsed: number }[] = [];
  let lastStepMs = 0;

  const sendEvent = async (event: ProgressEvent) => {
    try {
      event.pipelineMs = Date.now() - pipelineStart;
      await writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      // Track completed steps automatically
      const tracking = STEP_TRACKING[event.phase];
      if (event.status === 'completed' && tracking) {
        completedSteps.push({ id: tracking.id, label: tracking.label, status: 'completed', elapsed: event.pipelineMs - lastStepMs });
        lastStepMs = event.pipelineMs;
      }
    } catch { /* writer closed */ }
  };

  const tools = {
    queryAiModels: enabledTools.queryAiModels !== false,
    scrapeCitations: enabledTools.scrapeCitations !== false,
    freshResearch: enabledTools.freshResearch !== false,
    competitorAnalysis: !!enabledTools.competitorAnalysis,
    internalLinks: !!enabledTools.internalLinks,
    schemaMarkup: !!enabledTools.schemaMarkup,
  };

  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  (async () => {
    // Create a "generating" campaign early so the client can track it across page navigation
    let campaignId: string | null = null;
    try {
      const campaign = await prisma.campaign.create({
        data: {
          title: promptText.slice(0, 100) || 'Optimizing...',
          body: '',
          type: 'blog',
          mode: 'optimizer',
          status: 'generating',
          slug: '',
          prompt: promptText,
          icp: icpDescription || '',
          userId: authResult.user.id,
          brandProfileId: parseInt(String(brandProfileId), 10),
          metadata: {} satisfies Record<string, unknown>,
        },
      });
      campaignId = campaign.id;
      await sendEvent({ phase: 'campaign-created', status: 'started', data: { campaignId: campaign.id } });
      console.log(`[AnswerOptimizer ${runId}] Generating campaign created: ${campaign.id}`);
    } catch (createErr: any) {
      console.error(`[AnswerOptimizer ${runId}] Failed to create generating campaign:`, createErr.message);
    }

    let stepIndex = 0;
    const totalSteps = 4
      + 1 // faq-research
      + 1 // finalize
      + (tools.queryAiModels ? 1 : 0)
      + (tools.scrapeCitations && tools.queryAiModels ? 1 : 0)
      + (tools.freshResearch ? 1 : 0)
      + (tools.competitorAnalysis ? 1 : 0);

    let originalMarkdown = '';
    let originalWordCount = 0;
    let headingStructure: string[] = [];
    let aiResponses: PromptTest[] = [];
    let allCitations: Citation[] = [];
    let citedSourceContent: Array<{ url: string; title: string; markdown: string }> = [];
    let coreQuery = '';
    let queryIntent = '';
    let faqCandidates: Array<{ question: string; answerDraft: string }> = [];
    let gapAnalysis: any = null;
    let researchData: any = null;
    let competitorContext: any = null;

    try {
      // Phase 1: Scrape Existing Page
      await sendEvent({ phase: 'scrape-page', status: 'started', stepIndex, totalSteps });

      const phaseStart = Date.now();
      const scrapeResult = await scrapeUrl(pageUrl);
      if (!scrapeResult.success || !scrapeResult.markdown) {
        console.error(`[AnswerOptimizer ${runId}] Phase 1 scrape-page FAILED at ${elapsed()}:`, scrapeResult.error || 'Empty markdown');
        await sendEvent({ phase: 'scrape-page', status: 'failed', message: scrapeResult.error || 'Failed to scrape page' });
        await sendEvent({ phase: 'error', status: 'failed', message: 'Could not scrape the target page' });
        return;
      }

      originalMarkdown = scrapeResult.markdown;
      originalWordCount = countWordsInMarkdown(originalMarkdown);
      headingStructure = (originalMarkdown.match(/^##\s+.+$/gm) || []).map(h => h.replace(/^##\s+/, ''));
      const pageTitle = scrapeResult.title || promptText;

      console.log(`[AnswerOptimizer ${runId}] Phase 1 scrape-page completed in ${((Date.now() - phaseStart) / 1000).toFixed(1)}s:`, {
        wordCount: originalWordCount, headingCount: headingStructure.length, title: scrapeResult.title,
      });

      await sendEvent({
        phase: 'scrape-page', status: 'completed', stepIndex: stepIndex++, totalSteps,
        data: { wordCount: originalWordCount, headingCount: headingStructure.length, title: scrapeResult.title },
      });

      // Phase 2: Query AI Models LIVE with the article title
      // Send the page title to ChatGPT, Claude, Perplexity, and Gemini to see what
      // they currently say about this topic and who they cite as authoritative sources.
      if (tools.queryAiModels) {
        const p2Start = Date.now();
        await sendEvent({ phase: 'query-ai', status: 'started', stepIndex, totalSteps });

        try {
          const geoConfig = createDirectGEOConfig(
            brandContext.brandName || 'Unknown',
            brandContext.brandWebsite,
            {
              industry: brandContext.brandIndustry,
              description: brandContext.brandDescription,
              competitors: brandContext.competitors,
            }
          );

          // Only query providers that have API keys configured
          const allProviders = ['openai', 'perplexity', 'anthropic', 'google'] as const;
          const availableProviders = allProviders.filter(p => {
            const keyMap: Record<string, string | undefined> = {
              openai: geoConfig.apiKeys.openai,
              perplexity: geoConfig.apiKeys.perplexity,
              anthropic: geoConfig.apiKeys.anthropic,
              google: geoConfig.apiKeys.google,
            };
            return !!keyMap[p];
          });

          console.log(`[AnswerOptimizer ${runId}] Phase 2 querying ${availableProviders.length} providers with title: "${pageTitle.slice(0, 80)}"`);

          const providerResults = await Promise.allSettled(
            availableProviders.map(provider =>
              analyzePromptWithProvider(pageTitle, provider, geoConfig)
            )
          );

          let successCount = 0;
          for (const result of providerResults) {
            if (result.status === 'fulfilled') {
              successCount++;
              aiResponses.push(result.value);
              if (result.value.citations) allCitations.push(...result.value.citations);
              if (result.value.sources) allCitations.push(...result.value.sources);
            } else {
              console.warn(`[AnswerOptimizer ${runId}] Phase 2 provider failed:`, result.reason?.message || result.reason);
            }
          }

          // Deduplicate citations by URL
          const seen = new Map<string, Citation>();
          for (const c of allCitations) {
            if (c.url && !seen.has(c.url)) seen.set(c.url, c);
          }
          allCitations = Array.from(seen.values());
        } catch (err) {
          console.error(`[AnswerOptimizer ${runId}] Phase 2 query-ai FAILED at ${elapsed()}:`, err);
        }

        console.log(`[AnswerOptimizer ${runId}] Phase 2 query-ai completed in ${((Date.now() - p2Start) / 1000).toFixed(1)}s:`, {
          aiResponses: aiResponses.length, citations: allCitations.length,
        });

        await sendEvent({
          phase: 'query-ai', status: 'completed', stepIndex: stepIndex++, totalSteps,
          data: { providersQueried: aiResponses.length, citationsFound: allCitations.length, source: 'live-query' },
        });
      }

      // Phase 3: Scrape AI Citations (parallel, with domain filtering)
      if (tools.scrapeCitations && tools.queryAiModels && allCitations.length > 0) {
        const p3Start = Date.now();
        await sendEvent({ phase: 'scrape-citations', status: 'started', stepIndex, totalSteps });

        // Filter out domains known to block scrapers
        const scrapeableCitations = allCitations.filter(c => {
          try { return !isDomainBlocked(new URL(c.url).hostname); } catch { return false; }
        });
        const filteredCount = allCitations.length - scrapeableCitations.length;

        const urlsToScrape = scrapeableCitations.slice(0, 8).map(c => c.url);
        let failedCount = 0;

        // Scrape in parallel for speed
        const scrapeResults = await Promise.allSettled(
          urlsToScrape.map(url => scrapeUrl(url))
        );

        for (let i = 0; i < scrapeResults.length; i++) {
          const result = scrapeResults[i];
          if (result.status === 'fulfilled' && result.value.success && result.value.markdown) {
            citedSourceContent.push({
              url: result.value.url,
              title: result.value.title || '',
              markdown: result.value.markdown.slice(0, 3000),
            });
          } else {
            console.warn(`[AnswerOptimizer ${runId}] Citation scrape failed for ${urlsToScrape[i]}`);
            failedCount++;
          }
        }

        console.log(`[AnswerOptimizer ${runId}] Phase 3 scrape-citations completed in ${((Date.now() - p3Start) / 1000).toFixed(1)}s:`, {
          scraped: citedSourceContent.length, failed: failedCount, filtered: filteredCount,
        });

        await sendEvent({
          phase: 'scrape-citations', status: 'completed', stepIndex: stepIndex++, totalSteps,
          data: { urlsScraped: citedSourceContent.length, urlsFailed: failedCount, urlsFiltered: filteredCount },
        });
      }

      // Phase 4: Derive Core Search Query
      const p4Start = Date.now();
      await sendEvent({ phase: 'derive-query', status: 'started', stepIndex, totalSteps });

      try {
        const queryResponse = await contentOptimizerAgent.generate(
          `Identify what this page is primarily about. The target prompt tells you what query the article should rank for, but the core search query should reflect the article's actual topic, not the prompt's topic. Return ONLY a JSON object with no extra text.

Page title: "${pageTitle}"
Page headings: ${headingStructure.slice(0, 5).join(', ')}
Target prompt (for context only): "${promptText}"

Return: { "coreQuery": "the search query a user would type to find this article's topic", "intent": "informational|commercial|transactional", "temporalModifier": "2026 or null" }`,
          { maxSteps: 1 }
        );

        try {
          const cleaned = queryResponse.text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleaned);
          coreQuery = parsed.coreQuery || promptText;
          queryIntent = parsed.intent || 'informational';
        } catch {
          coreQuery = promptText;
          queryIntent = 'informational';
        }
      } catch (err) {
        console.warn(`[AnswerOptimizer ${runId}] Phase 4 derive-query fallback to promptText:`, err);
        coreQuery = promptText;
        queryIntent = 'informational';
      }

      console.log(`[AnswerOptimizer ${runId}] Phase 4 derive-query completed in ${((Date.now() - p4Start) / 1000).toFixed(1)}s:`, {
        coreQuery, intent: queryIntent,
      });

      await sendEvent({
        phase: 'derive-query', status: 'completed', stepIndex: stepIndex++, totalSteps,
        data: { query: coreQuery, intent: queryIntent },
      });

      // Phase 5: FAQ + PAA Research
      const p5Start = Date.now();
      await sendEvent({ phase: 'faq-research', status: 'started', stepIndex, totalSteps });

      const [faqSearch, paaSearch] = await Promise.allSettled([
        searchWeb(`${coreQuery} FAQ`, 5, 12),
        searchWeb(`${coreQuery} questions people ask`, 5, 12),
      ]);

      const allFaqContent: string[] = [];
      for (const result of [faqSearch, paaSearch]) {
        if (result.status === 'fulfilled' && result.value.success) {
          for (const r of result.value.results) {
            if (r.markdown) allFaqContent.push(r.markdown);
          }
        }
      }

      const questionRegex = /^(?:(?:What|How|Why|When|Which|Can|Do|Is|Are|Should|Where|Does|Will|Who|Has|Have|Would|Could)\s.+\?)/gim;
      const extractedQuestions = new Set<string>();
      for (const content of allFaqContent) {
        // Strip markdown formatting so regex can match questions inside lists, bold, headings
        const stripped = content
          .replace(/^[\s]*[-*]\s+/gm, '')           // list item prefixes (- or *)
          .replace(/^\s*\d+[.)]\s+/gm, '')           // numbered list prefixes
          .replace(/\*\*(.+?)\*\*/g, '$1')           // bold markers
          .replace(/^#{1,6}\s+/gm, '');              // heading markers
        const matches = stripped.match(questionRegex);
        if (matches) matches.forEach(q => extractedQuestions.add(q.trim()));
      }

      faqCandidates = Array.from(extractedQuestions).slice(0, 12).map(q => ({
        question: q,
        answerDraft: '',
      }));

      console.log(`[AnswerOptimizer ${runId}] Phase 5 faq-research completed in ${((Date.now() - p5Start) / 1000).toFixed(1)}s:`, {
        faqSources: allFaqContent.length, questionsExtracted: faqCandidates.length,
      });

      await sendEvent({
        phase: 'faq-research', status: 'completed', stepIndex: stepIndex++, totalSteps,
        data: { questionsFound: faqCandidates.length },
      });

      // Phase 5b: Competitor Analysis (if enabled)
      if (tools.competitorAnalysis) {
        const p5bStart = Date.now();
        await sendEvent({ phase: 'competitor-analysis', status: 'started', stepIndex, totalSteps });

        const competitorSearch = await searchWeb(coreQuery, 5, 10);

        const competitorPages: Array<{ url: string; title: string; wordCount: number; headings: number }> = [];
        let compFailedCount = 0;
        if (competitorSearch.success) {
          // Filter out domains known to block scrapers
          const scrapeableResults = competitorSearch.results.filter(r => {
            try { return !isDomainBlocked(new URL(r.url).hostname); } catch { return false; }
          });

          const compScrapeResults = await Promise.allSettled(
            scrapeableResults.slice(0, 5).map(r => scrapeUrl(r.url))
          );

          for (let ci = 0; ci < compScrapeResults.length; ci++) {
            const compResult = compScrapeResults[ci];
            const compUrl = scrapeableResults[ci].url;
            const compTitle = scrapeableResults[ci].title;
            if (compResult.status === 'fulfilled' && compResult.value.success && compResult.value.markdown) {
              competitorPages.push({
                url: compUrl,
                title: compTitle,
                wordCount: compResult.value.markdown.split(/\s+/).filter(Boolean).length,
                headings: (compResult.value.markdown.match(/^##\s+/gm) || []).length,
              });
            } else {
              console.warn(`[AnswerOptimizer ${runId}] Competitor scrape failed for ${compUrl}`);
              compFailedCount++;
            }
          }
        }

        competitorContext = {
          pages: competitorPages,
          avgWordCount: competitorPages.length > 0
            ? Math.round(competitorPages.reduce((s, p) => s + p.wordCount, 0) / competitorPages.length)
            : 0,
        };

        console.log(`[AnswerOptimizer ${runId}] Phase 5b competitor-analysis completed in ${((Date.now() - p5bStart) / 1000).toFixed(1)}s:`, {
          pagesAnalyzed: competitorPages.length, failed: compFailedCount, avgWordCount: competitorContext.avgWordCount,
        });

        await sendEvent({
          phase: 'competitor-analysis', status: 'completed', stepIndex: stepIndex++, totalSteps,
          data: { pagesAnalyzed: competitorPages.length, pagesFailed: compFailedCount, avgWordCount: competitorContext.avgWordCount },
        });
      }

      // Phase 6: Gap Analysis
      const p6Start = Date.now();
      await sendEvent({ phase: 'gap-analysis', status: 'started', stepIndex, totalSteps });

      const gapPrompt = `Analyze the following content and identify gaps across four categories.

## Existing Page Content (first 3000 chars)
${originalMarkdown.slice(0, 3000)}

## Article Topic
"${pageTitle}"
(Optimization target query: "${promptText}" — identify gaps relative to the article topic, not the prompt topic)

## Core Search Query
"${coreQuery}" (${queryIntent} intent)

${aiResponses.length > 0 ? `## What AI Models Currently Say
${aiResponses.map(r => `- ${r.prompt}: ${(r.response || '').slice(0, 500)}`).join('\n')}` : ''}

${citedSourceContent.length > 0 ? `## What AI Models Cite
${citedSourceContent.map(s => `- [${s.title}](${s.url}): ${s.markdown.slice(0, 300)}`).join('\n')}` : ''}

${competitorContext ? `## Competitor Pages
${competitorContext.pages.map((p: any) => `- ${p.title} (${p.wordCount} words, ${p.headings} H2s)`).join('\n')}` : ''}

${faqCandidates.length > 0 ? `## FAQ Questions Found
${faqCandidates.map(f => `- ${f.question}`).join('\n')}` : ''}

Identify content gaps, data gaps, format gaps, depth gaps, and suggest up to 7 search queries.`;

      try {
        const gapResponse = await gapAnalysisAgent.generate(gapPrompt, {
          structuredOutput: { schema: gapAnalysisOutputSchema },
          maxSteps: 1,
        });

        gapAnalysis = gapResponse.object || {
          contentGaps: [], dataGaps: [], formatGaps: [], depthGaps: [],
          recommendedSearchQueries: [coreQuery + ' statistics', coreQuery + ' expert analysis'],
        };
      } catch (err) {
        console.warn(`[AnswerOptimizer ${runId}] Phase 6 gap-analysis agent fallback:`, err);
        gapAnalysis = {
          contentGaps: ['Unable to complete full gap analysis'],
          dataGaps: ['Missing current statistics'],
          formatGaps: ['Consider adding FAQ section'],
          depthGaps: [],
          recommendedSearchQueries: [coreQuery + ' statistics 2026', coreQuery + ' expert insights'],
        };
      }

      const gapCounts = {
        contentGaps: gapAnalysis.contentGaps?.length || 0,
        dataGaps: gapAnalysis.dataGaps?.length || 0,
        formatGaps: gapAnalysis.formatGaps?.length || 0,
        depthGaps: gapAnalysis.depthGaps?.length || 0,
      };
      console.log(`[AnswerOptimizer ${runId}] Phase 6 gap-analysis completed in ${((Date.now() - p6Start) / 1000).toFixed(1)}s:`, gapCounts);

      await sendEvent({
        phase: 'gap-analysis', status: 'completed', stepIndex: stepIndex++, totalSteps,
        data: gapCounts,
      });

      // Phase 7: Research Enrichment
      if (tools.freshResearch) {
        const p7Start = Date.now();
        await sendEvent({ phase: 'research', status: 'started', stepIndex, totalSteps });

        try {
          const researchResponse = await researchAgent.generate(
            `Conduct live web research to fill gaps for: "${coreQuery}"

Gap Analysis (top priorities only):
- Content Gaps: ${(gapAnalysis.contentGaps || []).slice(0, 5).join(', ')}
- Data Gaps: ${(gapAnalysis.dataGaps || []).slice(0, 5).join(', ')}
- Format Gaps: ${(gapAnalysis.formatGaps || []).slice(0, 5).join(', ')}
- Depth Gaps: ${(gapAnalysis.depthGaps || []).slice(0, 5).join(', ')}

Recommended Search Queries (run max 7):
${(gapAnalysis.recommendedSearchQueries || []).slice(0, 7).map((q: string, i: number) => `${i + 1}. ${q}`).join('\n')}

IMPORTANT: Run a MAXIMUM of 7 searches. Prioritize sources from the last 12 months. Reject statistics from before January 2024.`,
            {
              structuredOutput: { schema: researchOutputSchema },
              maxSteps: 12,
            }
          );

          researchData = researchResponse.object || {
            additionalSources: [], statistics: [], expertQuotes: [], recommendations: [],
          };
        } catch (err) {
          console.warn(`[AnswerOptimizer ${runId}] Phase 7 research agent fallback:`, err);
          researchData = { additionalSources: [], statistics: [], expertQuotes: [], recommendations: [] };
        }

        const researchCounts = {
          sourcesFound: researchData.additionalSources?.length || 0,
          statsFound: researchData.statistics?.length || 0,
          quotesFound: researchData.expertQuotes?.length || 0,
        };
        console.log(`[AnswerOptimizer ${runId}] Phase 7 research completed in ${((Date.now() - p7Start) / 1000).toFixed(1)}s:`, researchCounts);

        await sendEvent({
          phase: 'research', status: 'completed', stepIndex: stepIndex++, totalSteps,
          data: researchCounts,
        });
      }

      // Phase 8: Content Optimization
      const p8Start = Date.now();
      await sendEvent({ phase: 'optimize', status: 'started', stepIndex, totalSteps });

      const depthConfig = DEPTH_TARGETS[depthLevel as keyof typeof DEPTH_TARGETS] || DEPTH_TARGETS.moderate;
      // Target the midpoint of the range — the model tends to undershoot slightly,
      // so aiming higher helps it land within range. Server-side trimming catches overshoot.
      const rangeMidpoint = Math.round((depthConfig.floor + depthConfig.ceiling) / 2);
      const targetWordCount = Math.min(
        Math.max(rangeMidpoint, originalWordCount),
        depthConfig.ceiling
      );

      let internalLinkSuggestions = '';
      if (tools.internalLinks && brandProfileId) {
        try {
          // Verify brand profile belongs to the authenticated user
          const bpId = parseInt(String(brandProfileId));
          const brandProfile = await prisma.brandProfile.findFirst({
            where: { id: bpId, userId: authResult.user.id },
            select: { id: true },
          });
          if (!brandProfile) {
            console.warn(`[AnswerOptimizer ${runId}] brandProfileId ${bpId} not owned by user ${authResult.user.id}`);
          }

          const normalizedPageUrl = pageUrl.toLowerCase().trim().replace(/^(https?:\/\/)www\./i, '$1').replace(/#.*$/, '').replace(/\/$/, '') || pageUrl;
          const sitemapPages = brandProfile ? await prisma.sitemapPage.findMany({
            where: {
              brand_profile_id: bpId,
              page_url: { not: normalizedPageUrl },
              OR: [
                { page_type: { in: ['blog', 'resources', 'customers', 'use-cases', 'product', 'features', 'solutions', 'documentation'] } },
                { page_url: { contains: '/blog/' } },
                { page_url: { contains: '/blogs/' } },
                { page_url: { contains: '/posts/' } },
                { page_url: { contains: '/articles/' } },
              ],
            },
            select: { page_url: true, id: true },
            take: 30,
          }) : [];

          if (sitemapPages.length > 0) {
            // Fetch page titles from snapshots for contextual anchor text
            const pageSnapshots = await prisma.pageSnapshot.findMany({
              where: {
                sitemap_page_id: { in: sitemapPages.map(p => p.id) },
                is_current: true,
              },
              select: { sitemap_page_id: true, metadata_json: true },
            });

            const titleMap = new Map<string, string>();
            for (const snap of pageSnapshots) {
              const meta = snap.metadata_json as any;
              const title = meta?.title?.content || meta?.title || '';
              if (title && typeof title === 'string') titleMap.set(snap.sitemap_page_id, title);
            }

            internalLinkSuggestions = `\n## Internal Link Opportunities\nWeave in 3-7 contextual internal links using descriptive anchor text. Place them where a reader would naturally want to learn more.\n${
              sitemapPages.map(p => {
                const title = titleMap.get(p.id) || '';
                return title ? `- [${title}](${p.page_url})` : `- ${p.page_url}`;
              }).join('\n')
            }`;
          }
        } catch (err) {
          console.warn(`[AnswerOptimizer ${runId}] Internal links query failed:`, err);
        }
      }

      // Map depth level to system prompt labels
      const depthLabels: Record<string, string> = {
        light: 'LIGHT TOUCH',
        moderate: 'SMART REWRITE',
        deep: 'DEEP OVERHAUL',
      };
      const depthLabel = depthLabels[depthLevel] || 'SMART REWRITE';

      const optimizePrompt = `## TOPIC ANCHOR
This article is about: "${pageTitle}"
Original URL: ${pageUrl}
Optimization target: make this article get cited when someone asks "${promptText}"
RULES:
- Every H2 section must be directly about "${pageTitle}" — not about the prompt's topic.
- Do NOT add sections that bridge the article's subject to an adjacent topic from the prompt.
- The prompt tells you WHAT QUERY to optimize for, not what new subjects to introduce.

## Optimization Task
Depth Level: ${depthLabel}
Target Word Count: ${targetWordCount} words (minimum ${depthConfig.floor}, maximum ${depthConfig.ceiling})
Voice & Tone: ${voiceTone}
${voiceTone === 'conversational' ? '- Use contractions, shorter sentences, first-person plural ("we"), and approachable language' : ''}
${voiceTone === 'technical' ? '- Use precise terminology, avoid simplification, include technical details and specifications' : ''}
${voiceTone === 'educational' ? '- Define terms on first use, build concepts progressively, use analogies for complex ideas' : ''}
${voiceTone === 'persuasive' ? '- Lead with benefits and outcomes, use social proof, include clear calls-to-action' : ''}
${icpDescription ? `Target ICP: ${icpDescription}\nAdapt reading level, examples, pain points, and terminology to this audience.` : ''}

## Existing Article (ORIGINAL)
${originalMarkdown}

${aiResponses.length > 0 ? `## AI Model Responses for "${promptText}"
${aiResponses.map(r => `### Response\n${(r.response || '').slice(0, 1500)}`).join('\n\n')}` : ''}

${citedSourceContent.length > 0 ? `## What AI Models Cite
${citedSourceContent.map(s => `### [${s.title}](${s.url})\n${s.markdown.slice(0, 2000)}`).join('\n\n')}` : ''}

## Core Search Query: "${coreQuery}" (${queryIntent} intent)

## FAQ Research
${faqCandidates.map(f => `- ${f.question}`).join('\n')}

## Gap Analysis (top priorities)
- Content Gaps: ${(gapAnalysis?.contentGaps || []).slice(0, 5).join(', ') || 'None'}
- Data Gaps: ${(gapAnalysis?.dataGaps || []).slice(0, 5).join(', ') || 'None'}
- Format Gaps: ${(gapAnalysis?.formatGaps || []).slice(0, 5).join(', ') || 'None'}
- Depth Gaps: ${(gapAnalysis?.depthGaps || []).slice(0, 5).join(', ') || 'None'}

${researchData ? `## Fresh Research
### Statistics (Level B — verify before citing)
${(researchData.statistics || []).map((s: any) => `- ${s.stat} — [${s.source}](${s.url})`).join('\n') || 'None'}

### Expert Quotes
${(researchData.expertQuotes || []).map((q: any) => `- "${q.quote}" — ${q.speaker}`).join('\n') || 'None'}

### Additional Sources
${(researchData.additionalSources || []).map((s: any) => `- [${s.title}](${s.url}): ${s.keyInsight || ''}`).join('\n') || 'None'}` : ''}

${competitorContext ? `## Competitor Analysis\nAvg word count: ${competitorContext.avgWordCount}` : ''}
${internalLinkSuggestions}

## Brand Context
Brand: ${brandContext.brandName || 'Unknown'} | Industry: ${brandContext.brandIndustry || 'Unknown'}
Author: ${brandContext.userName || 'Team'}, ${brandContext.userRole || 'Editor'}

## CRITICAL: Word Count Constraint
The original article is ${originalWordCount} words. Your output MUST be between ${depthConfig.floor} and ${depthConfig.ceiling} words (target: ${targetWordCount}).
You need to produce at least ${depthConfig.floor - originalWordCount > 0 ? depthConfig.floor - originalWordCount + ' MORE words than the original' : 'as many words as the original'}.
- If your draft is BELOW ${depthConfig.floor} words: you MUST keep writing. Add longer direct-answer paragraphs, expand descriptions, add FAQ entries with 2-3 sentence answers, include comparison tables. A short article is a FAILURE.
- If your draft EXCEEDS ${depthConfig.ceiling} words: cut sections or shorten paragraphs.
Count every word before finalizing. The floor is as important as the ceiling.
Follow ${depthLabel} depth rules strictly.`;

      let optimizationResult: any;
      try {
        const response = await contentOptimizerAgent.generate(optimizePrompt, {
          structuredOutput: { schema: optimizationOutputSchema },
          maxSteps: 1,
        });
        optimizationResult = response.object;
      } catch (err: any) {
        console.error(`[AnswerOptimizer ${runId}] Phase 8 optimize FAILED at ${elapsed()}:`, err.message || err);
        await sendEvent({ phase: 'optimize', status: 'failed', message: err.message || 'Optimization failed' });
        await sendEvent({ phase: 'error', status: 'failed', message: 'Content optimization failed' });
        return;
      }

      if (!optimizationResult?.optimizedContent) {
        console.error(`[AnswerOptimizer ${runId}] Phase 8 optimize returned empty content at ${elapsed()}`);
        await sendEvent({ phase: 'error', status: 'failed', message: 'Optimizer returned empty content' });
        return;
      }

      let optimizedWordCount = countWordsInMarkdown(optimizationResult.optimizedContent);
      const aiReportedWordCount = optimizationResult.metadata?.wordCount || 0;
      if (Math.abs(optimizedWordCount - aiReportedWordCount) > 50) {
        console.warn(`[AnswerOptimizer ${runId}] Word count mismatch: AI reported ${aiReportedWordCount}, actual ${optimizedWordCount} (target ${targetWordCount})`);
      }

      // Server-side word count enforcement: if model exceeded ceiling, trim sections
      let content = optimizationResult.optimizedContent as string;

      if (optimizedWordCount > depthConfig.ceiling) {
        console.warn(`[AnswerOptimizer ${runId}] Output exceeds ceiling (${optimizedWordCount} > ${depthConfig.ceiling}). Trimming...`);
        const trimResult = trimSections(content, depthConfig.ceiling);
        for (const name of trimResult.trimmedSections) {
          console.log(`[AnswerOptimizer ${runId}] Trimmed section: ${name}`);
        }
        if (trimResult.trimmedSections.length === 0) {
          console.warn(`[AnswerOptimizer ${runId}] All remaining sections are protected — content still exceeds ceiling`);
        }
        content = trimResult.content;
        optimizedWordCount = countWordsInMarkdown(content);
        if (optimizationResult.metadata) {
          optimizationResult.metadata.wordCount = optimizedWordCount;
        }
        console.log(`[AnswerOptimizer ${runId}] After trimming: ${optimizedWordCount} words`);
      }

      // Enforce content structure: Bottom Line immediately before FAQ, FAQ is last section
      const orderResult = enforceOrder(content);
      if (orderResult.reordered) {
        console.log(`[AnswerOptimizer ${runId}] Reordered sections to enforce Bottom Line → FAQ → END`);
        content = orderResult.content;
        optimizedWordCount = countWordsInMarkdown(content);
      }

      optimizationResult.optimizedContent = content;

      console.log(`[AnswerOptimizer ${runId}] Phase 8 optimize completed in ${((Date.now() - p8Start) / 1000).toFixed(1)}s:`, {
        wordCount: optimizedWordCount, targetWordCount, delta: optimizedWordCount - originalWordCount,
      });

      await sendEvent({
        phase: 'optimize', status: 'completed', stepIndex: stepIndex++, totalSteps,
        data: { wordCount: optimizedWordCount },
      });

      // Phase 9: Schema + Diff
      const p9Start = Date.now();
      await sendEvent({ phase: 'finalize', status: 'started', stepIndex, totalSteps });

      const diffSections = computeContentDiff(originalMarkdown, optimizationResult.optimizedContent);
      const diffStats = computeDiffStats(diffSections);

      let schemaMarkup: Array<{ type: string; jsonLd: string }> = [];
      if (tools.schemaMarkup) {
        const faqRegex = /^###?\s*(.+\?)\s*\n+([\s\S]*?)(?=\n###?\s|\n##\s|$)/gm;
        const faqs: Array<{ question: string; answer: string }> = [];
        let faqMatch;
        const optimizedText = optimizationResult.optimizedContent;
        while ((faqMatch = faqRegex.exec(optimizedText)) !== null) {
          faqs.push({ question: faqMatch[1].trim(), answer: faqMatch[2].trim() });
        }

        // Fix last FAQ truncation: if the last answer is too short,
        // re-extract from its heading to end of content
        if (faqs.length > 0) {
          const lastFaq = faqs[faqs.length - 1];
          if (lastFaq.answer.length < 50) {
            const lastIdx = optimizedText.lastIndexOf(lastFaq.question);
            if (lastIdx !== -1) {
              const tail = optimizedText.slice(lastIdx + lastFaq.question.length).replace(/^\s*\n+/, '').trim();
              if (tail.length > lastFaq.answer.length) lastFaq.answer = tail;
            }
          }
        }

        if (faqs.length > 0) {
          const faqSchema = {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": faqs.map(f => ({
              "@type": "Question",
              "name": f.question,
              "acceptedAnswer": { "@type": "Answer", "text": f.answer },
            })),
          };
          schemaMarkup.push({ type: 'FAQPage', jsonLd: JSON.stringify(faqSchema, null, 2) });
        }

        if (depthLevel !== 'light') {
          const todayISO = new Date().toISOString().split('T')[0];
          const blogSchema = {
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            "headline": optimizationResult.metadata?.title || '',
            "description": optimizationResult.metadata?.metaDescription || '',
            "url": pageUrl,
            "author": {
              "@type": "Person",
              "name": optimizationResult.metadata?.author?.name || brandContext.userName || '',
              "jobTitle": optimizationResult.metadata?.author?.title || brandContext.userRole || '',
            },
            "datePublished": todayISO,
            "dateModified": todayISO,
            "publisher": { "@type": "Organization", "name": brandContext.brandName || '' },
          };
          schemaMarkup.push({ type: 'BlogPosting', jsonLd: JSON.stringify(blogSchema, null, 2) });
        }
      }

      console.log(`[AnswerOptimizer ${runId}] Phase 9 finalize completed in ${((Date.now() - p9Start) / 1000).toFixed(1)}s:`, {
        schemasGenerated: schemaMarkup.length, diffSections: diffSections.length,
        diffStats,
      });

      await sendEvent({
        phase: 'finalize', status: 'completed', stepIndex: stepIndex++, totalSteps,
        data: { schemasGenerated: schemaMarkup.length },
      });

      // Send full result
      await sendEvent({
        phase: 'complete',
        status: 'completed',
        data: {
          optimizedContent: optimizationResult.optimizedContent,
          originalContent: originalMarkdown,
          diffSections,
          diffStats,
          metadata: {
            title: optimizationResult.metadata?.title || '',
            metaDescription: optimizationResult.metadata?.metaDescription || '',
            wordCount: optimizedWordCount,
            originalWordCount,
            sections: optimizationResult.metadata?.sections || [],
            sources: optimizationResult.metadata?.sources || [],
          },
          diffManifest: optimizationResult.diffManifest,
          schemaMarkup,
        },
      });

      const totalDuration = ((Date.now() - pipelineStart) / 1000).toFixed(1);
      console.log(`[AnswerOptimizer ${runId}] Pipeline completed in ${totalDuration}s`, {
        originalWordCount,
        optimizedWordCount,
        schemas: schemaMarkup.length,
        steps: stepIndex,
      });

      // Update the "generating" campaign to "draft" with the final result
      try {
        const pageSlug = new URL(pageUrl).pathname.split('/').filter(Boolean).pop() || '';
        let contentLabSchema: Record<string, string | number | boolean> | null = null;
        let schemaStatusVal = 'none';
        if (schemaMarkup.length > 0) {
          const combined = schemaMarkup.map((s: { type: string; jsonLd: string }) => s.jsonLd).join('\n\n');
          contentLabSchema = {
            schemaType: 'BlogPosting',
            scriptTag: `<script type="application/ld+json">\n${combined}\n</script>`,
            generatedAt: new Date().toISOString(),
            confidence: 0.85,
            sourceHash: '',
          };
          schemaStatusVal = 'ready';
        }

        const enabledToolsList: string[] = [];
        if (tools.queryAiModels) enabledToolsList.push('query-ai-models');
        if (tools.scrapeCitations) enabledToolsList.push('scrape-citations');
        if (tools.freshResearch) enabledToolsList.push('research-stats');
        if (tools.competitorAnalysis) enabledToolsList.push('competitor-analysis');
        if (tools.internalLinks) enabledToolsList.push('internal-links');
        if (tools.schemaMarkup) enabledToolsList.push('schema-markup');

        const draftData = {
          title: optimizationResult.metadata?.title || pageSlug.replace(/-/g, ' ') || 'Optimized Content',
          body: optimizationResult.optimizedContent,
          status: 'draft',
          slug: pageSlug,
          metadata: {
            metaDescription: optimizationResult.metadata?.metaDescription || '',
            sources: optimizationResult.metadata?.sources || [],
            contentLabSchema,
            schemaStatus: schemaStatusVal,
            originalContent: originalMarkdown,
            optimizerSource: {
              originalUrl: pageUrl,
              promptText,
              promptCategory: '',
              icpName: '',
              icpDescription: icpDescription || '',
              voiceTone,
              depthLevel,
              enabledTools: enabledToolsList,
              originalWordCount,
              optimizedWordCount,
              diffStats,
              pipelineSteps: completedSteps,
              pipelineTotalElapsed: Date.now() - pipelineStart,
            },
          },
        };

        if (campaignId) {
          await prisma.campaign.update({ where: { id: campaignId }, data: draftData });
        } else {
          // Fallback: create if the initial generating campaign failed
          await prisma.campaign.create({
            data: {
              ...draftData,
              type: 'blog',
              mode: 'optimizer',
              prompt: promptText,
              icp: icpDescription || '',
              userId: authResult.user.id,
              brandProfileId: parseInt(String(brandProfileId), 10),
            },
          });
        }
        console.log(`[AnswerOptimizer ${runId}] Draft saved to DB (campaignId: ${campaignId || 'new'})`);
      } catch (saveErr: any) {
        console.error(`[AnswerOptimizer ${runId}] Failed to save draft:`, saveErr.message);
      }

    } catch (err: any) {
      console.error(`[AnswerOptimizer ${runId}] Pipeline FAILED at ${elapsed()}:`, err.message || err);
      await sendEvent({ phase: 'error', status: 'failed', message: err.message || 'Pipeline failed' });
      // Mark the generating campaign as failed
      if (campaignId) {
        try { await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'failed' } }); } catch { /* best effort */ }
      }
    } finally {
      try { await writer.close(); } catch { /* already closed */ }
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
