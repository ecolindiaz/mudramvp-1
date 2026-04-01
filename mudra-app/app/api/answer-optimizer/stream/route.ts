/**
 * SSE streaming endpoint for the Answer Optimizer pipeline.
 * Runs up to 9 phases, streaming progress events to the frontend.
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import type { PromptTest, Citation } from '@/lib/services/direct-geo-analysis.service';
import { firecrawlScraperTool } from '@/src/mastra/tools/firecrawl-scraper';
import { firecrawlSearchTool } from '@/src/mastra/tools/firecrawl-search';
import { gapAnalysisAgent, gapAnalysisOutputSchema } from '@/src/mastra/agents/gap-analysis-agent';
import { researchAgent, researchOutputSchema } from '@/src/mastra/agents/research-agent';
import { contentOptimizerAgent, optimizationOutputSchema } from '@/src/mastra/agents/content-optimizer-agent';
import { computeContentDiff, computeDiffStats } from '@/lib/utils/compute-content-diff';
import { prisma } from '@/lib/prisma';

export const maxDuration = 540;

interface ProgressEvent {
  phase: string;
  status: 'started' | 'progress' | 'completed' | 'failed';
  message?: string;
  data?: Record<string, any>;
  stepIndex?: number;
  totalSteps?: number;
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

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const sendEvent = async (event: ProgressEvent) => {
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
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

      const scrapeResult = await firecrawlScraperTool.execute!({ url: pageUrl });
      if (!scrapeResult.success || !scrapeResult.markdown) {
        await sendEvent({ phase: 'scrape-page', status: 'failed', message: scrapeResult.error || 'Failed to scrape page' });
        await sendEvent({ phase: 'error', status: 'failed', message: 'Could not scrape the target page' });
        return;
      }

      originalMarkdown = scrapeResult.markdown;
      originalWordCount = originalMarkdown.split(/\s+/).filter(Boolean).length;
      headingStructure = (originalMarkdown.match(/^##\s+.+$/gm) || []).map(h => h.replace(/^##\s+/, ''));

      await sendEvent({
        phase: 'scrape-page', status: 'completed', stepIndex: stepIndex++, totalSteps,
        data: { wordCount: originalWordCount, headingCount: headingStructure.length, title: scrapeResult.title },
      });

      // Phase 2: Pull AI Model Responses from existing GEO analysis results
      // Instead of running live queries (expensive + exhausts connection pool),
      // we pull from the most recent GeoAnalysisResult for this brand + prompt.
      if (tools.queryAiModels) {
        await sendEvent({ phase: 'query-ai', status: 'started', stepIndex, totalSteps });

        try {
          const latestGeo = await prisma.geoAnalysisResult.findFirst({
            where: { brandProfileId: parseInt(String(brandProfileId)) },
            orderBy: { timestamp: 'desc' },
            select: { analyses: true },
          });

          if (latestGeo?.analyses) {
            const analyses = latestGeo.analyses as any[];
            for (const providerAnalysis of analyses) {
              const tests: any[] = providerAnalysis.promptTests || [];
              for (const test of tests) {
                // Match by prompt text (case-insensitive partial match)
                if (test.prompt?.toLowerCase().includes(promptText.toLowerCase().slice(0, 30)) ||
                    promptText.toLowerCase().includes(test.prompt?.toLowerCase().slice(0, 30))) {
                  aiResponses.push(test as PromptTest);
                  if (test.citations) allCitations.push(...test.citations);
                  if (test.sources) allCitations.push(...test.sources);
                }
              }
            }
          }

          // Deduplicate citations by URL
          const seen = new Map<string, Citation>();
          for (const c of allCitations) {
            if (c.url && !seen.has(c.url)) seen.set(c.url, c);
          }
          allCitations = Array.from(seen.values());
        } catch (err) {
          console.error('[AnswerOptimizer] Phase 2 - Error fetching GEO results:', err);
        }

        await sendEvent({
          phase: 'query-ai', status: 'completed', stepIndex: stepIndex++, totalSteps,
          data: { providersQueried: aiResponses.length, citationsFound: allCitations.length, source: 'existing-geo-results' },
        });
      }

      // Phase 3: Scrape AI Citations (top 5, sequentially to avoid overwhelming Firecrawl)
      if (tools.scrapeCitations && tools.queryAiModels && allCitations.length > 0) {
        await sendEvent({ phase: 'scrape-citations', status: 'started', stepIndex, totalSteps });

        const urlsToScrape = allCitations.slice(0, 5).map(c => c.url);
        let failedCount = 0;

        for (const url of urlsToScrape) {
          try {
            const result = await firecrawlScraperTool.execute!({ url });
            if (result.success && result.markdown) {
              citedSourceContent.push({
                url: result.url,
                title: result.title || '',
                markdown: result.markdown.slice(0, 3000),
              });
            } else {
              failedCount++;
            }
          } catch {
            failedCount++;
          }
        }

        await sendEvent({
          phase: 'scrape-citations', status: 'completed', stepIndex: stepIndex++, totalSteps,
          data: { urlsScraped: citedSourceContent.length, urlsFailed: failedCount },
        });
      }

      // Phase 4: Derive Core Search Query
      await sendEvent({ phase: 'derive-query', status: 'started', stepIndex, totalSteps });

      try {
        const queryResponse = await contentOptimizerAgent.generate(
          `Analyze the intersection of this page's topic and the target prompt. Return ONLY a JSON object with no extra text.

Page title/headings: ${headingStructure.slice(0, 5).join(', ')}
Target prompt: "${promptText}"

Return: { "coreQuery": "the search query a user would type", "intent": "informational|commercial|transactional", "temporalModifier": "2026 or null" }`,
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
      } catch {
        coreQuery = promptText;
        queryIntent = 'informational';
      }

      await sendEvent({
        phase: 'derive-query', status: 'completed', stepIndex: stepIndex++, totalSteps,
        data: { query: coreQuery, intent: queryIntent },
      });

      // Phase 5: FAQ + PAA Research
      await sendEvent({ phase: 'faq-research', status: 'started', stepIndex, totalSteps });

      const [faqSearch, paaSearch] = await Promise.allSettled([
        firecrawlSearchTool.execute!({ query: `${coreQuery} FAQ`, limit: 5, maxAgeMonths: 12 }),
        firecrawlSearchTool.execute!({ query: `${coreQuery} questions people ask`, limit: 5, maxAgeMonths: 12 }),
      ]);

      const allFaqContent: string[] = [];
      for (const result of [faqSearch, paaSearch]) {
        if (result.status === 'fulfilled' && result.value.success) {
          for (const r of result.value.results) {
            if (r.markdown) allFaqContent.push(r.markdown.slice(0, 1500));
          }
        }
      }

      const questionRegex = /^(?:(?:What|How|Why|When|Which|Can|Do|Is|Are|Should|Where|Does)\s.+\?)/gim;
      const extractedQuestions = new Set<string>();
      for (const content of allFaqContent) {
        const matches = content.match(questionRegex);
        if (matches) matches.forEach(q => extractedQuestions.add(q.trim()));
      }

      faqCandidates = Array.from(extractedQuestions).slice(0, 12).map(q => ({
        question: q,
        answerDraft: '',
      }));

      await sendEvent({
        phase: 'faq-research', status: 'completed', stepIndex: stepIndex++, totalSteps,
        data: { questionsFound: faqCandidates.length },
      });

      // Phase 5b: Competitor Analysis (if enabled)
      if (tools.competitorAnalysis) {
        await sendEvent({ phase: 'competitor-analysis', status: 'started', stepIndex, totalSteps });

        const competitorSearch = await firecrawlSearchTool.execute!({
          query: coreQuery, limit: 5, maxAgeMonths: 10,
        });

        const competitorPages: Array<{ url: string; title: string; wordCount: number; headings: number }> = [];
        if (competitorSearch.success) {
          for (const result of competitorSearch.results.slice(0, 5)) {
            const scrape = await firecrawlScraperTool.execute!({ url: result.url });
            if (scrape.success && scrape.markdown) {
              competitorPages.push({
                url: result.url,
                title: result.title,
                wordCount: scrape.markdown.split(/\s+/).filter(Boolean).length,
                headings: (scrape.markdown.match(/^##\s+/gm) || []).length,
              });
            }
          }
        }

        competitorContext = {
          pages: competitorPages,
          avgWordCount: competitorPages.length > 0
            ? Math.round(competitorPages.reduce((s, p) => s + p.wordCount, 0) / competitorPages.length)
            : 0,
        };

        await sendEvent({
          phase: 'competitor-analysis', status: 'completed', stepIndex: stepIndex++, totalSteps,
          data: { pagesAnalyzed: competitorPages.length, avgWordCount: competitorContext.avgWordCount },
        });
      }

      // Phase 6: Gap Analysis
      await sendEvent({ phase: 'gap-analysis', status: 'started', stepIndex, totalSteps });

      const gapPrompt = `Analyze the following content and identify gaps across four categories.

## Existing Page Content (first 3000 chars)
${originalMarkdown.slice(0, 3000)}

## Target Prompt
"${promptText}"

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
      } catch {
        gapAnalysis = {
          contentGaps: ['Unable to complete full gap analysis'],
          dataGaps: ['Missing current statistics'],
          formatGaps: ['Consider adding FAQ section'],
          depthGaps: [],
          recommendedSearchQueries: [coreQuery + ' statistics 2026', coreQuery + ' expert insights'],
        };
      }

      await sendEvent({
        phase: 'gap-analysis', status: 'completed', stepIndex: stepIndex++, totalSteps,
        data: {
          contentGaps: gapAnalysis.contentGaps?.length || 0,
          dataGaps: gapAnalysis.dataGaps?.length || 0,
          formatGaps: gapAnalysis.formatGaps?.length || 0,
          depthGaps: gapAnalysis.depthGaps?.length || 0,
        },
      });

      // Phase 7: Research Enrichment
      if (tools.freshResearch) {
        await sendEvent({ phase: 'research', status: 'started', stepIndex, totalSteps });

        try {
          const researchResponse = await researchAgent.generate(
            `Conduct live web research to fill gaps for: "${coreQuery}"

Gap Analysis:
- Content Gaps: ${(gapAnalysis.contentGaps || []).join(', ')}
- Data Gaps: ${(gapAnalysis.dataGaps || []).join(', ')}
- Format Gaps: ${(gapAnalysis.formatGaps || []).join(', ')}
- Depth Gaps: ${(gapAnalysis.depthGaps || []).join(', ')}

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
        } catch {
          researchData = { additionalSources: [], statistics: [], expertQuotes: [], recommendations: [] };
        }

        await sendEvent({
          phase: 'research', status: 'completed', stepIndex: stepIndex++, totalSteps,
          data: {
            sourcesFound: researchData.additionalSources?.length || 0,
            statsFound: researchData.statistics?.length || 0,
            quotesFound: researchData.expertQuotes?.length || 0,
          },
        });
      }

      // Phase 8: Content Optimization
      await sendEvent({ phase: 'optimize', status: 'started', stepIndex, totalSteps });

      const depthConfig = DEPTH_TARGETS[depthLevel as keyof typeof DEPTH_TARGETS] || DEPTH_TARGETS.moderate;
      const targetWordCount = Math.min(
        Math.max(depthConfig.floor, originalWordCount),
        depthConfig.ceiling
      );

      let internalLinkSuggestions = '';
      if (tools.internalLinks && brandProfileId) {
        try {
          const sitemapPages = await prisma.sitemapPage.findMany({
            where: {
              brand_profile_id: parseInt(String(brandProfileId)),
              page_type: { in: ['blog_post', 'article', 'blog', 'post'] },
              page_url: { not: pageUrl },
            },
            select: { page_url: true },
            take: 20,
          });
          if (sitemapPages.length > 0) {
            internalLinkSuggestions = `\n## Internal Link Opportunities\nWeave in 3-5 contextual internal links:\n${sitemapPages.map(p => `- ${p.page_url}`).join('\n')}`;
          }
        } catch { /* skip internal links on error */ }
      }

      const optimizePrompt = `## Optimization Task
Depth Level: ${depthLevel.toUpperCase()}
Target Word Count: ${targetWordCount} words (minimum ${depthConfig.floor}, maximum ${depthConfig.ceiling})
Voice & Tone: ${voiceTone}
${icpDescription ? `Target ICP: ${icpDescription}` : ''}

## Existing Article (ORIGINAL)
${originalMarkdown}

${aiResponses.length > 0 ? `## AI Model Responses for "${promptText}"
${aiResponses.map(r => `### Response\n${(r.response || '').slice(0, 1500)}`).join('\n\n')}` : ''}

${citedSourceContent.length > 0 ? `## What AI Models Cite
${citedSourceContent.map(s => `### [${s.title}](${s.url})\n${s.markdown.slice(0, 1000)}`).join('\n\n')}` : ''}

## Core Search Query: "${coreQuery}" (${queryIntent} intent)

## FAQ Research
${faqCandidates.map(f => `- ${f.question}`).join('\n')}

## Gap Analysis
- Content Gaps: ${(gapAnalysis?.contentGaps || []).join(', ') || 'None'}
- Data Gaps: ${(gapAnalysis?.dataGaps || []).join(', ') || 'None'}
- Format Gaps: ${(gapAnalysis?.formatGaps || []).join(', ') || 'None'}
- Depth Gaps: ${(gapAnalysis?.depthGaps || []).join(', ') || 'None'}

${researchData ? `## Fresh Research
### Statistics (Level A — use freely)
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

