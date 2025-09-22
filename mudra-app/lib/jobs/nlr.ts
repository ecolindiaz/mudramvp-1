// Dev-friendly inline execution. Queue disabled to simplify testing.
// If you need queueing later, reintroduce bullmq imports.
type JobsOptions = Record<string, unknown>
import { generateWeeklyReport } from '@/lib/ai/nlr/generate-report'

export const NLR_QUEUE_NAME = 'nlr-weekly'

export async function queueNlrJob(companyId: string, weekStartUtc: string, opts?: JobsOptions) {
  // Always run inline in dev-friendly mode
  await generateWeeklyReport({ companyId, weekStartUtc })
  return { id: `inline:${companyId}:${weekStartUtc}` } as any
}

// No worker needed in inline mode


