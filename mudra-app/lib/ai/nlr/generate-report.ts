import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'
import { getModelConfig, estimateCost } from '@/lib/config/ai-models'
import { logNlrJob } from '@/lib/services/observability.service'
import { logAIModelCall, estimateAICost } from '@/lib/services/ai-model-logging.service'
import { collectNlrInputs } from '@/lib/analysis/nlr/mappers'
import { rankChanges } from '@/lib/analysis/nlr/diff'
import { buildNlrPrompt } from '@/lib/ai/prompts/nlr-prompt'
import { prisma } from '@/lib/prisma'

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}

function extractJsonAndMarkdown(text: string): { json: any | null; markdown: string } {
  if (!text) return { json: null, markdown: '' }
  let json: any | null = null
  let endIdx = -1
  try {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) {
      const candidate = text.slice(start, end + 1)
      json = JSON.parse(candidate)
      endIdx = end
    }
  } catch {}
  const markdown = endIdx >= 0 ? text.slice(endIdx + 1).trim() : text
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
    include: { sections: true },
  })

  const report = existing ?? (await prisma.weeklyReport.create({
    data: { companyId, weekStartUtc: weekStart, status: 'queued' },
  }))

  // Mark running
  await prisma.weeklyReport.update({ where: { id: report.id }, data: { status: 'running' } })
  // Log running
  await logNlrJob({ companyId, weekStartUtc: weekStart.toISOString(), status: 'running' })

  // 2) Collect inputs and prepare prompt
  const nlrInput = await collectNlrInputs(companyId, weekStart)
  const _ = rankChanges(nlrInput) // ranked already used inside prompt builder
  const { system, user } = buildNlrPrompt(nlrInput)

  // 3) Call Gemini (preview → stable → lite fallback) then GPT-4 as last resort
  const gemini3Pro = getModelConfig('gemini-3-pro')
  const geminiStable = getModelConfig('gemini-2.5-flash')
  const geminiLite = getModelConfig('gemini-2.5-flash-lite')
  const gpt4 = getModelConfig('gpt-4')

  let content = ''
  let usedModelId: string = gemini3Pro?.id || 'gemini-3-pro'
  let tokensIn = 0
  let tokensOut = 0

  // Helper: check if error is a 503/429 overload
  const isOverloadError = (err: any): boolean => {
    const status = err?.status || err?.statusCode || err?.httpCode
    return status === 503 || status === 429
  }

  // Helper: attempt Gemini generation with exponential backoff
  const attemptGemini = async (modelId: string, modelName: string, maxRetries = 3): Promise<boolean> => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '')
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: gemini3Pro?.settings.defaultTemperature || 0.3,
            maxOutputTokens: gemini3Pro?.settings.defaultMaxTokens || 4000,
          },
        })

        const prompt = `${system}\n\n${user}`
        const result = await model.generateContent(prompt)
        const response = result.response
        content = response.text() || ''
        usedModelId = modelId

        const usageMetadata = response.usageMetadata
        if (usageMetadata) {
          tokensIn = usageMetadata.promptTokenCount || 0
          tokensOut = usageMetadata.candidatesTokenCount || 0
        }

        if (!content || content.length < 20) {
          throw new Error(`Empty content from ${modelId}: length=${content.length}`)
        }

        // Log successful call
        const costCents = Math.round(estimateAICost(modelId, tokensIn, tokensOut))
        logAIModelCall({
          feature: 'nlr',
          endpoint: '/api/nlr/generate',
          model: modelId,
          provider: 'google',
          status: 'success',
          tokensIn,
          tokensOut,
          costCents,
          metadata: { companyId, weekStartUtc: weekStart.toISOString() },
        }).catch(() => {})

        return true // success
      } catch (err: any) {
        const isLast = attempt === maxRetries - 1
        const isRetryable = isOverloadError(err) || err?.code === 'ECONNRESET' || err?.code === 'ETIMEDOUT'

        if (!isRetryable || isLast) {
          // Log failure
          logAIModelCall({
            feature: 'nlr',
            endpoint: '/api/nlr/generate',
            model: modelId,
            provider: 'google',
            status: 'error',
            errorMessage: (err as Error).message,
            metadata: { companyId, weekStartUtc: weekStart.toISOString() },
          }).catch(() => {})
          throw err
        }

        const delay = 1000 * Math.pow(2, attempt)
        console.warn(`⚠️  NLR: ${modelId} attempt ${attempt + 1}/${maxRetries} failed (${err.status || err.message}), retrying in ${delay}ms`)
        await new Promise(r => setTimeout(r, delay))
      }
    }
    return false
  }

  // Gemini model cascade: preview → stable → lite
  const geminiModels: { id: string; model: string }[] = [
    { id: gemini3Pro?.id || 'gemini-3-pro', model: gemini3Pro?.model || 'gemini-3-flash-preview' },
    ...(geminiStable ? [{ id: geminiStable.id, model: geminiStable.model }] : []),
    ...(geminiLite ? [{ id: geminiLite.id, model: geminiLite.model }] : []),
  ]

  let geminiSucceeded = false
  for (let i = 0; i < geminiModels.length; i++) {
    const { id, model: modelName } = geminiModels[i]
    try {
      await attemptGemini(id, modelName)
      geminiSucceeded = true
      break
    } catch (err: any) {
      const isLast = i === geminiModels.length - 1
      if (!isLast && isOverloadError(err)) {
        const next = geminiModels[i + 1]
        console.warn(`NLR: ${id} unavailable (${err.status}), trying ${next.id}`)
        continue
      }
      if (!isLast) {
        // Non-overload error on non-last model — skip to GPT-4
        console.error(`NLR: ${id} failed (non-overload), falling back to GPT-4:`, err.message)
      } else {
        console.error('NLR: All Gemini models failed, falling back to GPT-4:', err.message)
      }
      break
    }
  }

  if (!geminiSucceeded) {
    // Final fallback: GPT-4
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const messages = [
      { role: 'system' as const, content: system },
      { role: 'user' as const, content: user },
    ]

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

    const gpt4CostCents = Math.round(estimateAICost('gpt-4', tokensIn, tokensOut))
    logAIModelCall({
      feature: 'nlr',
      endpoint: '/api/nlr/generate',
      model: 'gpt-4',
      provider: 'openai',
      status: 'success',
      tokensIn,
      tokensOut,
      costCents: gpt4CostCents,
      metadata: { companyId, weekStartUtc: weekStart.toISOString(), fallback: true },
    }).catch(() => {})
  }

  // 4) Extract JSON + Markdown
  const { json, markdown } = extractJsonAndMarkdown(content)
  const inner = json && (json.summary_json || json.summaryJson || json)
  const summaryJson = validateSummaryJson(inner) ? inner : null
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
  // Log ready
  await logNlrJob({ companyId, weekStartUtc: weekStart.toISOString(), status: 'ready', modelId: usedModelId, tokenIn: tokensIn, tokenOut: tokensOut, costCents })

  // Notification: report ready
  try {
    const profile = await prisma.brandProfile.findFirst({
      where: { siteId: companyId },
      select: { id: true, userId: true },
    });
    if (profile?.userId) {
      const { createNotification } = await import('@/lib/services/notification.service');
      await createNotification({
        userId: profile.userId,
        brandProfileId: profile.id,
        type: 'success',
        category: 'report_ready',
        title: 'Weekly Report Ready',
        message: 'Your natural language report has been generated and is ready to review.',
        actionUrl: '/dashboard',
        metadata: { reportId: report.id, model: usedModelId },
      });
    }
  } catch (e) { console.warn('[Notification] Failed to create report notification:', e); }

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


