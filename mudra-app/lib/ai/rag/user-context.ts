import { prisma } from '@/lib/analysis/technical/repo'

interface BuildUserContextInput {
  siteId: string
}

interface TasksSummary {
  totalOpen: number
  highImpact: number
  mediumImpact: number
  lowImpact: number
}

interface OpenTaskLite {
  id: string
  title: string
  impact: 'High' | 'Medium' | 'Low'
  whyItMatters?: string | null
}

interface LatestScoreInfo {
  total: number | null
  createdAt: string | null
}

interface ScoreDeltaInfo {
  latest: number | null
  previous: number | null
  delta: number | null
}

interface SiteMetaInfo {
  siteId: string
  lastSnapshotAt: string | null
  lastCrawlUrl: string | null
}

export interface UserContext {
  siteMeta: SiteMetaInfo
  latestScore: LatestScoreInfo
  scoreDelta: ScoreDeltaInfo
  tasksSummary: TasksSummary
  openTasksTop5: OpenTaskLite[]
  campaigns?: Array<{ id: string; title: string; status: string }>
  nlReport?: string | null
}

function computeTasksSummary(tasks: Array<{ impact: 'High' | 'Medium' | 'Low' }>): TasksSummary {
  const summary: TasksSummary = { totalOpen: tasks.length, highImpact: 0, mediumImpact: 0, lowImpact: 0 }
  for (const t of tasks) {
    if (t.impact === 'High') summary.highImpact++
    else if (t.impact === 'Medium') summary.mediumImpact++
    else summary.lowImpact++
  }
  return summary
}

export async function buildUserContext({ siteId }: BuildUserContextInput): Promise<UserContext> {
  // Parallel fetches for speed
  const [latestSnapshot, openTasks, latestScoreRow, historicalScores] = await Promise.all([
    prisma.crawlSnapshot.findFirst({ where: { siteId }, orderBy: { crawledAt: 'desc' } }),
    prisma.task.findMany({ where: { siteId, status: 'open' }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.technicalScore.findFirst({
      where: { snapshot: { siteId } },
      orderBy: { createdAt: 'desc' },
      include: { snapshot: true },
    }),
    prisma.technicalScore.findMany({ where: { snapshot: { siteId } }, orderBy: { createdAt: 'desc' }, take: 2 }),
  ])

  const latestScore: LatestScoreInfo = {
    total: latestScoreRow?.total ?? null,
    createdAt: latestScoreRow?.createdAt ? latestScoreRow.createdAt.toISOString() : null,
  }

  const latest = historicalScores?.[0]?.total ?? null
  const previous = historicalScores?.[1]?.total ?? null
  const scoreDelta: ScoreDeltaInfo = {
    latest,
    previous,
    delta: latest !== null && previous !== null && previous > 0 ? Math.round(((latest - previous) / previous) * 100) : null,
  }

  const openTasksTop5: OpenTaskLite[] = openTasks.slice(0, 5).map((t) => ({
    id: t.id,
    title: t.title,
    impact: t.impact as 'High' | 'Medium' | 'Low',
    whyItMatters: t.whyItMatters ?? null,
  }))

  const tasksSummary = computeTasksSummary(openTasks.map((t) => ({ impact: t.impact as 'High' | 'Medium' | 'Low' })))

  const siteMeta: SiteMetaInfo = {
    siteId,
    lastSnapshotAt: latestSnapshot?.crawledAt ? new Date(latestSnapshot.crawledAt).toISOString() : null,
    lastCrawlUrl: (latestSnapshot?.data as any)?.url ?? null,
  }

  // Placeholder for NL report and campaigns if/when added to DB
  const nlReport: string | null = null
  const campaigns: Array<{ id: string; title: string; status: string }> | undefined = undefined

  return { siteMeta, latestScore, scoreDelta, tasksSummary, openTasksTop5, campaigns, nlReport }
}

// ---------- Size + Redact helpers ----------

const CHARS_PER_TOKEN = 4 // rough heuristic suitable for budget guarding

function estimateTokensFromString(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

function safeHost(url?: string | null): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    return u.host
  } catch {
    return null
  }
}

function redactString(input: string): string {
  return input
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted_email]')
    .replace(/\b(sk|rk|pk)\-[A-Za-z0-9_\-]{10,}\b/gi, '[redacted_key]')
    .replace(/\b(sb_secret|service_role|anon_key)\-[A-Za-z0-9_\-]{6,}\b/gi, '[redacted_key]')
}

function truncateMiddle(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  const keep = Math.max(0, Math.floor((maxChars - 3) / 2))
  return `${text.slice(0, keep)}...${text.slice(text.length - keep)}`
}

export interface UserContextSummary {
  summary: string
  tokens: number
  truncated: boolean
}

/** Returns a compact, bulleted JSON-like summary string under the token budget. */
export function buildUserContextSummary(ctx: UserContext, tokenBudget = 1500): UserContextSummary {
  const bullets: string[] = []

  bullets.push(`- site_domain: ${safeHost(ctx.siteMeta.lastCrawlUrl) ?? 'unknown'}`)
  if (ctx.siteMeta.lastSnapshotAt) bullets.push(`- last_snapshot_at: ${ctx.siteMeta.lastSnapshotAt}`)
  if (ctx.latestScore.total !== null) bullets.push(`- latest_score: ${ctx.latestScore.total}`)
  if (ctx.scoreDelta.latest !== null) bullets.push(`- previous_score: ${ctx.scoreDelta.previous ?? 'n/a'}`)
  if (ctx.scoreDelta.delta !== null) bullets.push(`- score_delta_pct: ${ctx.scoreDelta.delta}`)
  bullets.push(`- tasks_open_total: ${ctx.tasksSummary.totalOpen}`)
  bullets.push(`- tasks_open_by_impact: { high: ${ctx.tasksSummary.highImpact}, medium: ${ctx.tasksSummary.mediumImpact}, low: ${ctx.tasksSummary.lowImpact} }`)

  const taskLines = ctx.openTasksTop5.map((t, i) => {
    const title = truncateMiddle(redactString(t.title), 100)
    const why = t.whyItMatters ? truncateMiddle(redactString(t.whyItMatters), 140) : null
    return `  - ${i + 1}) [${t.impact}] ${title}${why ? ` — why: ${why}` : ''}`
  })
  if (taskLines.length) {
    bullets.push('- open_tasks_top5:')
    bullets.push(...taskLines)
  }

  if (ctx.nlReport) bullets.push(`- nl_report_snippet: ${truncateMiddle(redactString(ctx.nlReport), 240)}`)

  let summary = `{\n  ${bullets.join(`\n  `)}\n}`
  let tokens = estimateTokensFromString(summary)
  let truncated = false

  if (tokens > tokenBudget) {
    truncated = true
    const filtered = bullets.filter((b) => !b.startsWith('- nl_report_snippet:'))
    const headerIdx = filtered.findIndex((b) => b === '- open_tasks_top5:')
    let compact = filtered
    if (headerIdx >= 0) {
      const head = filtered.slice(0, headerIdx + 1)
      const tasks = filtered.slice(headerIdx + 1).filter((b) => b.startsWith('  - ')).slice(0, 3)
      const tail = filtered.slice(headerIdx + 1).filter((b) => !b.startsWith('  - '))
      compact = [...head, ...tasks, ...tail]
    }
    summary = `{\n  ${compact.join(`\n  `)}\n}`
    tokens = estimateTokensFromString(summary)
  }

  return { summary, tokens, truncated }
}


