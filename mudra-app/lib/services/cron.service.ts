/**
 * Cron Service - Automated Weekly Analysis Execution
 * 
 * Implements automated weekly prompt runs for all active brand profiles
 * Rate: Runs every Sunday at 2 AM UTC
 */

import cron from 'node-cron';
import { prisma } from '@/lib/prisma';
import { runUnifiedAnalysis } from './unified-analysis.service';
import { getDeltaAnalysis } from './delta-analysis.service';

let isInitialized = false;
let cronJob: cron.ScheduledTask | null = null;

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
 * Execute weekly analysis for all active brand profiles
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
    // Fetch all active brand profiles with user relationships
    const brandProfiles = await prisma.brandProfile.findMany({
      where: {
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
      const result = await runUnifiedAnalysis({
        brandProfileId: profile.id,
        brandName: profile.companyName,
        website: profile.companyWebsite,
        description: profile.companyDescription || undefined,
        industry: profile.companyIndustry || undefined,
        competitors: profile.competitors ? profile.competitors.split(',').map(c => c.trim()) : undefined,
        skipCooldown: true,      // Cron jobs bypass 5-min cooldown
        generateReport: false,   // Don't generate NLR for automated runs
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
 * Initialize cron job (for development/self-hosted environments)
 * Schedule: Every Sunday at 2:00 AM UTC
 * Cron expression: '0 2 * * 0'
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

  console.log('🚀 [CRON] Initializing weekly analysis job...');

  // Schedule: Every Sunday at 2:00 AM UTC
  cronJob = cron.schedule('0 2 * * 0', async () => {
    console.log('⏰ [CRON] Triggered weekly analysis job');
    await executeWeeklyAnalysis();
  }, {
    timezone: 'UTC',
  });

  isInitialized = true;
  console.log('✅ [CRON] Weekly analysis job scheduled (Sundays 2:00 AM UTC)');
}

/**
 * Stop all cron jobs (for testing/cleanup)
 */
export function stopCronJobs() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    isInitialized = false;
    console.log('🛑 [CRON] Jobs stopped');
  }
}

/**
 * Get cron job status
 */
export function getCronStatus() {
  return {
    initialized: isInitialized,
    running: cronJob !== null,
    nextRun: cronJob ? 'Next Sunday 2:00 AM UTC' : null,
  };
}
