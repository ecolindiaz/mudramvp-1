/**
 * Conversation Radar Service
 * 
 * Core service for finding and managing conversation opportunities.
 * 
 * Mode 1 (Cited): Extract Reddit URLs from AI visibility analysis citations
 * Mode 2 (Proactive): Search Reddit for relevant conversations
 */

import { prisma } from '@/lib/prisma';
import { 
  analyzeOpportunityWithAgent, 
  batchAnalyzeOpportunities,
  type OpportunityAnalysis 
} from '@/src/mastra/agents/conversation-radar-agent';
import { scrapeRedditUrls, searchReddit, type RedditPost } from '@/lib/apify/reddit-scraper';
import { 
  extractRedditCitationsFromAnalysis, 
  normalizeRedditUrl,
  type ExtractedCitation 
} from '@/lib/conversation-radar/citation-extractor';
import { 
  generateSearchQueries, 
  buildCompetitorSearchUrl,
  type BrandContext,
  type TrackedPromptQuery,
} from '@/lib/conversation-radar/query-generator';
import {
  isQualityRedditPost,
  isQualityContent,
  isRelevantToQuery,
  calculateQueryRelevance,
  calculateQualityScore,
  PROACTIVE_REDDIT_FILTERS,
  CITED_REDDIT_FILTERS,
} from '@/lib/conversation-radar/filters';

// ============================================================================
// TYPES
// ============================================================================

export interface ProcessingStats {
  created: number;
  skipped: number;
  errors: number;
  total?: number;
}

export interface ProactiveSearchStats {
  reddit: number;
  total: number;
  queries: string[];
}

interface DiscoveredViaItem {
  promptText?: string;
  provider?: string;
  citationTitle?: string;
  searchQuery?: string;
}

// ============================================================================
// MODE 1: CITED RADAR (Reddit Only)
// ============================================================================

/**
 * Process citations from an AI visibility analysis run and create Reddit opportunities.
 * 
 * Mode 1 (Cited Radar) only supports Reddit because:
 * - LinkedIn Apify actor doesn't support URL scraping (only keyword search)
 * - Perplexity citations may include LinkedIn URLs, but we can't fetch their content
 */
export async function processCitedOpportunities(
  brandProfileId: number,
  analysisRunId: number,
  options: { maxCitations?: number; language?: 'en' | 'es' } = {}
): Promise<ProcessingStats> {
  const { maxCitations = 2, language = 'en' } = options; // Default: 2 citations per run
  const stats: ProcessingStats = { created: 0, skipped: 0, errors: 0 };
  
  console.log(`[Cited Radar] Processing analysis run ${analysisRunId} for brand ${brandProfileId} (max: ${maxCitations})`);
  
  // 1. Get the analysis run
  const analysisRun = await prisma.analysisRun.findUnique({
    where: { id: analysisRunId },
  });
  
  if (!analysisRun) {
    throw new Error(`Analysis run ${analysisRunId} not found`);
  }
  
  // 2. Extract Reddit citations only (LinkedIn not supported for URL scraping)
  const citations = extractRedditCitationsFromAnalysis(analysisRun);
  
  if (citations.length === 0) {
    console.log('[Cited Radar] No Reddit citations found in analysis run');
    return stats;
  }
  
  // 3. Get unique Reddit URLs
  let redditUrls = [...new Set(citations.map(c => c.url))];
  
  // 4. Filter out URLs that already have opportunities for this language (to avoid re-processing)
  const existingOpportunities = await prisma.conversationOpportunity.findMany({
    where: {
      brandProfileId,
      language,
      postUrl: { in: redditUrls },
    },
    select: { postUrl: true },
  });
  const existingUrls = new Set(existingOpportunities.map(o => o.postUrl));
  redditUrls = redditUrls.filter(url => !existingUrls.has(url));
  
  if (redditUrls.length === 0) {
    console.log('[Cited Radar] All citations already processed');
    return stats;
  }
  
  // 5. Limit to maxCitations to spread opportunities over time
  const urlsToProcess = redditUrls.slice(0, maxCitations);
  console.log(`[Cited Radar] Processing ${urlsToProcess.length}/${redditUrls.length} unprocessed Reddit URLs...`);
  
  // 6. Scrape Reddit URLs via Apify
  try {
    const scraped = await scrapeRedditUrls(urlsToProcess, false);
    
    if (!scraped.success) {
      console.error('[Cited Radar] Apify scrape failed:', scraped.error);
      stats.errors = urlsToProcess.length;
      return stats;
    }
    
    console.log(`[Cited Radar] Scraped ${scraped.posts.length} posts`);
    
    for (const post of scraped.posts) {
      // Find all citations that led to this URL
      const relatedCitations = citations.filter(c =>
        c.url === post.url || normalizeRedditUrl(c.url) === normalizeRedditUrl(post.url)
      );

      // Skip posts that don't match any citation URL (phantom results from
      // the placeholder query the Apify actor requires)
      if (relatedCitations.length === 0) {
        stats.skipped++;
        continue;
      }

      // Check basic quality (relaxed for cited mode)
      if (!isQualityRedditPost(post, CITED_REDDIT_FILTERS)) {
        stats.skipped++;
        continue;
      }
      
      try {
        await createOrUpdateOpportunity({
          brandProfileId,
          post,
          platform: 'reddit',
          mode: 'cited',
          discoveredVia: relatedCitations.map(c => ({
            promptText: c.promptText,
            provider: c.provider,
            citationTitle: c.citationTitle,
          })),
          language,
        });
        stats.created++;
      } catch (error: any) {
        if (error.code === 'P2002') {
          // Unique constraint violation - opportunity already exists
          stats.skipped++;
        } else {
          console.error('[Cited Radar] Error creating opportunity:', error.message);
          stats.errors++;
        }
      }
    }
  } catch (scrapeError: any) {
    console.error('[Cited Radar] Apify scrape failed:', scrapeError.message);
    stats.errors += urlsToProcess.length;
  }
  
  console.log(`[Cited Radar] Complete: ${stats.created} created, ${stats.skipped} skipped, ${stats.errors} errors`);
  return stats;
}

