/**
 * Cron Service - Automated Daily Analysis Execution
 *
 * Runs for active brand profiles with cronEnabled=true and is designed to
 * guarantee at least one completed run per UTC day via retries + catch-up.
 */

import cron from 'node-cron';
import { prisma } from '@/lib/prisma';
import { runUnifiedAnalysis } from './unified-analysis.service';
import { getDeltaAnalysis } from './delta-analysis.service';
import { generateLlmsTxtForBrand, shouldRegenerateLlmsTxt } from './llms-txt-generator.service';
import { verifyDeployment } from './llms-txt-deployment.service';
import { recoverStaleRunningAnalysisRuns } from './analysis-run.service';

let isInitialized = false;
let cronJob: cron.ScheduledTask | null = null;
let catchupCronJob: cron.ScheduledTask | null = null;
let llmsTxtCronJob: cron.ScheduledTask | null = null;

const ANALYSIS_RETRY_CONFIG = {
  maxAttempts: 3,
  backoffMs: [10_000, 30_000],
  staleRunMinutes: 20,
  interProfileDelayMs: 15_000,
};

interface CronExecutionLog {
  timestamp: Date;
  brandProfilesProcessed: number;
  successful: number;
  failed: number;
  errors: string[];
  deltas?: Array<{
    brandProfileId: number;
    companyName: string;
    improvement: boolean;
    degradation: boolean;
    changes: string[];
  }>;
}

interface ExecuteAnalysisOptions {
  onlyMissingToday?: boolean;
  runContentOptimizer?: boolean;
}

