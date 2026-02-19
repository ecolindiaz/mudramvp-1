import type { NlrSummaryJson } from '@/types/nlr'

function roundValue(value: number, decimals = 1): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function signed(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`
}

function prettyNumber(value: number): string {
  return Number.isInteger(value) ? `${value}` : `${roundValue(value, 1)}`
}

function toPath(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.pathname || '/'
  } catch {
    return url
  }
}

function joinNatural(items: string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

function compactIssueTitle(title: string): string {
  const lower = title.toLowerCase()
  if (lower.includes('schema')) return 'schema coverage'
  if (lower.includes('faq')) return 'FAQ coverage'
  if (lower.includes('canonical')) return 'canonical tags'
  if (lower.includes('meta description')) return 'meta descriptions'
  if (lower.includes('open graph')) return 'Open Graph tags'
  if (lower.includes('twitter')) return 'Twitter cards'
  if (lower.includes('title tag')) return 'title tags'
  if (lower.includes('paragraph')) return 'paragraph structure'
  if (lower.includes('content')) return 'content depth'
  return title.length > 44 ? `${title.slice(0, 44).trim()}...` : title
}

function formatDeltaParts(
  absolute: number | null | undefined,
  relative: number | null | undefined
): string {
  const abs = absolute == null ? null : roundValue(absolute, 1)
  const pct = relative == null ? null : roundValue(relative * 100, 1)

  if (abs == null && pct == null) return ''
  if (abs != null && pct != null) {
    return `(${signed(abs)}, ${signed(pct)}%)`
  }
  if (abs != null) return `(${signed(abs)})`
  return `(${signed(pct as number)}%)`
}

function isLikelyBaseline(
  previous: number | null | undefined,
  current: number | null | undefined,
  absolute: number | null | undefined,
  relative: number | null | undefined,
  hints: string[]
): boolean {
  if (current == null) return false
  if (previous == null) return true
  if (previous !== 0) return false

  const hasBaselineHint = hints.some((hint) => /(first week|baseline|no previous)/i.test(hint))
  if (hasBaselineHint) return true

  // Handle model outputs that encode first week as previous=0 with missing relative.
  if (relative == null && (absolute == null || roundValue(absolute, 1) === roundValue(current, 1))) {
    return true
  }

  return false
}

function extractPromptMentionCount(summary: NlrSummaryJson): number | null {
  const candidates = [
    ...(summary.sections.ai_visibility?.notes ?? []),
    ...(summary.sections.highlights ?? []),
    ...((summary.sections.whats_changed ?? []).map((item) => item.label)),
  ]

  for (const candidate of candidates) {
    const detailed = candidate.match(/(\d+)\s+new\s+prompts?/i)
    if (detailed) return Number(detailed[1])
    const generic = candidate.match(/(\d+)\s+prompts?/i)
    if (generic && /mention/i.test(candidate)) return Number(generic[1])
  }

  return null
}

function buildVisibilitySentence(summary: NlrSummaryJson): string | null {
  const score = summary.sections.ai_visibility?.score_change
  if (!score || score.current == null) return null

  const notes = summary.sections.ai_visibility?.notes ?? []
  const baseline = isLikelyBaseline(
    score.previous,
    score.current,
    score.absolute,
    score.relative,
    notes
  )

  let sentence = ''
  if (baseline) {
    sentence = `This week your AI Visibility baseline is ${prettyNumber(score.current)}%`
  } else {
    const previous = score.previous as number
    const current = score.current as number
    const delta = roundValue(score.absolute ?? (current - previous), 1)
    const rel = score.relative ?? (previous !== 0 ? delta / previous : null)
    const deltaText = formatDeltaParts(delta, rel)

    if (delta === 0) {
      sentence = `This week your AI Visibility held at ${prettyNumber(current)}%`
    } else if (delta > 0) {
      sentence = `This week your AI Visibility rose from ${prettyNumber(previous)}% to ${prettyNumber(current)}%${deltaText ? ` ${deltaText}` : ''}`
    } else {
      sentence = `This week your AI Visibility fell from ${prettyNumber(previous)}% to ${prettyNumber(current)}%${deltaText ? ` ${deltaText}` : ''}`
    }
  }

  const promptCount = extractPromptMentionCount(summary)
  if (promptCount) {
    sentence += `, with ${promptCount} new prompts now mentioning you`
  }

  const avg = summary.sections.average_position
  if (avg && avg.current != null) {
    const current = roundValue(avg.current, 1)
    if (avg.previous == null) {
      sentence += `. Average Position baseline is #${prettyNumber(current)}`
    } else {
      const previous = roundValue(avg.previous, 1)
      const diff = roundValue(avg.current - avg.previous, 1)
      if (diff < 0) {
        sentence += `. Average Position improved from #${prettyNumber(previous)} to #${prettyNumber(current)} (${signed(diff)})`
      } else if (diff > 0) {
        sentence += `. Average Position declined from #${prettyNumber(previous)} to #${prettyNumber(current)} (${signed(diff)})`
      } else {
        sentence += `. Average Position held at #${prettyNumber(current)}`
      }
    }
  }

  return sentence
}

