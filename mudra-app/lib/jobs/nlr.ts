// Dev-friendly inline execution. Queue disabled to simplify testing.
// If you need queueing later, reintroduce bullmq imports.
import { generateWeeklyReport } from '@/lib/ai/nlr/generate-report'

export const NLR_QUEUE_NAME = 'nlr-weekly'

export async function queueNlrJob(
  brandProfileId: number,
  weekStartUtc: string,
  opts?: { companyId?: string | null }
) {
  await generateWeeklyReport({ brandProfileId, weekStartUtc, companyId: opts?.companyId })
  return { id: `inline:${brandProfileId}:${weekStartUtc}` } as any
}