// ============================================================================
// MODE 2: PROACTIVE RADAR (Reddit Only)
// ============================================================================

/**
 * Run proactive search for conversation opportunities.
 * 
 * NEW APPROACH: Search Reddit directly with tracked prompts!
 * 
 * Why this is better:
 * - Tracked prompts are the exact questions users ask AI models
 * - If someone on Reddit asks the same question, that's a PERFECT match
 * - No need to derive keywords or guess subreddits
 * - Much higher accuracy and relevance
 */
export async function runProactiveSearch(
  brandProfileId: number,
  language: 'en' | 'es' = 'en',
  promptTexts?: string[],
  country?: string,
): Promise<ProactiveSearchStats> {
  const stats: ProactiveSearchStats = { reddit: 0, total: 0, queries: [] };

  console.log(`[Proactive Radar] Starting for brand ${brandProfileId} (country: ${country ?? 'any'}, language: ${language})`);

  // Prompts are now per-country. Prefer country scope when available so
  // Colombia's radar doesn't pull Argentina's tracked prompts (or vice versa).
  // Fall back to language for legacy brands still on the shared-prompt model.
  const promptFilter = country
    ? { isActive: true, country }
    : { isActive: true, language };

  const brandProfile = await prisma.brandProfile.findUnique({
    where: { id: brandProfileId },
    include: { prompts: { where: promptFilter } },
  });

  const strictLanguage = Boolean((brandProfile as any)?.strictLanguageFilter);
  
  if (!brandProfile) {
    throw new Error(`Brand profile ${brandProfileId} not found`);
  }
  
  const brandContext: BrandContext = {
    companyName: brandProfile.companyName || '',
    companyDescription: brandProfile.companyDescription,
    companyICP: brandProfile.companyICP,
    companyIndustry: brandProfile.companyIndustry,
    competitors: brandProfile.competitors?.split(',').map(c => c.trim()).filter(Boolean) || [],
    trackedPrompts: promptTexts || (language !== 'en'
      ? brandProfile.prompts.filter(p => {
          // For non-English: skip brand-specific prompts (Apify queries mode returns garbage)
          if (p.category === 'Brand-Specific') return false;
          // Skip FAQs that mention the company name
          if (p.category === 'FAQ' && brandProfile.companyName &&
              p.text.toLowerCase().includes(brandProfile.companyName.toLowerCase())) return false;
          return true;
        })
      : brandProfile.prompts
    ).map(p => p.text),
  };
  
  console.log(`[Proactive Radar] Brand context:`, {
    name: brandContext.companyName,
    trackedPrompts: brandContext.trackedPrompts.length,
    competitors: brandContext.competitors.length,
  });
  
  if (brandContext.trackedPrompts.length === 0) {
    console.log(`[Proactive Radar] No tracked prompts found - cannot run proactive search`);
    return stats;
  }
  
  // 2. Generate search queries from tracked prompts. `strictLanguage`
  // drops English subreddits for Spanish scans so results actually come
  // back in Spanish instead of skewing toward r/SaaS and friends.
  const queries = await generateSearchQueries(brandContext, language, { strictLanguage });
  console.log(`[Proactive Radar] Generated ${queries.trackedPromptQueries.length} tracked prompt queries${strictLanguage ? ' (strict language)' : ''}`);
  
  // ⚡ CREDIT OPTIMIZATION: Process up to 3 tracked prompts + 1 competitor query per run
  // The scheduler/cron will rotate through remaining prompts over time
  const MAX_QUERIES_PER_RUN = 3;
  const limitedPromptQueries = queries.trackedPromptQueries.slice(0, MAX_QUERIES_PER_RUN);
  const limitedCompetitorQueries = queries.competitorQueries.slice(0, 1);

  console.log(`[Proactive Radar] ⚡ Processing ${limitedPromptQueries.length} prompt + ${limitedCompetitorQueries.length} competitor queries (credit limit)`);
  
  // 3. Search Reddit using tracked prompts directly
  const redditOpportunities = await searchRedditWithTrackedPrompts(
    brandProfileId,
    limitedPromptQueries,
    limitedCompetitorQueries,
    brandContext,
    language
  );
  
  stats.reddit = redditOpportunities;
  stats.queries = limitedPromptQueries.map(q => q.searchQuery);
  stats.total = stats.reddit;
  
  console.log(`[Proactive Radar] Complete:`, stats);
  return stats;
}