function buildTechnicalSentence(summary: NlrSummaryJson): string | null {
  const technical = summary.sections.technical_structure?.overall_change
  const pageDeltas = summary.sections.technical_structure?.page_deltas ?? []

  if (!technical || technical.current == null) return null

  const hints = [
    ...(summary.sections.highlights ?? []),
    ...((summary.sections.whats_changed ?? []).map((item) => item.label)),
  ]
  const baseline = isLikelyBaseline(
    technical.previous,
    technical.current,
    technical.absolute,
    technical.relative,
    hints
  )

  let sentence = ''
  if (baseline) {
    sentence = `Technical Structure Score baseline is ${prettyNumber(technical.current)}%`
  } else {
    const previous = technical.previous as number
    const current = technical.current as number
    const delta = roundValue(
      technical.absolute ?? (current - previous),
      1
    )
    const rel = technical.relative ?? (previous !== 0 ? delta / previous : null)
    const deltaText = formatDeltaParts(delta, rel)

    if (delta === 0) {
      sentence = `Technical Structure Score held at ${prettyNumber(current)}%`
    } else if (delta > 0) {
      sentence = `Technical Structure Score increased from ${prettyNumber(previous)}% to ${prettyNumber(current)}%${deltaText ? ` ${deltaText}` : ''}`
    } else {
      sentence = `Technical Structure Score decreased from ${prettyNumber(previous)}% to ${prettyNumber(current)}%${deltaText ? ` ${deltaText}` : ''}`
    }
  }

  const improvedPages = pageDeltas
    .filter((page) => (page.delta ?? 0) > 0)
    .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))
    .slice(0, 2)
    .map((page) => toPath(page.url))
  if (improvedPages.length > 0) {
    sentence += ` after improvements on ${joinNatural(improvedPages)}`
  }

  const topOpen = summary.sections.tasks?.top_open ?? []
  if (topOpen.length > 0) {
    const top = topOpen
      .slice(0, 2)
      .map((item) => compactIssueTitle(item.title))
      .join(' and ')
    sentence += `, but ${topOpen.length} active issues remain (top: ${top})`
  }

  return sentence
}

function buildTrafficSentence(summary: NlrSummaryJson): string | null {
  const traffic = summary.sections.ai_traffic
  if (!traffic) return null

  const visits = traffic.total_visits ?? 0
  const boost = traffic.weekly_boost ?? 0
  let sentence = `AI-referred traffic reached ${visits} visits (${signed(boost)} vs last week)`

  const providers = [...(traffic.by_provider ?? [])].sort((a, b) => b.visits - a.visits)
  if (providers.length > 0) {
    const topProviders = providers.slice(0, 2).map((provider) => provider.provider)
    sentence += `, led by ${joinNatural(topProviders)}`
  }

  return sentence
}

function buildOpportunitiesSentence(summary: NlrSummaryJson): string | null {
  const opportunities = summary.sections.opportunities
  if (!opportunities || opportunities.count <= 0) return null

  let sentence = `Conversation Radar identified ${opportunities.count} high-fit threads`
  if ((opportunities.engaged_this_week ?? 0) > 0) {
    sentence += `, with ${opportunities.engaged_this_week} already engaged`
  }
  return sentence
}

function buildActionSentence(summary: NlrSummaryJson): string {
  const opportunities = summary.sections.opportunities
  if (opportunities && opportunities.count >= 2) {
    return 'Next action: reply to the top two Conversation Radar threads this week'
  }

  const topOpen = summary.sections.tasks?.top_open ?? []
  if (topOpen.length > 0) {
    return `Next action: close the top ${Math.min(2, topOpen.length)} open issue${topOpen.length > 1 ? 's' : ''} this week`
  }

  return 'Next action: keep monitoring weekly changes and ship one technical fix this week'
}

function buildFallback(summary: NlrSummaryJson): string {
  const highlights = summary.sections.highlights ?? []
  const changed = summary.sections.whats_changed?.map((item) => item.label) ?? []
  const fallback = [...highlights, ...changed].filter(Boolean).slice(0, 3)
  return fallback.join(' ')
}

export function isJsonLikeText(value: string | null | undefined): boolean {
  const text = value?.trim()
  if (!text) return false
  if (text.startsWith('{')) return true
  if (text.startsWith('[')) return true
  return false
}

export function buildExecutiveSummaryFromJson(
  summary: NlrSummaryJson | null | undefined
): string {
  if (!summary) return ''

  const sentences = [
    buildVisibilitySentence(summary),
    buildTechnicalSentence(summary),
    buildTrafficSentence(summary),
    buildOpportunitiesSentence(summary),
  ].filter(Boolean) as string[]

  const actionSentence = buildActionSentence(summary)

  if (sentences.length === 0) {
    const fallback = buildFallback(summary)
    return [fallback, actionSentence]
      .filter(Boolean)
      .map((sentence) => sentence.trim())
      .filter(Boolean)
      .map((sentence) => (/[.!?]$/.test(sentence) ? sentence : `${sentence}.`))
      .join(' ')
  }

  return [...sentences, actionSentence]
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .map((sentence) => (/[.!?]$/.test(sentence) ? sentence : `${sentence}.`))
    .join(' ')
}
