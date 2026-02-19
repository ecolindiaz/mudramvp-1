import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'
import { getModelConfig, estimateCost } from '@/lib/config/ai-models'
import { logNlrJob } from '@/lib/services/observability.service'
import { logAIModelCall, estimateAICost } from '@/lib/services/ai-model-logging.service'
import { collectNlrInputs } from '@/lib/analysis/nlr/mappers'
import type { NlrInput } from '@/lib/analysis/nlr/types'
import { rankChanges } from '@/lib/analysis/nlr/diff'
import { buildExecutiveSummaryFromJson, isJsonLikeText } from '@/lib/analysis/nlr/narrative'
import { buildNlrPrompt } from '@/lib/ai/prompts/nlr-prompt'
import type { NlrSummaryJson } from '@/types/nlr'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}

function extractJsonAndMarkdown(text: string): { json: any | null; markdown: string } {
  if (!text) return { json: null, markdown: '' }

  const trimmed = text.trim()

  // Best case: explicit fenced JSON block.
  const fencedJson = trimmed.match(/```json\s*([\s\S]*?)```/i)
  if (fencedJson?.[1]) {
    try {
      const json = JSON.parse(fencedJson[1].trim())
      const markdown = trimmed.replace(fencedJson[0], '').trim()
      return { json, markdown }
    } catch {
      // continue to generic parser
    }
  }

  // Fallback: locate first valid top-level JSON object by brace depth.
  const start = trimmed.indexOf('{')
  if (start >= 0) {
    let depth = 0
    let inString = false
    let escaped = false
    for (let index = start; index < trimmed.length; index++) {
      const char = trimmed[index]

      if (inString) {
        if (escaped) {
          escaped = false
        } else if (char === '\\') {
          escaped = true
        } else if (char === '"') {
          inString = false
        }
        continue
      }

      if (char === '"') {
        inString = true
        continue
      }
      if (char === '{') depth += 1
      if (char === '}') depth -= 1

      if (depth === 0) {
        const candidate = trimmed.slice(start, index + 1)
        try {
          const json = JSON.parse(candidate)
          const markdown = trimmed.slice(index + 1).trim()
          return { json, markdown }
        } catch {
          break
        }
      }
    }
  }

  return { json: null, markdown: trimmed }
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
  if (!j.sections || typeof j.sections !== 'object') return false
  return true
}