/**
 * Search Reddit using targeted subreddit searches
 * 
 * This is the KEY to accurate results:
 * - Detect relevant subreddits from the tracked prompt topic
 * - Search within specific subreddits (e.g., r/MachineLearning for ML topics)
 * - Subreddit-specific search yields 60-70% relevance vs 20-30% for global
 */
async function searchRedditWithTrackedPrompts(
  brandProfileId: number,
  trackedPromptQueries: TrackedPromptQuery[],
  competitorQueries: string[],
  brandContext: BrandContext,
  language: 'en' | 'es' = 'en'
): Promise<number> {
  let opportunitiesCreated = 0;
  const processedUrls = new Set<string>();
  
  // PRIMARY STRATEGY: Search relevant subreddits for each tracked prompt
  // This is MUCH more accurate than global search!
  for (const promptQuery of trackedPromptQueries) {
    console.log(`\n[Reddit] 📍 Searching for: "${promptQuery.searchQuery}"`);
    console.log(`[Reddit] Target subreddits: r/${promptQuery.subreddits.join(', r/')}`);

    try {
      // Use subreddit-targeted URLs for ALL languages.
      // Spanish now has its own subreddit mappings (r/programacion, r/inteligenciaartificial, etc.)
      // so we get the same precision as English. Slightly higher maxPosts for Spanish
      // since some Spanish subreddits are smaller.
      const result = await searchReddit({
        queries: [promptQuery.searchQuery],
        urls: promptQuery.searchUrls,
        maxPosts: language !== 'en' ? 30 : 20,
      });
      
      if (result.success) {
        console.log(`[Reddit] Found ${result.posts.length} posts for: "${promptQuery.searchQuery}"`);
        
        // ⭐ TWO-PASS FILTERING: collect candidates → rank → save top N
        // This prevents flooding the DB with low-relevance posts from target subreddits.
        const MAX_PER_QUERY = 8; // Save only the top 8 per query for LLM analysis
        const MIN_INITIAL_SCORE = 20; // Floor: need SOME signal beyond just being in the right subreddit

        const candidates: { post: RedditPost; queryRelevance: number; initialScore: number }[] = [];
        let filteredCount = 0;

        for (const post of result.posts) {
          // Skip already processed
          if (processedUrls.has(post.url)) continue;
          processedUrls.add(post.url);

          // Apply quality filters
          if (!isQualityRedditPost(post, {
            maxAgeDays: 90,
            minScore: 2,
            minComments: 0,
            minUpvoteRatio: 0.3,
          })) { filteredCount++; continue; }

          if (!isQualityContent(post.body || '', 'reddit')) { filteredCount++; continue; }

          // Calculate INITIAL relevance score (preliminary — LLM sets the real score)
          const queryRelevance = calculateQueryRelevance(post, promptQuery.searchQuery);

          // Fix B: Minimum keyword match — reject posts with near-zero query relevance.
          // A post must match at least ~15% of query terms to be worth saving.
          // This prevents "right subreddit, wrong topic" pollution.
          if (queryRelevance < 0.15) { filteredCount++; continue; }

          // Fix C: Rebalanced scoring — keyword match is the primary signal,
          // subreddit presence is a tiebreaker, not a free pass.
          const keywordScore = queryRelevance * 30;                                       // 0-30 (was 0-20)
          const subredditBonus = promptQuery.subreddits.includes(post.subreddit) ? 8 : 3; // 8 or 3 (was 15 or 5)
          const brandBonus = Math.min(12, calculateRelevanceBonus(post, brandContext));    // max 12 (was 15)
          const initialScore = Math.min(50, Math.round(keywordScore + subredditBonus + brandBonus));

          // Floor check: skip posts with no signal beyond subreddit presence
          if (initialScore < MIN_INITIAL_SCORE) { filteredCount++; continue; }

          candidates.push({ post, queryRelevance, initialScore });
        }

        // Rank by initial score descending, take top N
        candidates.sort((a, b) => b.initialScore - a.initialScore);
        const topCandidates = candidates.slice(0, MAX_PER_QUERY);
        const droppedCount = candidates.length - topCandidates.length;

        for (const { post, queryRelevance, initialScore } of topCandidates) {
          try {
            await createOrUpdateOpportunity({
              brandProfileId,
              post,
              platform: 'reddit',
              mode: 'proactive',
              discoveredVia: [{
                searchQuery: promptQuery.searchQuery,
                promptText: promptQuery.originalPrompt,
              }],
              searchQuery: promptQuery.searchQuery,
              initialRelevanceScore: initialScore,
              language,
            });
            opportunitiesCreated++;
            console.log(`[Reddit] ✓ Created: "${post.title?.slice(0, 50)}..." (queryMatch: ${(queryRelevance * 100).toFixed(0)}%, score: ${initialScore})`);
          } catch (error: any) {
            if (error.code !== 'P2002') {
              console.error('[Reddit] Error creating opportunity:', error.message);
            }
          }
        }

        console.log(`[Reddit] Query "${promptQuery.searchQuery}": ${topCandidates.length} saved, ${filteredCount} filtered (quality/age), ${droppedCount} dropped (rank cutoff)`);
      }
      
      // Rate limiting between searches (1.5s to avoid overwhelming Apify)
      await sleep(1500);
    } catch (error: any) {
      console.error(`[Reddit] Search failed for "${promptQuery.searchQuery}":`, error.message);
    }
  }
  
  // SECONDARY STRATEGY: Search for competitor mentions (lower priority)
  for (const query of competitorQueries.slice(0, 2)) {
    const searchUrl = buildCompetitorSearchUrl(query, {
      sort: 'relevance',
      timeframe: 'month',
    });
    
    console.log(`[Reddit] Searching competitor: "${query}"`);
    
    try {
      const result = await searchReddit({
        queries: [query],
        urls: [searchUrl],
        maxPosts: 10,
      });
      
      if (result.success) {
        for (const post of result.posts) {
          if (processedUrls.has(post.url)) continue;
          processedUrls.add(post.url);
          
          // Check relevance to competitor query (lowered threshold)
          const queryRelevance = calculateQueryRelevance(post, query);
          if (queryRelevance < 0.25) continue; // Lowered - let LLM decide
          
          if (!isQualityRedditPost(post, PROACTIVE_REDDIT_FILTERS)) continue;
          if (!isQualityContent(post.body || '', 'reddit')) continue;
          
          // Calculate INITIAL relevance with query match
          // ⚠️ Capped at 45 until LLM validation (competitor queries are lower priority)
          const queryScore = queryRelevance * 25;
          const brandBonus = Math.min(20, calculateRelevanceBonus(post, brandContext));
          const relevance = Math.min(45, Math.round(queryScore + brandBonus)); // ⚡ CAP AT 45 for competitors
          
          try {
            await createOrUpdateOpportunity({
              brandProfileId,
              post,
              platform: 'reddit',
              mode: 'proactive',
              discoveredVia: [{ searchQuery: query }],
              searchQuery: query,
              initialRelevanceScore: relevance,
              language,
            });
            opportunitiesCreated++;
            console.log(`[Reddit] ✓ Competitor match: "${post.title?.slice(0, 50)}..." (score: ${relevance})`);
          } catch (error: any) {
            if (error.code !== 'P2002') {
              console.error('[Reddit] Error:', error.message);
            }
          }
        }
      }
      
      await sleep(500);
    } catch (error: any) {
      console.error(`[Reddit] Competitor search failed for "${query}":`, error.message);
    }
  }
  
  return opportunitiesCreated;
}

