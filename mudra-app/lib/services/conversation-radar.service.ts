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
} from '@/mastra/agents/conversation-radar-agent';
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
  options: { maxCitations?: number } = {}
): Promise<ProcessingStats> {
  const { maxCitations = 2 } = options; // Default: 2 citations per run
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
  
  // 4. Filter out URLs that already have opportunities (to avoid re-processing)
  const existingOpportunities = await prisma.conversationOpportunity.findMany({
    where: {
      brandProfileId,
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
  brandProfileId: number
): Promise<ProactiveSearchStats> {
  const stats: ProactiveSearchStats = { reddit: 0, total: 0, queries: [] };
  
  console.log(`[Proactive Radar] Starting for brand ${brandProfileId}`);
  
  // 1. Get brand context with tracked prompts
  const brandProfile = await prisma.brandProfile.findUnique({
    where: { id: brandProfileId },
    include: { prompts: { where: { isActive: true } } },
  });
  
  if (!brandProfile) {
    throw new Error(`Brand profile ${brandProfileId} not found`);
  }
  
  const brandContext: BrandContext = {
    companyName: brandProfile.companyName || '',
    companyDescription: brandProfile.companyDescription,
    companyICP: brandProfile.companyICP,
    companyIndustry: brandProfile.companyIndustry,
    competitors: brandProfile.competitors?.split(',').map(c => c.trim()).filter(Boolean) || [],
    trackedPrompts: brandProfile.prompts.map(p => p.text),
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
  
  // 2. Generate search queries from tracked prompts
  const queries = generateSearchQueries(brandContext);
  console.log(`[Proactive Radar] Generated ${queries.trackedPromptQueries.length} tracked prompt queries`);
  
  // ⚡ CREDIT OPTIMIZATION: Process only 1 tracked prompt per run
  // This prevents burning through all prompts at once
  // The scheduler/cron will rotate through prompts over time
  const MAX_QUERIES_PER_RUN = 1;
  const limitedPromptQueries = queries.trackedPromptQueries.slice(0, MAX_QUERIES_PER_RUN);
  const limitedCompetitorQueries: string[] = []; // Skip competitor queries to save credits
  
  console.log(`[Proactive Radar] ⚡ Processing ${limitedPromptQueries.length}/${queries.trackedPromptQueries.length} queries (credit limit)`);
  
  // 3. Search Reddit using tracked prompts directly
  const redditOpportunities = await searchRedditWithTrackedPrompts(
    brandProfileId,
    limitedPromptQueries,
    limitedCompetitorQueries,
    brandContext
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
  brandContext: BrandContext
): Promise<number> {
  let opportunitiesCreated = 0;
  const processedUrls = new Set<string>();
  
  // PRIMARY STRATEGY: Search relevant subreddits for each tracked prompt
  // This is MUCH more accurate than global search!
  for (const promptQuery of trackedPromptQueries) {
    console.log(`\n[Reddit] 📍 Searching for: "${promptQuery.searchQuery}"`);
    console.log(`[Reddit] Target subreddits: r/${promptQuery.subreddits.join(', r/')}`);
    
    try {
      // Search all relevant subreddits (URLs are pre-built in query generator)
      // ⚡ CREDIT OPTIMIZATION: Reduced from 50 to 20 posts per search
      const result = await searchReddit({
        urls: promptQuery.searchUrls,
        maxPosts: 20, // Reduced to save Apify credits
      });
      
      if (result.success) {
        console.log(`[Reddit] Found ${result.posts.length} posts for: "${promptQuery.searchQuery}"`);
        
        // Track stats for logging
        let relevantCount = 0;
        let irrelevantCount = 0;
        
        for (const post of result.posts) {
          // Skip already processed
          if (processedUrls.has(post.url)) continue;
          processedUrls.add(post.url);
          
          // ⭐ STAGE 1: Minimal keyword filtering (just spam protection)
          // LOWERED to 20% - keyword matching misses semantic relevance!
          // Example: "document annotation" vs "data annotation" = 0% keyword match
          // but 90% semantic relevance. Let the LLM (Stage 2) decide!
          const queryRelevance = calculateQueryRelevance(post, promptQuery.searchQuery);
          
          if (queryRelevance < 0.20) {
            // Only skip posts with almost NO keyword overlap
            // The LLM will filter out truly irrelevant ones
            irrelevantCount++;
            continue;
          }
          
          // Apply quality filters
          // Max 90 days (3 months) - older posts aren't worth engaging with
          if (!isQualityRedditPost(post, {
            maxAgeDays: 90,  // 3 months max - don't engage on old posts
            minScore: 2,     // Lower threshold - relevance matters more than popularity
            minComments: 0,  // Even no comments is fine if relevant
            minUpvoteRatio: 0.3,
          })) continue;
          
          if (!isQualityContent(post.body || '', 'reddit')) continue;
          
          // Calculate INITIAL relevance score (preliminary only)
          // ⚠️ IMPORTANT: This is just a preliminary score!
          // The REAL relevance score comes from LLM analysis (Stage 2)
          // 
          // Scoring:
          // - Keyword match: up to 20 points (not reliable for semantic relevance)
          // - Subreddit bonus: up to 15 points (r/MachineLearning = relevant)
          // - Brand context: up to 15 points (mentions company, ICP terms)
          const keywordScore = queryRelevance * 20;
          const subredditBonus = promptQuery.subreddits.includes(post.subreddit) ? 15 : 5;
          const brandBonus = Math.min(15, calculateRelevanceBonus(post, brandContext));
          const relevance = Math.min(50, Math.round(keywordScore + subredditBonus + brandBonus)); // ⚡ CAP AT 50
          
          relevantCount++;
          
          try {
            await createOrUpdateOpportunity({
              brandProfileId,
              post,
              platform: 'reddit',
              mode: 'proactive',
              discoveredVia: [{ 
                searchQuery: promptQuery.searchQuery,
                promptText: promptQuery.originalPrompt, // Store the original tracked prompt
              }],
              searchQuery: promptQuery.searchQuery,
              initialRelevanceScore: relevance,
            });
            opportunitiesCreated++;
            console.log(`[Reddit] ✓ Created: "${post.title?.slice(0, 50)}..." (queryMatch: ${(queryRelevance * 100).toFixed(0)}%, score: ${relevance})`);
          } catch (error: any) {
            if (error.code !== 'P2002') {
              console.error('[Reddit] Error creating opportunity:', error.message);
            }
          }
        }
        
        console.log(`[Reddit] Query "${promptQuery.searchQuery}": ${relevantCount} relevant, ${irrelevantCount} filtered out`);
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
}

/**
 * Create or update a conversation opportunity in the database
 */
async function createOrUpdateOpportunity(input: CreateOpportunityInput) {
  const { brandProfileId, post, platform, mode, discoveredVia, searchQuery, initialRelevanceScore } = input;
  
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
      brandProfileId_postUrl: {
        brandProfileId,
        postUrl,
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
      // Store initial relevance if provided (will be updated by LLM analysis)
      relevanceScore: initialRelevanceScore,
    },
    update: {
      // Update engagement metrics on subsequent runs
      score: redditPost.score,
      numComments: redditPost.num_comments,
      upvoteRatio: redditPost.upvote_ratio,
      engagementString,
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
  const { status = 'new', mode, platform, limit = 50, offset = 0, minRelevanceScore = 70, includeAll = false } = options;
  
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
export async function getLatestAnalysisRun(brandProfileId: number) {
  return prisma.analysisRun.findFirst({
    where: { brandProfileId },
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
  } = {}
): Promise<{ analyzed: number; errors: number }> {
  const { limit = 10, minRelevanceScore = 0 } = options;
  
  // Get unanalyzed opportunities
  const opportunities = await prisma.conversationOpportunity.findMany({
    where: {
      brandProfileId,
      conversationSnapshot: null, // Not yet analyzed
      relevanceScore: minRelevanceScore > 0 
        ? { gte: minRelevanceScore } 
        : undefined,
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
        },
      });
      analyzed++;
    } catch (error) {
      console.error(`[Conversation Radar] Failed to update opportunity ${id}:`, error);
      errors++;
    }
  }
  
  console.log(`[Conversation Radar] Analysis complete: ${analyzed} analyzed, ${errors} errors`);
  
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