function buildSummaryJsonFromInput(input: NlrInput): NlrSummaryJson {
  const ranked = rankChanges(input).slice(0, 4)
  const opportunities = input.opportunities
  const aiTraffic = input.aiReferralTraffic
  const agentDeployments = input.agentDeployments
  const tasks = input.tasks
  const aiVisibility = input.aiVisibility
  const technical = input.technical

  return {
    week_start_utc: input.weekStartUtc,
    sections: {
      whats_changed: ranked.map((item) => ({
        label: item.label,
        importance: item.importance,
      })),
      highlights: [
        ...(aiVisibility?.notes?.slice(0, 2) ?? []),
        ...(technical?.keyFindings?.slice(0, 1).map((finding) => finding.title) ?? []),
      ].filter(Boolean),
      agent_lab: {
        deployments: (agentDeployments?.deployments ?? []).slice(0, 5).map((deployment) => ({
          agent_name: deployment.agentName,
          what_changed: deployment.whatChanged,
        })),
        total_executions: agentDeployments?.totalExecutions ?? 0,
      },
      opportunities: {
        count: opportunities ? opportunities.activeCount + opportunities.newThisWeek : 0,
        summary: null,
        active_count: opportunities?.activeCount ?? 0,
        new_this_week: opportunities?.newThisWeek ?? 0,
        engaged_this_week: opportunities?.engagedThisWeek ?? 0,
      },
      ai_visibility: {
        score_change: {
          previous: aiVisibility?.score?.previous ?? null,
          current: aiVisibility?.score?.current ?? null,
          direction: aiVisibility?.score?.direction ?? null,
          relative: aiVisibility?.score?.relative ?? null,
          absolute: aiVisibility?.score?.absolute ?? null,
          formatted: '',
        },
        notes: aiVisibility?.notes ?? [],
      },
      average_position: {
        current: aiVisibility?.averagePosition?.current ?? null,
        previous: aiVisibility?.averagePosition?.previous ?? null,
        direction: aiVisibility?.averagePosition?.direction ?? null,
        delta: aiVisibility?.averagePosition?.absolute ?? null,
        formatted: '',
      },
      technical_structure: {
        overall_change: {
          previous: technical?.overallScore?.previous ?? null,
          current: technical?.overallScore?.current ?? null,
          direction: technical?.overallScore?.direction ?? null,
          relative: technical?.overallScore?.relative ?? null,
          absolute: technical?.overallScore?.absolute ?? null,
          formatted: '',
        },
        key_findings: (technical?.keyFindings ?? []).slice(0, 8).map((finding) => ({
          title: finding.title,
          importance: finding.importance ?? 'medium',
        })),
        page_deltas: technical?.pageDeltas ?? [],
      },
      ai_traffic: {
        total_visits: aiTraffic?.totalVisits?.current ?? 0,
        weekly_boost: aiTraffic?.weeklyBoost ?? 0,
        by_provider: aiTraffic?.byProvider ?? [],
        formatted: '',
      },
      tasks: {
        opened_this_week: tasks?.openedThisWeek ?? 0,
        completed_this_week: tasks?.completedThisWeek ?? 0,
        verification_rate_change: {
          direction: tasks?.verificationPassRate?.direction ?? null,
          relative: tasks?.verificationPassRate?.relative ?? null,
          absolute: tasks?.verificationPassRate?.absolute ?? null,
        },
        top_open: (tasks?.topImpactTasks ?? []).slice(0, 5).map((task) => ({
          id: task.id,
          title: task.title,
        })),
      },
      risks_next_steps: [],
    },
  }
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
  const fallbackSummaryJson = buildSummaryJsonFromInput(nlrInput)
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
  const parsedSummaryJson = validateSummaryJson(inner) ? (inner as NlrSummaryJson) : null
  const summaryJson: NlrSummaryJson = parsedSummaryJson ?? fallbackSummaryJson
  const modelMarkdown = sanitizeMarkdown(markdown)
  const deterministicSummary = buildExecutiveSummaryFromJson(summaryJson)
  const summaryMarkdown = deterministicSummary
    || (!isJsonLikeText(modelMarkdown) ? modelMarkdown : '')

  // 4.5) Cost estimation
  const costUsd = estimateCost(usedModelId, tokensIn, tokensOut)
  const costCents = Math.round(costUsd * 100)

  // 5) Persist core and sections
  await prisma.weeklyReport.update({
    where: { id: report.id },
    data: {
      model: usedModelId,
      summaryJson: summaryJson as unknown as Prisma.InputJsonValue,
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
  // Resolve BrandProfile via Company.domain → Site → BrandProfile.companyWebsite
  // (BrandProfile.siteId is a tracking token, NOT a Site.id)
  try {
    const { resolveBrandProfileIds } = await import('@/lib/analysis/nlr/mappers/resolve-brand-profiles');
    const bpIds = await resolveBrandProfileIds(companyId);
    const profile = bpIds.length > 0
      ? await prisma.brandProfile.findFirst({
          where: { id: { in: bpIds } },
          select: { id: true, userId: true },
        })
      : null;
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

  const whatsChangedBody = (summaryJson?.sections?.whats_changed ?? [])
    .map((item: any) => `- ${item.label}`)
    .join('\n')
  const highlightsBody = (summaryJson?.sections?.highlights ?? [])
    .map((item: string) => `- ${item}`)
    .join('\n')

  // Persist lightweight section bodies used by dashboard/history.
  const sections: { key: string; title: string; bodyMarkdown: string }[] = []
  sections.push({ key: 'whats_changed', title: "What's Changed", bodyMarkdown: whatsChangedBody })
  sections.push({ key: 'highlights', title: "This Week's Highlights", bodyMarkdown: highlightsBody })

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
