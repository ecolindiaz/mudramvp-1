import OpenAI from 'openai'
import { getModelConfig, estimateCost } from '@/lib/config/ai-models'
import { collectNlrInputs } from '@/lib/analysis/nlr/mappers'
import { rankChanges } from '@/lib/analysis/nlr/diff'
import { buildNlrPrompt } from '@/lib/ai/prompts/nlr-prompt'
import { prisma } from '@/lib/db/reports'

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}

function extractJsonAndMarkdown(text: string): { json: any | null; markdown: string } {
  if (!text) return { json: null, markdown: '' }
  // Try to parse the first JSON object
  let json: any | null = null
  try {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) {
      const candidate = text.slice(start, end + 1)
      json = JSON.parse(candidate)
    }
  } catch {}
  // Markdown is the rest after the JSON block
  let markdown = text
  if (json) {
    const end = text.indexOf('}')
    markdown = text.slice(end + 1).trim()
  }
  return { json, markdown }
}

function sanitizeMarkdown(md: string): string {
  if (!md) return ''
  // Remove script/iframe tags and on* handlers as a minimal safeguard
  return md
    .replace(/<\/?script[^>]*>/gi, '')
    .replace(/<\/?iframe[^>]*>/gi, '')
    .replace(/on[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/on[a-z]+\s*=\s*'[^']*'/gi, '')
    .trim()
}

function validateSummaryJson(candidate: unknown): boolean {
  if (!candidate || typeof candidate !== 'object') return false
  const j = candidate as any
  // Minimal checks; keep permissive for MVP
  if (j.sections && typeof j.sections !== 'object') return false
  return true
}

export async function generateWeeklyReport(params: { companyId: string; weekStartUtc: Date | string }) {
  const companyId = params.companyId
  const weekStart = toDate(params.weekStartUtc)

  // 1) Get or create draft report
  const existing = await prisma.weeklyReport.findUnique({
    where: { companyId_weekStartUtc: { companyId, weekStartUtc: weekStart } },
    include: { sections: { include: { sources: true } } },
  })

  const report = existing ?? (await prisma.weeklyReport.create({
    data: { companyId, weekStartUtc: weekStart, status: 'queued' },
  }))

  // Mark running
  await prisma.weeklyReport.update({ where: { id: report.id }, data: { status: 'running' } })

  // 2) Collect inputs and prepare prompt
  const nlrInput = await collectNlrInputs(companyId, weekStart)
  const _ = rankChanges(nlrInput) // ranked already used inside prompt builder
  const { system, user } = buildNlrPrompt(nlrInput)

  // 3) Call GPT-5 (fallback to gpt-4 if needed)
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const gpt5 = getModelConfig('gpt-5')
  const gpt4 = getModelConfig('gpt-4')
  const messages = [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: user },
  ]

  let content = ''
  let usedModelId: string = gpt5?.id || 'gpt-5'
  let tokensIn = 0
  let tokensOut = 0
  try {
    const r = await openai.chat.completions.create({
      model: gpt5?.model || 'gpt-4',
      messages,
      temperature: 0.3,
      max_tokens: gpt5?.settings.defaultMaxTokens || 1200,
    })
    content = r.choices?.[0]?.message?.content || ''
    const usage: any = (r as any).usage || {}
    tokensIn = usage.prompt_tokens ?? usage.input_tokens ?? 0
    tokensOut = usage.completion_tokens ?? usage.output_tokens ?? 0
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('NLR: gpt-5 failed, fallback to gpt-4:', err)
    const r = await openai.chat.completions.create({
      model: gpt4?.model || 'gpt-4',
      messages,
      temperature: 0.3,
      max_tokens: gpt4?.settings.defaultMaxTokens || 1000,
    })
    content = r.choices?.[0]?.message?.content || ''
    usedModelId = gpt4?.id || 'gpt-4'
    const usage: any = (r as any).usage || {}
    tokensIn = usage.prompt_tokens ?? usage.input_tokens ?? 0
    tokensOut = usage.completion_tokens ?? usage.output_tokens ?? 0
  }

  // 4) Extract JSON + Markdown
  const { json, markdown } = extractJsonAndMarkdown(content)
  const summaryJson = validateSummaryJson(json) ? json : null
  const summaryMarkdown = sanitizeMarkdown(markdown)

  // 4.5) Cost estimation
  const costUsd = estimateCost(usedModelId, tokensIn, tokensOut)
  const costCents = Math.round(costUsd * 100)

  // 5) Persist core and sections
  await prisma.weeklyReport.update({
    where: { id: report.id },
    data: {
      model: usedModelId,
      summaryJson: summaryJson ?? undefined,
      summaryMarkdown: summaryMarkdown || null,
      tokensIn: tokensIn || undefined,
      tokensOut: tokensOut || undefined,
      costCents: costCents || undefined,
      status: 'ready',
    },
  })

  // Minimal sections: What's Changed + Highlights placeholders (extend later)
  const sections: { key: string; title: string; bodyMarkdown: string }[] = []
  sections.push({ key: 'whats_changed', title: "What's Changed", bodyMarkdown: '' })
  sections.push({ key: 'highlights', title: "This Week's Highlights", bodyMarkdown: '' })

  // Replace existing sections
  await prisma.weeklyReportSection.deleteMany({ where: { reportId: report.id } })
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i]
    await prisma.weeklyReportSection.create({
      data: { reportId: report.id, key: s.key, title: s.title, order: i, bodyMarkdown: s.bodyMarkdown },
    })
  }

  return prisma.weeklyReport.findUnique({ where: { id: report.id }, include: { sections: true } })
}


