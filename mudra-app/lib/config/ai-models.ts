/**
 * AI Model Configuration for Mudra Platform
 * Manages different AI models, their capabilities, and cost implications
 */

export interface AIModelConfig {
  id: string
  name: string
  provider: 'openai' | 'anthropic' | 'google' | 'perplexity'
  model: string
  description: string
  capabilities: {
    reasoning: 'basic' | 'advanced' | 'highest'
    speed: 'fastest' | 'fast' | 'medium' | 'slow' | 'slowest'
    contextWindow: number
    maxOutputTokens: number
  }
  pricing: {
    inputCostPer1M: number // USD per 1M input tokens
    outputCostPer1M: number // USD per 1M output tokens
  }
  settings: {
    defaultTemperature: number
    defaultMaxTokens: number
  }
  bestFor: string[]
}

export const AI_MODELS: Record<string, AIModelConfig> = {
  'gpt-4': {
    id: 'gpt-4',
    name: 'GPT-4',
    provider: 'openai',
    model: 'gpt-4',
    description: 'Balanced model for general conversations and tasks',
    capabilities: {
      reasoning: 'advanced',
      speed: 'medium',
      contextWindow: 8192,
      maxOutputTokens: 4096
    },
    pricing: {
      inputCostPer1M: 30.00,
      outputCostPer1M: 60.00
    },
    settings: {
      defaultTemperature: 0.7,
      defaultMaxTokens: 1000
    },
    bestFor: ['general chat', 'quick analysis', 'basic optimization tasks']
  },
  'o3': {
    id: 'o3',
    name: 'OpenAI o3',
    provider: 'openai',
    model: 'gpt-4-0125-preview', // TODO: Change to 'o3' when OpenAI o3 becomes publicly available
    description: 'Most powerful reasoning model for complex analysis and deep thinking',
    capabilities: {
      reasoning: 'highest',
      speed: 'slowest',
      contextWindow: 200000,
      maxOutputTokens: 100000
    },
    pricing: {
      inputCostPer1M: 2000.00, // $2.00 per 1M tokens
      outputCostPer1M: 8000.00  // $8.00 per 1M tokens
    },
    settings: {
      defaultTemperature: 0.3,
      defaultMaxTokens: 100000
    },
    bestFor: [
      'complex problem solving',
      'detailed technical analysis', 
      'multi-step reasoning',
      'architecture planning',
      'comprehensive optimization strategies'
    ]
  }
}

export const getModelConfig = (modelId: string): AIModelConfig | null => {
  return AI_MODELS[modelId] || null
}

export const getModelForDeepThinking = (): AIModelConfig => {
  return AI_MODELS['o3']
}

export const getDefaultModel = (): AIModelConfig => {
  return AI_MODELS['gpt-4']
}

/**
 * Estimates the cost of a request based on token usage
 */
export const estimateCost = (
  modelId: string, 
  inputTokens: number, 
  outputTokens: number
): number => {
  const model = getModelConfig(modelId)
  if (!model) return 0
  
  const inputCost = (inputTokens / 1000000) * model.pricing.inputCostPer1M
  const outputCost = (outputTokens / 1000000) * model.pricing.outputCostPer1M
  
  return inputCost + outputCost
}

/**
 * Formats cost as a user-friendly string
 */
export const formatCost = (cost: number): string => {
  if (cost < 0.01) return '< $0.01'
  return `$${cost.toFixed(2)}`
}