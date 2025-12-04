import { prisma } from '@/lib/prisma'
import type { BrandProfile } from '@prisma/client'

export interface AgentConfig {
  brandProfileId: number
  maxRetries?: number
  retryDelay?: number
  timeout?: number
}

export interface AgentExecutionInput {
  [key: string]: unknown
}

export interface AgentExecutionOutput {
  success: boolean
  data?: unknown
  error?: string
  metrics?: {
    tokensUsed?: number
    apiCost?: number
    executionTime?: number
  }
}

export interface AgentMemoryEntry {
  key: string
  value: unknown
  expiresAt?: Date
}

/**
 * Base abstract class for all Mudra autonomous agents
 * Provides core functionality: execution tracking, memory management, error handling
 */
export abstract class MudraBaseAgent {
  protected brandProfileId: number
  protected maxRetries: number
  protected retryDelay: number
  protected timeout: number
  protected executionId?: string

  constructor(config: AgentConfig) {
    this.brandProfileId = config.brandProfileId
    this.maxRetries = config.maxRetries ?? 3
    this.retryDelay = config.retryDelay ?? 1000
    this.timeout = config.timeout ?? 300000 // 5 minutes default
  }

  /**
   * Abstract method that must be implemented by each agent
   * Contains the core agent logic
   */
  abstract execute(input: AgentExecutionInput): Promise<AgentExecutionOutput>

  /**
   * Get the agent type identifier (must be implemented by subclass)
   */
  abstract getAgentType(): string

  /**
   * Run the agent with full execution tracking
   */
  async run(input: AgentExecutionInput): Promise<AgentExecutionOutput> {
    const startTime = Date.now()
    let execution

    try {
      // Create execution record
      execution = await prisma.agentExecution.create({
        data: {
          brandProfileId: this.brandProfileId,
          agentType: this.getAgentType(),
          status: 'running',
          input: input as any,
          startedAt: new Date(),
        },
      })

      this.executionId = execution.executionId

      // Execute agent logic
      const result = await this.execute(input)

      // Calculate execution time
      const executionTime = Date.now() - startTime

      // Update execution with results
      await prisma.agentExecution.update({
        where: { id: execution.id },
        data: {
          status: result.success ? 'completed' : 'failed',
          output: result.data as any,
          metrics: {
            ...result.metrics,
            executionTime,
          },
          errorMessage: result.error,
          completedAt: new Date(),
        },
      })

      return result
    } catch (error) {
      const executionTime = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Update execution with error
      if (execution) {
        await prisma.agentExecution.update({
          where: { id: execution.id },
          data: {
            status: 'failed',
            errorMessage,
            metrics: { executionTime },
            completedAt: new Date(),
          },
        })
      }

      return {
        success: false,
        error: errorMessage,
        metrics: { executionTime },
      }
    }
  }

  /**
   * Store data in agent memory
   */
  protected async setMemory(key: string, value: unknown, expiresAt?: Date): Promise<void> {
    if (!this.executionId) {
      throw new Error('Cannot set memory without active execution')
    }

    const execution = await prisma.agentExecution.findFirst({
      where: { executionId: this.executionId },
    })

    if (!execution) {
      throw new Error('Execution not found')
    }

    await prisma.agentMemory.upsert({
      where: {
        executionId_memoryKey: {
          executionId: execution.id,
          memoryKey: key,
        },
      },
      create: {
        executionId: execution.id,
        agentType: this.getAgentType(),
        memoryKey: key,
        memoryValue: value as any,
        expiresAt,
      },
      update: {
        memoryValue: value as any,
        expiresAt,
        updatedAt: new Date(),
      },
    })
  }

  /**
   * Retrieve data from agent memory
   */
  protected async getMemory<T = unknown>(key: string): Promise<T | null> {
    const memory = await prisma.agentMemory.findFirst({
      where: {
        agentType: this.getAgentType(),
        memoryKey: key,
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    })

    return memory ? (memory.memoryValue as T) : null
  }

  /**
   * Clear specific memory entry
   */
  protected async clearMemory(key: string): Promise<void> {
    await prisma.agentMemory.deleteMany({
      where: {
        agentType: this.getAgentType(),
        memoryKey: key,
      },
    })
  }

  /**
   * Get brand profile data
   */
  protected async getBrandProfile(): Promise<BrandProfile | null> {
    return prisma.brandProfile.findUnique({
      where: { id: this.brandProfileId },
    })
  }

  /**
   * Retry wrapper for API calls
   */
  protected async withRetry<T>(
    fn: () => Promise<T>,
    retries: number = this.maxRetries
  ): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        if (attempt < retries) {
          await this.sleep(this.retryDelay * Math.pow(2, attempt)) // Exponential backoff
        }
      }
    }

    throw lastError
  }

  /**
   * Sleep utility
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get execution history for this agent type
   */
  async getExecutionHistory(limit: number = 10) {
    return prisma.agentExecution.findMany({
      where: {
        brandProfileId: this.brandProfileId,
        agentType: this.getAgentType(),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }
}
