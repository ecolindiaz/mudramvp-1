/**
 * Cron Service - Automated Weekday Analysis Execution
 * 
 * Implements automated weekday prompt runs for all active brand profiles with cronEnabled=true
 * Rate: Runs Monday-Friday at 2 AM UTC
 */

import cron from 'node-cron';
import { prisma } from '@/lib/prisma';
import { runUnifiedAnalysis } from './unified-analysis.service';
import { getDeltaAnalysis } from './delta-analysis.service';
import { generateLlmsTxtForBrand, shouldRegenerateLlmsTxt } from './llms-txt-generator.service';
import { verifyDeployment } from './llms-txt-deployment.service';

let isInitialized = false;
let cronJob: cron.ScheduledTask | null = null;
let llmsTxtCronJob: cron.ScheduledTask | null = null;

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

/**
 * Execute weekday analysis for brand profiles with cron enabled
 * Only processes profiles where cronEnabled=true and have at least one prior analysis
 */
export async function executeWeeklyAnalysis(): Promise<CronExecutionLog> {
  const startTime = Date.now();
  const log: CronExecutionLog = {
    timestamp: new Date(),
    brandProfilesProcessed: 0,
    successful: 0,
    failed: 0,
    errors: [],
  };

  console.log('🔄 [CRON] Starting weekly analysis job...');

  try {
    // Fetch cron-eligible brand profiles (must have cronEnabled=true and at least one prior analysis)
    const brandProfiles = await prisma.brandProfile.findMany({
      where: {
        cronEnabled: true,
        // Only process profiles that have been analyzed at least once
        // This prevents running analysis on incomplete onboarding profiles
        analysisRuns: {
          some: {},
        },
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
    console.log(`📊 [CRON] Found ${brandProfiles.length} brand profiles to process`);

  const deltas: Array<{
    brandProfileId: number;
    companyName: string;
    improvement: boolean;
    degradation: boolean;
    changes: string[];
  }> = [];

  // Process each brand profile sequentially to avoid API rate limits
  for (const profile of brandProfiles) {
    try {
      console.log(`🔍 [CRON] Processing brand: ${profile.companyName} (ID: ${profile.id})`);

      // Skip if missing required data
      if (!profile.companyName || !profile.companyWebsite) {
        console.log(`⚠️ [CRON] Skipping ${profile.companyName || 'Unknown'} - missing required data`);
        log.failed++;
        continue;
      }

      // Run unified analysis with cooldown bypass (cron jobs override cooldown)
      // Pass trackingCountries for multi-country analysis
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
        skipCooldown: true,      // Cron jobs bypass 5-min cooldown
        generateReport: false,   // Don't generate NLR for automated runs
        countries,               // Multi-country: first sync, rest queued
      });

      if (result.success) {
        log.successful++;
        console.log(`✅ [CRON] Successfully analyzed ${profile.companyName}`);

        // ✅ NEW: Calculate delta vs previous run
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

      } else {
        log.failed++;
        log.errors.push(`${profile.companyName}: ${result.error || 'Unknown error'}`);
        console.error(`❌ [CRON] Failed to analyze ${profile.companyName}:`, result.error);
      }

      // Add delay between profiles to prevent API throttling (30 seconds)
      if (brandProfiles.indexOf(profile) < brandProfiles.length - 1) {
        console.log('⏳ [CRON] Waiting 30s before next profile...');
        await new Promise(resolve => setTimeout(resolve, 30000));
      }

    } catch (error) {
      log.failed++;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      log.errors.push(`${profile.companyName}: ${errorMsg}`);
      console.error(`❌ [CRON] Exception processing ${profile.companyName}:`, error);
    }
  }

    log.deltas = deltas;

    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    console.log(`✅ [CRON] Weekly analysis completed in ${duration} minutes`);
    console.log(`📊 [CRON] Results: ${log.successful} successful, ${log.failed} failed`);
    
    // Log delta summary
    const improved = deltas.filter(d => d.improvement).length;
    const declined = deltas.filter(d => d.degradation).length;
    console.log(`📈 [CRON] Deltas: ${improved} improved, ${declined} declined`);

    // ✅ NEW: Execute Content Optimizer agents for deployed/enabled instances
    try {
      await executeContentOptimizerAgents();
    } catch (agentError) {
      console.error('⚠️ [CRON] Content Optimizer execution failed:', agentError);
      log.errors.push(`Content Optimizer: ${agentError instanceof Error ? agentError.message : 'Unknown error'}`);
    }
  } catch (error) {
    console.error('❌ [CRON] Fatal error during weekly analysis:', error);
    log.errors.push(`Fatal: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Store execution log in database for audit trail
  try {
    await prisma.cronExecutionLog.create({
      data: {
        jobType: 'weekly_analysis',
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
 * Schedule: Monday-Friday at 2:00 AM UTC
 * Cron expression: '0 2 * * 1-5'
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

  console.log('🚀 [CRON] Initializing weekday analysis job...');

  // Schedule: Monday-Friday at 2:00 AM UTC
  cronJob = cron.schedule('0 2 * * 1-5', async () => {
    console.log('⏰ [CRON] Triggered weekday analysis job');
    await executeWeeklyAnalysis();
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
  console.log('✅ [CRON] Weekday analysis job scheduled (Mon-Fri 2:00 AM UTC)');
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
    weeklyAnalysis: {
      running: cronJob !== null,
      nextRun: cronJob ? 'Next Sunday 2:00 AM UTC' : null,
    },
    llmsTxtRefresh: {
      running: llmsTxtCronJob !== null,
      nextRun: llmsTxtCronJob ? 'Last day of month 3:00 AM UTC' : null,
    },
  };
}
