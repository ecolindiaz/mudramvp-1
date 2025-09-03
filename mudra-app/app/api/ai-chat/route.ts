import OpenAI from 'openai';
import { streamText } from 'ai'
import { openai as openaiProvider } from '@ai-sdk/openai'
import { getDefaultModel, getModelForDeepThinking } from '@/lib/config/ai-models';
import { buildUserContext, buildUserContextSummary } from '@/lib/ai/rag/user-context'
import { retrieve, rerankWithLLM } from '@/lib/ai/rag/retrieve'
import { getCache, setCache, hashKey } from '@/lib/ai/rag/cache'
import { authRateLimiter } from '@/lib/auth/rate-limiter'
import { prisma, getOpenTasks, setTaskStatus } from '@/lib/analysis/technical/repo'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    // Basic per-IP rate limiting: 15 requests/hour
    // Note: our authRateLimiter is designed for NextRequest, but we can adapt:
    try {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || '127.0.0.1'
      const urlForNext = new URL(req.url)
      const nextReq = { headers: req.headers } as any
      // Lightweight inline limiter using the same internal helpers
      // Fallback: skip if not compatible
      const g: any = globalThis as any
      g.__mudraRateLimit = g.__mudraRateLimit || new Map<string, { count: number; resetTime: number }>()
      const store: Map<string, { count: number; resetTime: number }> = g.__mudraRateLimit
      const key = `chat_${ip}`
      const now = Date.now()
      const entry = store.get(key)
      const durationMs = 60 * 60 * 1000 // 1 hour
      const max = 15
      if (!entry || now > entry.resetTime) {
        store.set(key, { count: 1, resetTime: now + durationMs })
      } else {
        if (entry.count >= max) {
          return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), { status: 429 })
        }
        entry.count++
      }
    } catch {}
    const url = new URL(req.url)
    const wantsStream = url.searchParams.get('stream') === '1' || req.headers.get('accept') === 'text/event-stream'

    const { messages, siteId, deepThink }: {
      messages: { role: 'user' | 'assistant'; content: string }[]
      siteId?: string
      deepThink?: boolean
    } = await req.json()

    // Build user context (compact, redacted)
    const resolvedSiteId = siteId || 'test-site-1'
    const userCtx = await buildUserContext({ siteId: resolvedSiteId })
    const { summary: userCtxSummary } = buildUserContextSummary(userCtx, 1200)

    // Retrieve context from KB (vector + hybrid via RPC)
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content || ''
    // Cache retrieval results for 10 minutes keyed by query+siteId
    const cacheKey = hashKey(['retrieve', resolvedSiteId, lastUserMsg])
    let initial = getCache<any[]>(cacheKey)
    if (!initial) {
      initial = await retrieve(lastUserMsg, { k: 12, queryText: lastUserMsg, filter: { isPublic: true } })
      setCache(cacheKey, initial, 10 * 60 * 1000)
    }
    const reranked = await rerankWithLLM(lastUserMsg, initial, 8)
    const citations = reranked.map((r) => ({ title: r.title, path: r.path, chunk_index: r.chunk_index ?? 0 }))
    const contextBlocks = reranked.map((r, i) => `[[${i + 1}]] ${r.title} — ${r.path}\n${r.content}`)

    // Build context-aware system prompt
    let systemPrompt = `You are Mudra AI, an assistant for the Mudra GEO platform. Use the provided user dashboard context and retrieved knowledge to answer with precise, actionable guidance. Always cite sources.

Rules:
- Be concise, factual, and beginner-friendly
- Keep temperature low (0.2)
- Never invent citations; only use the provided retrieved context
- When relevant, suggest a next action (e.g., mark task started)

Output JSON (markdown fenced) with fields:
{
  "answer": string,
  "citations": [{ "title": string, "path": string, "chunk_index": number }]
}`;

    // Add deep thinking instructions if requested
    if (deepThink) {
      systemPrompt += `\n\n**DEEP THINKING MODE ACTIVATED (OpenAI o3):**
You are now powered by OpenAI's most advanced reasoning model. Use your enhanced capabilities to:

**REASONING APPROACH:**
- Apply multi-step logical reasoning to break down complex problems
- Consider edge cases, dependencies, and interconnections
- Analyze potential failure points and mitigation strategies
- Think through the full implementation lifecycle

**COMPREHENSIVE ANALYSIS:**
- Provide detailed analysis with thorough reasoning chains
- Compare multiple approaches with quantified pros/cons
- Include technical implementation details, code architecture patterns
- Explain the "why" behind each recommendation with supporting evidence
- Consider scalability, performance, and maintainability implications

**ACTIONABLE INSIGHTS:**
- Create detailed step-by-step implementation guides
- Provide specific code examples with explanations
- Include testing strategies and validation approaches
- Give realistic timelines with breakdown of effort estimation
- Identify required resources, skills, and potential blockers

**STRATEGIC THINKING:**
- Connect solutions to broader business goals and GEO objectives
- Consider user experience and technical debt implications
- Analyze impact on existing systems and future extensibility
- Provide prioritization frameworks for implementation order

Use your advanced reasoning to provide the most thorough, accurate, and actionable response possible.`;
    }

    // Attach user context and retrieved content as assistant-only context blocks
    const contextHeader = `\n\n[USER_DASHBOARD_CONTEXT]\n${userCtxSummary}\n\n[RETRIEVED_CONTEXT]\n${contextBlocks.join('\n\n')}`

    // Get model configuration
    const modelConfig = deepThink ? getModelForDeepThinking() : getDefaultModel()
    
    // Define lightweight tools the model can call
    const tools = [
      {
        type: 'function' as const,
        function: {
          name: 'get_open_tasks',
          description: 'Return a concise list of open tasks for a site (top 10).',
          parameters: {
            type: 'object',
            properties: { siteId: { type: 'string' } },
            required: ['siteId'],
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'get_latest_score',
          description: 'Return the latest technical score for a site.',
          parameters: {
            type: 'object',
            properties: { siteId: { type: 'string' } },
            required: ['siteId'],
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'verify_task_by_template_key',
          description: 'Mark a task verified (idempotent) by templateKey for a site.',
          parameters: {
            type: 'object',
            properties: { siteId: { type: 'string' }, templateKey: { type: 'string' } },
            required: ['siteId', 'templateKey'],
          },
        },
      },
    ]

    const baseMessages: any[] = [
      ...messages,
    ]

    // Optional streaming via Vercel AI SDK
    if (wantsStream) {
      const result = await streamText({
        model: openaiProvider(modelConfig.model),
        system: systemPrompt + '\n\n' + contextHeader,
        messages: baseMessages,
        temperature: 0.2,
        tools: {
          get_open_tasks: {
            description: 'Return a concise list of open tasks for a site (top 10).',
            parameters: { type: 'object', properties: { siteId: { type: 'string' } }, required: ['siteId'] },
            execute: async ({ siteId }: { siteId: string }) => {
              const tasks = await getOpenTasks(siteId || resolvedSiteId)
              return tasks.slice(0, 10).map(t => ({ title: t.title, impact: t.impact, status: t.status }))
            },
          },
          get_latest_score: {
            description: 'Return the latest technical score for a site.',
            parameters: { type: 'object', properties: { siteId: { type: 'string' } }, required: ['siteId'] },
            execute: async ({ siteId }: { siteId: string }) => {
              const latest = await prisma.technicalScore.findFirst({ where: { snapshot: { siteId: siteId || resolvedSiteId } }, orderBy: { createdAt: 'desc' } })
              return latest ? { total: latest.total, createdAt: latest.createdAt } : null
            },
          },
          verify_task_by_template_key: {
            description: 'Mark a task verified (idempotent) by templateKey for a site.',
            parameters: { type: 'object', properties: { siteId: { type: 'string' }, templateKey: { type: 'string' } }, required: ['siteId', 'templateKey'] },
            execute: async ({ siteId, templateKey }: { siteId: string, templateKey: string }) => {
              const task = await prisma.task.findFirst({ where: { siteId: siteId || resolvedSiteId, templateKey }, orderBy: { createdAt: 'desc' } })
              if (!task) return { status: 'not_found' }
              const updated = await setTaskStatus(task.id, 'verified')
              return { status: updated.status }
            },
          },
        },
      })
      return result.toDataStreamResponse()
    }

    let response;
    try {
      response = await openai.chat.completions.create({
        model: modelConfig.model,
        messages: baseMessages,
        tools,
        tool_choice: 'auto',
        temperature: 0.2,
        max_tokens: modelConfig.settings.defaultMaxTokens,
      });
    } catch (modelError) {
      console.error('Model error, falling back to GPT-4:', modelError);
      const fallbackConfig = getDefaultModel();
      response = await openai.chat.completions.create({
        model: fallbackConfig.model,
        messages: baseMessages,
        tools,
        tool_choice: 'auto',
        temperature: 0.2,
        max_tokens: fallbackConfig.settings.defaultMaxTokens,
      });
    }

    // Handle tool calls (single round for idempotence/budget)
    const toolCalls = response.choices?.[0]?.message?.tool_calls || []
    let finalContent = response.choices?.[0]?.message?.content || ''
    if (toolCalls.length > 0) {
      const toolResults: any[] = []
      for (const call of toolCalls) {
        const name = call.function?.name
        let args: any = {}
        try { args = JSON.parse(call.function?.arguments || '{}') } catch {}

        if (name === 'get_open_tasks') {
          const site = args.siteId || resolvedSiteId
          const tasks = await getOpenTasks(site)
          toolResults.push({ id: call.id, name, result: tasks.slice(0, 10).map(t => ({ title: t.title, impact: t.impact, status: t.status })) })
        } else if (name === 'get_latest_score') {
          const site = args.siteId || resolvedSiteId
          const latest = await prisma.technicalScore.findFirst({ where: { snapshot: { siteId: site } }, orderBy: { createdAt: 'desc' } })
          toolResults.push({ id: call.id, name, result: latest ? { total: latest.total, createdAt: latest.createdAt } : null })
        } else if (name === 'verify_task_by_template_key') {
          const site = args.siteId || resolvedSiteId
          const tpl = args.templateKey
          const task = await prisma.task.findFirst({ where: { siteId: site, templateKey: tpl }, orderBy: { createdAt: 'desc' } })
          let status = 'not_found'
          if (task) {
            const updated = await setTaskStatus(task.id, 'verified')
            status = updated.status
          }
          toolResults.push({ id: call.id, name, result: { templateKey: tpl, status } })
        }
      }

      const toolMessages = toolResults.map((tr) => ({ role: 'tool' as const, tool_call_id: tr.id, content: JSON.stringify(tr.result) }))
      const followup = await openai.chat.completions.create({
        model: getDefaultModel().model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'assistant', content: contextHeader },
          ...messages,
          response.choices[0].message,
          ...toolMessages,
        ],
        temperature: 0.2,
        max_tokens: getDefaultModel().settings.defaultMaxTokens,
      })
      finalContent = followup.choices?.[0]?.message?.content || finalContent
    }

    const content = finalContent || 'Sorry, I could not process your request.';

    return new Response(
      JSON.stringify({ content, citations }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('AI Chat error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process chat request' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}