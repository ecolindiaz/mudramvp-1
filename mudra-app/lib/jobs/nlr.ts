// Dev-friendly inline execution. Queue disabled to simplify testing.
// If you need queueing later, reintroduce bullmq imports.
import { generateWeeklyReport } from '@/lib/ai/nlr/generate-report'

export const NLR_QUEUE_NAME = 'nlr-weekly'

export async function queueNlrJob(
  companyId: string,
  brandProfileId: number,
  weekStartUtc: string,
) {
  await generateWeeklyReport({ companyId, brandProfileId, weekStartUtc })
  return { id: `inline:${companyId}:${weekStartUtc}` } as any
}
