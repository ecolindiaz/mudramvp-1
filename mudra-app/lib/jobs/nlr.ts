import { Queue, Worker, JobsOptions, QueueScheduler } from 'bullmq'
import { generateWeeklyReport } from '@/lib/ai/nlr/generate-report'

const connectionUrl = process.env.QUEUE_REDIS_URL || process.env.REDIS_URL || 'redis://localhost:6379'

export const NLR_QUEUE_NAME = 'nlr-weekly'

let queue: Queue | null = null
let scheduler: QueueScheduler | null = null

function getQueue(): Queue {
  if (!queue) {
    queue = new Queue(NLR_QUEUE_NAME, { connection: { url: connectionUrl } })
    scheduler = new QueueScheduler(NLR_QUEUE_NAME, { connection: { url: connectionUrl } })
  }
  return queue
}

export async function queueNlrJob(companyId: string, weekStartUtc: string, opts?: JobsOptions) {
  const q = getQueue()
  return q.add(
    'generateWeekly',
    { companyId, weekStartUtc },
    {
      attempts: 2,
      backoff: { type: 'exponential', delay: 700 },
      removeOnComplete: true,
      removeOnFail: false,
      ...opts,
      jobId: `${companyId}:${weekStartUtc}`,
    }
  )
}

export function processNlrJob(concurrency = 2): Worker {
  return new Worker(
    NLR_QUEUE_NAME,
    async (job) => {
      const { companyId, weekStartUtc } = job.data as { companyId: string; weekStartUtc: string }
      await generateWeeklyReport({ companyId, weekStartUtc })
      return true
    },
    { connection: { url: connectionUrl }, concurrency }
  )
}