/**
 * Calculate a relevance bonus based on post content matching brand context
 * This is ADDITIVE to the base relevance score
 */
function calculateRelevanceBonus(
  post: RedditPost,
  brandContext: BrandContext
): number {
  let bonus = 0;
  
  const content = `${post.title} ${post.body}`.toLowerCase();
  
  // Bonus for company name mention
  if (brandContext.companyName && content.includes(brandContext.companyName.toLowerCase())) {
    bonus += 20;
  }
  
  // Bonus for competitor mentions (opportunity to respond!)
  for (const competitor of brandContext.competitors) {
    if (competitor && content.includes(competitor.toLowerCase())) {
      bonus += 15;
      break;
    }
  }
  
  // Bonus for question patterns (people seeking recommendations)
  const questionPatterns = [
    /\brecommend\b/i,
    /\bsuggestion/i,
    /\balternative/i,
    /\bwhich.*tool/i,
    /\bwhat.*use/i,
    /\bhow.*do.*you/i,
    /\bbest.*for/i,
    /\bcompare/i,
    /\blooking for/i,
  ];
  
  for (const pattern of questionPatterns) {
    if (pattern.test(content)) {
      bonus += 10;
      break;
            }
          }
  
  // Bonus for high engagement (more visibility)
  if (post.num_comments >= 20) bonus += 5;
  if (post.score >= 50) bonus += 5;
  
  return bonus;
}


// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

interface CreateOpportunityInput {
  brandProfileId: number;
  post: RedditPost;
  platform: 'reddit';
  mode: 'cited' | 'proactive';
  discoveredVia: DiscoveredViaItem[];
  searchQuery?: string;
  initialRelevanceScore?: number;
  language: 'en' | 'es';
}

/**
 * Create or update a conversation opportunity in the database
 */
async function createOrUpdateOpportunity(input: CreateOpportunityInput) {
  const { brandProfileId, post, platform, mode, discoveredVia, searchQuery, initialRelevanceScore, language } = input;
  
  const redditPost = post as RedditPost;
  
  // Build engagement string
  const engagementString = `${redditPost.score} upvotes · ${redditPost.num_comments} comments`;
  
  // Get post URL
  const postUrl = redditPost.url;
  
  // Parse post creation date
  let postCreatedAt: Date | undefined;
  if (redditPost.created_utc) {
    postCreatedAt = new Date(redditPost.created_utc);
  }
  
  // Quality score for sorting
  const qualityScore = calculateQualityScore(post, platform);
  
  return prisma.conversationOpportunity.upsert({
    where: {
      brandProfileId_postUrl_language: {
        brandProfileId,
        postUrl,
        language,
      },
    },
    create: {
      brandProfileId,
      postUrl,
      postId: redditPost.id,
      platform,
      postTitle: redditPost.title,
      postBody: redditPost.body,
      postAuthor: redditPost.author,
      subreddit: redditPost.subreddit,
      score: redditPost.score,
      numComments: redditPost.num_comments,
      upvoteRatio: redditPost.upvote_ratio,
      engagementString,
      mode,
      discoveredVia: discoveredVia as any,
      searchQuery,
      postCreatedAt,
      status: 'new',
      language,
      // Store initial relevance if provided (will be updated by LLM analysis)
      relevanceScore: initialRelevanceScore,
      qualityScore,
    },
    update: {
      // Update engagement metrics on subsequent runs
      score: redditPost.score,
      numComments: redditPost.num_comments,
      upvoteRatio: redditPost.upvote_ratio,
      engagementString,
      qualityScore,
      updatedAt: new Date(),
    },
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get opportunities for a brand
 */
export async function getOpportunities(
  brandProfileId: number,
  options: {
    status?: string;
    mode?: 'cited' | 'proactive';
    platform?: 'reddit';
    limit?: number;
    offset?: number;
    minRelevanceScore?: number; // Filter to only show high-relevance opportunities
    includeAll?: boolean; // For "All opportunities" view - includes all scores
  } = {}
) {
  const { status = 'new', mode, platform, limit = 50, offset = 0, minRelevanceScore = 75, includeAll = false } = options;
  
  const where: any = { brandProfileId };
  
  if (status !== 'all') {
    where.status = status;
  }
  
  if (mode) {
    where.mode = mode;
  }
  
  if (platform) {
    where.platform = platform;
  }

  // Only show high-relevance opportunities by default (70%+)
  // Unless includeAll is true (for "All opportunities" view)
  if (!includeAll && minRelevanceScore > 0) {
    where.relevanceScore = { gte: minRelevanceScore };
  }
  
  return prisma.conversationOpportunity.findMany({
    where,
    orderBy: [
      { relevanceScore: 'desc' },
      { postCreatedAt: 'desc' },
    ],
    take: limit,
    skip: offset,
  });
}

/**
 * Get a single opportunity by ID
 */
export async function getOpportunityById(opportunityId: number) {
  return prisma.conversationOpportunity.findUnique({
    where: { id: opportunityId },
  });
}

/**
 * Get a single opportunity formatted for the frontend
 */
export async function getOpportunityForFrontend(opportunityId: number) {
  const opp = await getOpportunityById(opportunityId);
  if (!opp) return null;
  
  return {
    id: `opp-${opp.id}`,
    dbId: opp.id,
    title: buildOpportunityTitle(opp),
    description: opp.conversationSnapshot || (opp.postBody?.slice(0, 150) + '...' || 'No description'),
    impact: calculateImpact(opp.relevanceScore),
    status: mapStatus(opp.status),
    lastActivity: opp.updatedAt,
    url: opp.postUrl,
    platform: 'Reddit',
    postedAt: opp.postCreatedAt,
    engagement: { upvotes: opp.score ?? undefined, comments: opp.numComments ?? undefined },
    promptOrigin: opp.mode === 'cited' ? 'tracked' : 'search',
    trackedPrompt: opp.mode === 'cited' 
      ? (opp.discoveredVia as any)?.[0]?.promptText 
      : undefined,
    searchQuery: opp.mode === 'proactive' ? opp.searchQuery : undefined,
    relevanceScore: opp.relevanceScore,
    // LLM-generated insights
    conversationSnapshot: opp.conversationSnapshot,
    whyThisMatters: opp.whyThisMatters as string[] | null,
    suggestedAngle: opp.suggestedAngle,
    isPromotionalOpportunity: opp.isPromotionalOpportunity,
    promotionalReason: opp.promotionalReason,
    // Additional metadata
    subreddit: opp.subreddit,
    mode: opp.mode,
    postTitle: opp.postTitle,
    postBody: opp.postBody,
    score: opp.score,
    numComments: opp.numComments,
  };
}

/**
 * Update opportunity status
 */
export async function updateOpportunityStatus(
  opportunityId: number,
  status: 'new' | 'reviewed' | 'engaged' | 'dismissed',
  dismissReason?: string
) {
  const data: any = { status };
  
  if (status === 'engaged') {
    data.engagedAt = new Date();
  } else if (status === 'dismissed') {
    data.dismissedAt = new Date();
    data.dismissReason = dismissReason;
  }
  
  return prisma.conversationOpportunity.update({
    where: { id: opportunityId },
    data,
  });
}

/**
 * Get the latest analysis run for a brand
 */
export async function getLatestAnalysisRun(brandProfileId: number, country?: string) {
  return prisma.analysisRun.findFirst({
    where: { brandProfileId, ...(country ? { country } : {}) },
    orderBy: { ranAt: 'desc' },
  });
}

// ============================================================================
// LLM ANALYSIS
// ============================================================================

/**
 * Analyze a single opportunity using the Conversation Radar Agent
 * Updates the opportunity with AI-generated insights
 */
export async function analyzeOpportunity(opportunityId: number): Promise<OpportunityAnalysis> {
  // 1. Get opportunity and brand context
  const opportunity = await prisma.conversationOpportunity.findUnique({
    where: { id: opportunityId },
    include: {
      brandProfile: {
        include: { prompts: { where: { isActive: true } } },
      },
    },
  });
  
  if (!opportunity) {
    throw new Error(`Opportunity ${opportunityId} not found`);
  }
  
  // 2. Build brand context
  const brandContext = {
    companyName: opportunity.brandProfile.companyName || '',
    companyDescription: opportunity.brandProfile.companyDescription,
    companyICP: opportunity.brandProfile.companyICP,
    companyIndustry: opportunity.brandProfile.companyIndustry,
    competitors: opportunity.brandProfile.competitors?.split(',').map(c => c.trim()).filter(Boolean) || [],
    trackedPrompts: opportunity.brandProfile.prompts.map(p => p.text),
  };
  
  // 3. Analyze with agent
  console.log(`[Conversation Radar] Analyzing opportunity ${opportunityId} with LLM...`);
  
  const analysis = await analyzeOpportunityWithAgent(
    {
      platform: 'reddit' as const,
      postTitle: opportunity.postTitle,
      postBody: opportunity.postBody,
      subreddit: opportunity.subreddit,
      engagementString: opportunity.engagementString,
      postCreatedAt: opportunity.postCreatedAt,
      mode: opportunity.mode as 'cited' | 'proactive',
      discoveredVia: opportunity.discoveredVia,
    },
    brandContext
  );
  
  // 4. Update opportunity with analysis
  await prisma.conversationOpportunity.update({
    where: { id: opportunityId },
    data: {
      conversationSnapshot: analysis.conversationSnapshot,
      whyThisMatters: analysis.whyThisMatters,
      suggestedAngle: analysis.suggestedAngle,
      isPromotionalOpportunity: analysis.isPromotionalOpportunity,
      promotionalReason: analysis.promotionalReason,
      relevanceScore: analysis.relevanceScore,
      impact: analysis.impact,
      engagementTiming: analysis.engagementTiming,
      warningFlags: analysis.warningFlags,
    },
  });

  console.log(`[Conversation Radar] Analysis complete for ${opportunityId}: relevance=${analysis.relevanceScore}`);
  
  return analysis;
}

/**
 * Analyze multiple unanalyzed opportunities for a brand
 * Returns the number of opportunities analyzed
 */
export async function analyzeNewOpportunities(
  brandProfileId: number,
  options: {
    limit?: number;
    minRelevanceScore?: number;  // Only analyze opportunities with initial score above this
    language?: 'en' | 'es';
  } = {}
): Promise<{ analyzed: number; errors: number }> {
  const { limit = 10, minRelevanceScore = 0, language } = options;

  // Get unanalyzed opportunities
  const opportunities = await prisma.conversationOpportunity.findMany({
    where: {
      brandProfileId,
      conversationSnapshot: null, // Not yet analyzed
      relevanceScore: minRelevanceScore > 0
        ? { gte: minRelevanceScore }
        : undefined,
      ...(language ? { language } : {}),
    },
    include: {
      brandProfile: {
        include: { prompts: { where: { isActive: true } } },
      },
    },
    take: limit,
    orderBy: [
      { mode: 'asc' }, // Cited first (higher priority)
      { relevanceScore: 'desc' }, // Then by initial relevance
    ],
  });
  
  if (opportunities.length === 0) {
    console.log('[Conversation Radar] No unanalyzed opportunities found');
    return { analyzed: 0, errors: 0 };
  }
  
  console.log(`[Conversation Radar] Analyzing ${opportunities.length} opportunities...`);
  
  // Build brand context (same for all opportunities)
  const firstOpp = opportunities[0];
  const brandContext = {
    companyName: firstOpp.brandProfile.companyName || '',
    companyDescription: firstOpp.brandProfile.companyDescription,
    companyICP: firstOpp.brandProfile.companyICP,
    companyIndustry: firstOpp.brandProfile.companyIndustry,
    competitors: firstOpp.brandProfile.competitors?.split(',').map(c => c.trim()).filter(Boolean) || [],
    trackedPrompts: firstOpp.brandProfile.prompts.map(p => p.text),
  };
  
  // Batch analyze
  const results = await batchAnalyzeOpportunities(
    opportunities.map(opp => ({
      id: opp.id,
      platform: 'reddit' as const,
      postTitle: opp.postTitle,
      postBody: opp.postBody,
      subreddit: opp.subreddit,
      engagementString: opp.engagementString,
      postCreatedAt: opp.postCreatedAt,
      mode: opp.mode as 'cited' | 'proactive',
      discoveredVia: opp.discoveredVia,
    })),
    brandContext
  );
  
  // Update database with results
  let analyzed = 0;
  let relevant = 0;
  let errors = 0;

  for (const [id, analysis] of results) {
    try {
      await prisma.conversationOpportunity.update({
        where: { id },
        data: {
          conversationSnapshot: analysis.conversationSnapshot,
          whyThisMatters: analysis.whyThisMatters,
          suggestedAngle: analysis.suggestedAngle,
          isPromotionalOpportunity: analysis.isPromotionalOpportunity,
          promotionalReason: analysis.promotionalReason,
          relevanceScore: analysis.relevanceScore,
          impact: analysis.impact,
          engagementTiming: analysis.engagementTiming,
          warningFlags: analysis.warningFlags,
        },
      });
      analyzed++;
      if (analysis.relevanceScore >= 75) relevant++;
    } catch (error) {
      console.error(`[Conversation Radar] Failed to update opportunity ${id}:`, error);
      errors++;
    }
  }

  console.log(`[Conversation Radar] Analysis complete: ${analyzed} analyzed (${relevant} relevant), ${errors} errors`);

  // Notification: only count opportunities visible in the default "Active" view (70%+ relevance)
  if (relevant > 0) {
    try {
      const profile = await prisma.brandProfile.findUnique({
        where: { id: brandProfileId },
        select: { userId: true },
      });
      if (profile?.userId) {
        const { createNotification } = await import('./notification.service');
        await createNotification({
          userId: profile.userId,
          brandProfileId,
          type: 'info',
          category: 'radar_opportunity',
          title: `${relevant} New Conversation ${relevant === 1 ? 'Opportunity' : 'Opportunities'}`,
          message: `We found ${relevant} new Reddit conversations relevant to your brand.`,
          actionUrl: '/dashboard/conversation-radar',
          metadata: { analyzed, relevant, errors },
        });
      }
    } catch (e) { console.warn('[Notification] Failed to create radar notification:', e); }
  }

  return { analyzed, errors };
}

/**
 * Get opportunities formatted for the frontend
 */
export async function getOpportunitiesForFrontend(
  brandProfileId: number,
  options: {
    status?: string;
    mode?: 'cited' | 'proactive';
    platform?: 'reddit';
    limit?: number;
    offset?: number;
    minRelevanceScore?: number;
    includeAll?: boolean;
  } = {}
) {
  const opportunities = await getOpportunities(brandProfileId, options);
  
  return opportunities.map(opp => ({
    id: `opp-${opp.id}`,
    dbId: opp.id,
    title: buildOpportunityTitle(opp),
    description: opp.conversationSnapshot || (opp.postBody?.slice(0, 150) + '...' || 'No description'),
    impact: calculateImpact(opp.relevanceScore),
    status: mapStatus(opp.status),
    lastActivity: opp.updatedAt,
    url: opp.postUrl,
    platform: 'Reddit',
    postedAt: opp.postCreatedAt,
    engagement: { upvotes: opp.score ?? undefined, comments: opp.numComments ?? undefined },
    promptOrigin: opp.mode === 'cited' ? 'tracked' : 'search',
    trackedPrompt: opp.mode === 'cited' 
      ? (opp.discoveredVia as any)?.[0]?.promptText 
      : undefined,
    searchQuery: opp.mode === 'proactive' ? opp.searchQuery : undefined,
    relevanceScore: opp.relevanceScore,
    whyThisMatters: opp.whyThisMatters as string[] | null,
    suggestedAngle: opp.suggestedAngle,
    isPromotionalOpportunity: opp.isPromotionalOpportunity,
    promotionalReason: opp.promotionalReason,
    subreddit: opp.subreddit,
    mode: opp.mode,
  }));
}

/**
 * Build a title for the opportunity
 */
function buildOpportunityTitle(opp: any): string {
  const subredditPart = opp.subreddit ? `r/${opp.subreddit}` : '';
  
  if (opp.postTitle) {
    // Don't truncate titles at the source; let the UI wrap/tooltip as needed.
    return `Reddit: ${opp.postTitle}`;
  }
  
  if (subredditPart) {
    return `Reddit: Discussion in ${subredditPart}`;
  }
  
  return `Reddit: Conversation opportunity`;
}

/**
 * Calculate impact level from relevance score
 */
function calculateImpact(score?: number | null): 'High' | 'Medium' | 'Low' {
  if (!score) return 'Medium';
  if (score >= 70) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
}

/**
 * Map internal status to frontend status
 */
function mapStatus(status: string): 'running' | 'queued' | 'completed' | 'failed' {
  switch (status) {
    case 'new': return 'queued';
    case 'reviewed': return 'completed';
    case 'engaged': return 'completed';
    case 'dismissed': return 'failed';
    default: return 'queued';
  }
}