function getUtcDayBounds(date: Date = new Date()): { dayStartUtc: Date; nextDayStartUtc: Date } {
  const dayStartUtc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const nextDayStartUtc = new Date(dayStartUtc);
  nextDayStartUtc.setUTCDate(nextDayStartUtc.getUTCDate() + 1);
  return { dayStartUtc, nextDayStartUtc };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute analysis for brand profiles with cron enabled.
 * In catch-up mode, only processes brands missing a completed run today (UTC).
 */
export async function executeWeeklyAnalysis(options: ExecuteAnalysisOptions = {}): Promise<CronExecutionLog> {
  const onlyMissingToday = options.onlyMissingToday ?? false;
  const runContentOptimizer = options.runContentOptimizer ?? !onlyMissingToday;
  const jobType = onlyMissingToday ? 'analysis_catchup' : 'weekly_analysis';

  const startTime = Date.now();
  const log: CronExecutionLog = {
    timestamp: new Date(),
    brandProfilesProcessed: 0,
    successful: 0,
    failed: 0,
    errors: [],
  };

  console.log(`🔄 [CRON] Starting ${onlyMissingToday ? 'catch-up' : 'daily primary'} analysis job...`);

  try {
    // Recover stale runs globally first so they don't block "one completed run per day" tracking.
    await recoverStaleRunningAnalysisRuns({ olderThanMinutes: ANALYSIS_RETRY_CONFIG.staleRunMinutes });

    const { dayStartUtc, nextDayStartUtc } = getUtcDayBounds();

    // Fetch cron-eligible brand profiles (must have cronEnabled=true and at least one prior analysis)
    const brandProfiles = await prisma.brandProfile.findMany({
      where: {
        cronEnabled: true,
        analysisRuns: {
          some: {},
        },
        ...(onlyMissingToday ? {
          NOT: {
            analysisRuns: {
              some: {
                status: 'completed',
                completedAt: {
                  gte: dayStartUtc,
                  lt: nextDayStartUtc,
                },
              },
            },
          },
        } : {}),
      },
      select: {
        id: true,
        companyName: true,
        companyWebsite: true,
        companyDescription: true,
        companyIndustry: true,
        competitors: true,
        userId: true,
        createdAt: true,
        trackingCountries: true,
      },
      orderBy: {
        createdAt: 'asc', // Process oldest first
      },
    });

    log.brandProfilesProcessed = brandProfiles.length;
    console.log(`📊 [CRON] Found ${brandProfiles.length} brand profiles to process (${onlyMissingToday ? 'missing run today' : 'all eligible'})`);

    const deltas: Array<{
      brandProfileId: number;
      companyName: string;
      improvement: boolean;
      degradation: boolean;
      changes: string[];
    }> = [];

    // Process each brand profile sequentially to avoid API rate limits.
    for (const [index, profile] of brandProfiles.entries()) {
      console.log(`🔍 [CRON] Processing brand: ${profile.companyName} (ID: ${profile.id})`);

      // Skip if missing required data
      if (!profile.companyName || !profile.companyWebsite) {
        console.log(`⚠️ [CRON] Skipping ${profile.companyName || 'Unknown'} - missing required data`);
        log.failed++;
        continue;
      }

      // Recover stale runs for this profile before each attempt.
      await recoverStaleRunningAnalysisRuns({
        brandProfileId: profile.id,
        olderThanMinutes: ANALYSIS_RETRY_CONFIG.staleRunMinutes,
      });

      let lastError = 'Unknown error';
      let succeeded = false;

      for (let attempt = 1; attempt <= ANALYSIS_RETRY_CONFIG.maxAttempts; attempt++) {
        try {
          const countries = profile.trackingCountries && profile.trackingCountries.length > 0
            ? profile.trackingCountries
            : ['US'];

          const result = await runUnifiedAnalysis({
            brandProfileId: profile.id,
            brandName: profile.companyName,
            website: profile.companyWebsite,
            description: profile.companyDescription || undefined,
            industry: profile.companyIndustry || undefined,
            competitors: profile.competitors ? profile.competitors.split(',').map(c => c.trim()) : undefined,
            skipCooldown: true,
            generateReport: false,
            countries,
          });

          if (!result.success) {
            throw new Error(result.error || 'Unknown error');
          }

          succeeded = true;
          log.successful++;
          console.log(`✅ [CRON] Successfully analyzed ${profile.companyName} on attempt ${attempt}/${ANALYSIS_RETRY_CONFIG.maxAttempts}`);

          try {
            const deltaResult = await getDeltaAnalysis(profile.id);
            deltas.push({
              brandProfileId: profile.id,
              companyName: profile.companyName,
              improvement: deltaResult.hasImprovement,
              degradation: deltaResult.hasDegradation,
              changes: deltaResult.delta?.significantChanges || [],
            });

            if (deltaResult.delta) {
              console.log(`📊 [CRON] Delta for ${profile.companyName}:`, {
                geoChange: deltaResult.delta.geoScoreChange.toFixed(1),
                techChange: deltaResult.delta.technicalScoreChange.toFixed(1),
                changes: deltaResult.delta.significantChanges.length,
              });
            }
          } catch (deltaError) {
            console.warn(`⚠️ [CRON] Could not calculate delta for ${profile.companyName}:`, deltaError);
          }

          break;
        } catch (error) {
          lastError = error instanceof Error ? error.message : 'Unknown error';
          console.error(`❌ [CRON] Attempt ${attempt}/${ANALYSIS_RETRY_CONFIG.maxAttempts} failed for ${profile.companyName}: ${lastError}`);

          if (attempt < ANALYSIS_RETRY_CONFIG.maxAttempts) {
            const backoffMs = ANALYSIS_RETRY_CONFIG.backoffMs[attempt - 1] ?? ANALYSIS_RETRY_CONFIG.backoffMs[ANALYSIS_RETRY_CONFIG.backoffMs.length - 1];
            console.log(`⏳ [CRON] Retrying ${profile.companyName} in ${Math.round(backoffMs / 1000)}s...`);
            await sleep(backoffMs);
          }
        }
      }

      if (!succeeded) {
        log.failed++;
        log.errors.push(`${profile.companyName}: ${lastError}`);
        console.error(`❌ [CRON] Failed to analyze ${profile.companyName} after ${ANALYSIS_RETRY_CONFIG.maxAttempts} attempts: ${lastError}`);
      }

      // Add delay between profiles to prevent API throttling.
      if (index < brandProfiles.length - 1) {
        console.log(`⏳ [CRON] Waiting ${Math.round(ANALYSIS_RETRY_CONFIG.interProfileDelayMs / 1000)}s before next profile...`);
        await sleep(ANALYSIS_RETRY_CONFIG.interProfileDelayMs);
      }
    }

    log.deltas = deltas;

    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    console.log(`✅ [CRON] ${onlyMissingToday ? 'Catch-up analysis' : 'Primary analysis'} completed in ${duration} minutes`);
    console.log(`📊 [CRON] Results: ${log.successful} successful, ${log.failed} failed`);
    
    // Log delta summary
    const improved = deltas.filter(d => d.improvement).length;
    const declined = deltas.filter(d => d.degradation).length;
    console.log(`📈 [CRON] Deltas: ${improved} improved, ${declined} declined`);

    if (runContentOptimizer) {
      try {
        await executeContentOptimizerAgents();
      } catch (agentError) {
        console.error('⚠️ [CRON] Content Optimizer execution failed:', agentError);
        log.errors.push(`Content Optimizer: ${agentError instanceof Error ? agentError.message : 'Unknown error'}`);
      }
    }
  } catch (error) {
    console.error('❌ [CRON] Fatal error during weekly analysis:', error);
    log.errors.push(`Fatal: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Store execution log in database for audit trail
  try {
    await prisma.cronExecutionLog.create({
      data: {
        jobType,
        executedAt: log.timestamp,
        profilesProcessed: log.brandProfilesProcessed,
        successful: log.successful,
        failed: log.failed,
        errors: log.errors,
        duration: Math.round((Date.now() - startTime) / 1000),
      },
    });
  } catch (logError) {
    console.error('⚠️ [CRON] Failed to store execution log:', logError);
  }

  return log;
}

/**
 * Catch-up pass to ensure each brand gets at least one completed run per UTC day.
 */
export async function executeDailyCatchupAnalysis(): Promise<CronExecutionLog> {
  return executeWeeklyAnalysis({
    onlyMissingToday: true,
    runContentOptimizer: false,
  });
}

/**
 * Execute Content Optimizer agents for all deployed & enabled instances
 * Runs after weekly analysis to optimize low-scoring pages
 */
async function executeContentOptimizerAgents(): Promise<void> {
  console.log('🤖 [CRON] Starting Content Optimizer agent execution...');

  try {
    // Find all deployed Content Optimizer agents that are active
    const deployedAgents = await prisma.deployedAgent.findMany({
      where: {
        agentType: 'content_optimizer',
        status: 'active',
      },
      include: {
        brandProfile: true,
      },
    });

    if (deployedAgents.length === 0) {
      console.log('📭 [CRON] No active Content Optimizer agents found');
      return;
    }

    console.log(`🔍 [CRON] Found ${deployedAgents.length} active Content Optimizer agents`);

    // Dynamically import the agent to avoid circular dependencies
    const { ContentOptimizerAgent } = await import('@/lib/agents/content-optimizer-agent');

    for (const deployed of deployedAgents) {
      if (!deployed.brandProfile) {
        console.log(`⚠️ [CRON] Skipping agent ${deployed.id} - no brand profile`);
        continue;
      }

      const brandProfileId = deployed.brandProfileId;
      const companyName = deployed.brandProfile.companyName || 'Unknown';

      // Check if agent has GitHub repo configured
      const agentSchedule = await prisma.agentSchedule.findFirst({
        where: {
          brandProfileId,
          agentType: 'content_optimizer',
          isEnabled: true,
        },
      });

      if (!agentSchedule?.config) {
        console.log(`⚠️ [CRON] Skipping ${companyName} - no repo configured`);
        continue;
      }

      const config = agentSchedule.config as Record<string, unknown>;
      if (!config.githubRepo) {
        console.log(`⚠️ [CRON] Skipping ${companyName} - githubRepo not set`);
        continue;
      }

      console.log(`🔧 [CRON] Running Content Optimizer for ${companyName}...`);

      try {
        const agent = new ContentOptimizerAgent({ brandProfileId });
        const result = await agent.run({ maxPages: 10 }); // Limit to 10 pages per weekly run

        if (result.success) {
          const data = result.data as { optimizedPages?: unknown[]; successfulOptimizations?: number };
          console.log(`✅ [CRON] Content Optimizer succeeded for ${companyName}: ${data.successfulOptimizations || 0} PRs created`);
          
          // Update last executed timestamp
          await prisma.deployedAgent.update({
            where: { id: deployed.id },
            data: { lastExecutedAt: new Date() },
          });
        } else {
          console.error(`❌ [CRON] Content Optimizer failed for ${companyName}: ${result.error}`);
        }
      } catch (agentError) {
        console.error(`❌ [CRON] Exception in Content Optimizer for ${companyName}:`, agentError);
      }

      // Add delay between agents to prevent API throttling (10 seconds)
      if (deployedAgents.indexOf(deployed) < deployedAgents.length - 1) {
        console.log('⏳ [CRON] Waiting 10s before next agent...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }

    console.log('✅ [CRON] Content Optimizer execution completed');
  } catch (error) {
    console.error('❌ [CRON] Error executing Content Optimizer agents:', error);
    throw error;
  }
}

/**
 * Execute monthly llms.txt refresh for all brand profiles with deployed llms.txt agents
 * Per checklist: "Monthly refresh: cron runs end of month; regenerates if site changed"
 */
export async function executeLlmsTxtRefresh(): Promise<{
  timestamp: Date;
  profilesProcessed: number;
  regenerated: number;
  skipped: number;
  errors: string[];
}> {
  const startTime = Date.now();
  const log = {
    timestamp: new Date(),
    profilesProcessed: 0,
    regenerated: 0,
    skipped: 0,
    errors: [] as string[],
  };

  console.log('🔄 [CRON] Starting monthly llms.txt refresh job...');

  try {
    // Find all brand profiles with deployed llms.txt agents
    const deployedAgents = await prisma.deployedAgent.findMany({
      where: {
        agentType: 'llms-txt-indexer',
        status: 'active',
      },
      include: {
        brandProfile: true,
      },
    });

    log.profilesProcessed = deployedAgents.length;
    console.log(`📊 [CRON] Found ${deployedAgents.length} deployed llms.txt agents`);

    for (const agent of deployedAgents) {
      const brandProfile = agent.brandProfile;
      if (!brandProfile) continue;

      try {
        console.log(`🔍 [CRON] Checking llms.txt for: ${brandProfile.companyName}`);

        // Check if regeneration is needed
        const { shouldRegenerate, reason } = await shouldRegenerateLlmsTxt(brandProfile.id);

        if (!shouldRegenerate) {
          console.log(`⏭️ [CRON] Skipping ${brandProfile.companyName} - no regeneration needed`);
          log.skipped++;
          continue;
        }

        console.log(`🔄 [CRON] Regenerating llms.txt for ${brandProfile.companyName}: ${reason}`);

        // Generate new llms.txt
        const result = await generateLlmsTxtForBrand(brandProfile.id);

        // Log the generation task
        await prisma.agentTask.create({
          data: {
            deployedAgentId: agent.id,
            taskType: 'generate',
            taskName: 'Monthly llms.txt refresh',
            status: 'completed',
            input: JSON.stringify({ reason }),
            output: JSON.stringify({
              sizeBytes: result.sizeBytes,
              wasTrimmed: result.wasTrimmed,
              sections: result.sections,
            }),
            startedAt: new Date(startTime),
            completedAt: new Date(),
          },
        });

        // Verify existing deployment
        const verification = await verifyDeployment(brandProfile.id);
        if (!verification.accessible) {
          console.log(`⚠️ [CRON] llms.txt not accessible for ${brandProfile.companyName} - user needs to redeploy`);
        }

        log.regenerated++;
        console.log(`✅ [CRON] Regenerated llms.txt for ${brandProfile.companyName}`);

        // Rate limiting - wait 5 seconds between profiles
        await new Promise(resolve => setTimeout(resolve, 5000));

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        log.errors.push(`${brandProfile.companyName}: ${errorMsg}`);
        console.error(`❌ [CRON] Failed to refresh llms.txt for ${brandProfile.companyName}:`, error);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ [CRON] Monthly llms.txt refresh completed in ${duration}s`);
    console.log(`📊 [CRON] Results: ${log.regenerated} regenerated, ${log.skipped} skipped, ${log.errors.length} errors`);

  } catch (error) {
    console.error('❌ [CRON] Fatal error during llms.txt refresh:', error);
    log.errors.push(`Fatal: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Store execution log
  try {
    await prisma.cronExecutionLog.create({
      data: {
        jobType: 'llms_txt_refresh',
        executedAt: log.timestamp,
        profilesProcessed: log.profilesProcessed,
        successful: log.regenerated,
        failed: log.errors.length,
        errors: log.errors,
        duration: Math.round((Date.now() - startTime) / 1000),
      },
    });
  } catch (logError) {
    console.error('⚠️ [CRON] Failed to store llms.txt refresh log:', logError);
  }

  return log;
}

/**
 * Initialize cron job (for development/self-hosted environments)
 * Schedule:
 * - Primary analysis: Daily at 2:00 AM UTC
 * - Catch-up analysis: Daily at 2:00 PM UTC
 */
export function initializeCronJobs() {
  if (isInitialized) {
    console.log('⚠️ [CRON] Jobs already initialized, skipping...');
    return;
  }

  // Only run in production or if explicitly enabled
  const cronEnabled = process.env.ENABLE_CRON_JOBS === 'true' || process.env.NODE_ENV === 'production';
  
  if (!cronEnabled) {
    console.log('ℹ️ [CRON] Jobs disabled (set ENABLE_CRON_JOBS=true to enable)');
    return;
  }

  console.log('🚀 [CRON] Initializing daily analysis jobs...');

  // Schedule: Daily at 2:00 AM UTC
  cronJob = cron.schedule('0 2 * * *', async () => {
    console.log('⏰ [CRON] Triggered primary daily analysis job');
    await executeWeeklyAnalysis({
      onlyMissingToday: false,
      runContentOptimizer: true,
    });
  }, {
    timezone: 'UTC',
  });

  // Schedule: Daily at 2:00 PM UTC
  catchupCronJob = cron.schedule('0 14 * * *', async () => {
    console.log('⏰ [CRON] Triggered daily catch-up analysis job');
    await executeDailyCatchupAnalysis();
  }, {
    timezone: 'UTC',
  });

  // Schedule llms.txt refresh: Last day of each month at 3:00 AM UTC
  // Cron expression: '0 3 28-31 * *' with additional check for last day
  llmsTxtCronJob = cron.schedule('0 3 28-31 * *', async () => {
    // Only run on actual last day of month
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (tomorrow.getDate() === 1) {
      console.log('⏰ [CRON] Triggered monthly llms.txt refresh job (last day of month)');
      await executeLlmsTxtRefresh();
    }
  }, {
    timezone: 'UTC',
  });

  isInitialized = true;
  console.log('✅ [CRON] Primary daily analysis scheduled (2:00 AM UTC)');
  console.log('✅ [CRON] Daily catch-up analysis scheduled (2:00 PM UTC)');
  console.log('✅ [CRON] Monthly llms.txt refresh scheduled (Last day of month 3:00 AM UTC)');
}

/**
 * Stop all cron jobs (for testing/cleanup)
 */
export function stopCronJobs() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }
  if (catchupCronJob) {
    catchupCronJob.stop();
    catchupCronJob = null;
  }
  if (llmsTxtCronJob) {
    llmsTxtCronJob.stop();
    llmsTxtCronJob = null;
  }
  isInitialized = false;
  console.log('🛑 [CRON] Jobs stopped');
}

/**
 * Get cron job status
 */
export function getCronStatus() {
  return {
    initialized: isInitialized,
    primaryAnalysis: {
      running: cronJob !== null,
      nextRun: cronJob ? 'Daily 2:00 AM UTC' : null,
    },
    catchupAnalysis: {
      running: catchupCronJob !== null,
      nextRun: catchupCronJob ? 'Daily 2:00 PM UTC' : null,
    },
    llmsTxtRefresh: {
      running: llmsTxtCronJob !== null,
      nextRun: llmsTxtCronJob ? 'Last day of month 3:00 AM UTC' : null,
    },
  };
}