Target exactly ${targetWordCount} words. Follow ${depthLevel} depth rules strictly.`;

      let optimizationResult: any;
      try {
        const response = await contentOptimizerAgent.generate(optimizePrompt, {
          structuredOutput: { schema: optimizationOutputSchema },
          maxSteps: 1,
        });
        optimizationResult = response.object;
      } catch (err: any) {
        await sendEvent({ phase: 'optimize', status: 'failed', message: err.message || 'Optimization failed' });
        await sendEvent({ phase: 'error', status: 'failed', message: 'Content optimization failed' });
        return;
      }

      if (!optimizationResult?.optimizedContent) {
        await sendEvent({ phase: 'error', status: 'failed', message: 'Optimizer returned empty content' });
        return;
      }

      await sendEvent({
        phase: 'optimize', status: 'completed', stepIndex: stepIndex++, totalSteps,
        data: { wordCount: optimizationResult.metadata?.wordCount || 0 },
      });

      // Phase 9: Schema + Diff
      await sendEvent({ phase: 'finalize', status: 'started', stepIndex, totalSteps });

      const diffSections = computeContentDiff(originalMarkdown, optimizationResult.optimizedContent);
      const diffStats = computeDiffStats(diffSections);

      let schemaMarkup: Array<{ type: string; jsonLd: string }> = [];
      if (tools.schemaMarkup) {
        const faqRegex = /^###?\s*(.+\?)\s*\n+([\s\S]*?)(?=\n###?\s|\n##\s|$)/gm;
        const faqs: Array<{ question: string; answer: string }> = [];
        let faqMatch;
        while ((faqMatch = faqRegex.exec(optimizationResult.optimizedContent)) !== null) {
          faqs.push({ question: faqMatch[1].trim(), answer: faqMatch[2].trim() });
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
          const articleSchema = {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": optimizationResult.metadata?.title || '',
            "description": optimizationResult.metadata?.metaDescription || '',
            "author": {
              "@type": "Person",
              "name": optimizationResult.metadata?.author?.name || brandContext.userName || '',
              "jobTitle": optimizationResult.metadata?.author?.title || brandContext.userRole || '',
            },
            "dateModified": new Date().toISOString().split('T')[0],
            "publisher": { "@type": "Organization", "name": brandContext.brandName || '' },
          };
          schemaMarkup.push({ type: 'Article', jsonLd: JSON.stringify(articleSchema, null, 2) });
        }
      }

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
            wordCount: optimizationResult.metadata?.wordCount || 0,
            originalWordCount,
            sections: optimizationResult.metadata?.sections || [],
            sources: optimizationResult.metadata?.sources || [],
          },
          diffManifest: optimizationResult.diffManifest,
          schemaMarkup,
        },
      });

    } catch (err: any) {
      await sendEvent({ phase: 'error', status: 'failed', message: err.message || 'Pipeline failed' });
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
