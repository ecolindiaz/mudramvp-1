import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MudraBaseAgent, type AgentConfig, type AgentExecutionInput, type AgentExecutionOutput } from './base-agent'
import { prisma } from '@/lib/prisma'

// Mock Prisma client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    agentExecution: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    agentMemory: {
      upsert: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
    brandProfile: {
      findUnique: vi.fn(),
    },
  },
}))

// Test implementation of MudraBaseAgent
class TestAgent extends MudraBaseAgent {
  getAgentType(): string {
    return 'test_agent'
  }

  async execute(input: AgentExecutionInput): Promise<AgentExecutionOutput> {
    // Simple test implementation
    if (input.shouldFail) {
      throw new Error('Test execution failed')
    }
    return {
      success: true,
      data: { result: 'test completed' },
      metrics: { tokensUsed: 100, apiCost: 0.01 },
    }
  }
}

describe('MudraBaseAgent', () => {
  let agent: TestAgent
  const mockBrandProfileId = 1

  beforeEach(() => {
    vi.clearAllMocks()
    agent = new TestAgent({ brandProfileId: mockBrandProfileId })
  })

  describe('Constructor', () => {
    it('should initialize with required config', () => {
      const agent = new TestAgent({ brandProfileId: 1 })
      expect(agent).toBeInstanceOf(MudraBaseAgent)
    })

    it('should set default values for optional config', () => {
      const agent = new TestAgent({ brandProfileId: 1 })
      expect(agent['maxRetries']).toBe(3)
      expect(agent['retryDelay']).toBe(1000)
      expect(agent['timeout']).toBe(300000)
    })

    it('should allow custom config values', () => {
      const agent = new TestAgent({
        brandProfileId: 1,
        maxRetries: 5,
        retryDelay: 2000,
        timeout: 60000,
      })
      expect(agent['maxRetries']).toBe(5)
      expect(agent['retryDelay']).toBe(2000)
      expect(agent['timeout']).toBe(60000)
    })
  })

  describe('run', () => {
    it('should create execution record before running', async () => {
      const mockExecution = {
        id: 1,
        executionId: 'test-exec-123',
        brandProfileId: 1,
        agentType: 'test_agent',
        status: 'running',
      }

      vi.mocked(prisma.agentExecution.create).mockResolvedValue(mockExecution as any)
      vi.mocked(prisma.agentExecution.update).mockResolvedValue(mockExecution as any)

      await agent.run({ test: 'data' })

      expect(prisma.agentExecution.create).toHaveBeenCalledWith({
        data: {
          brandProfileId: mockBrandProfileId,
          agentType: 'test_agent',
          status: 'running',
          input: { test: 'data' },
          startedAt: expect.any(Date),
        },
      })
    })

    it('should update execution record on success', async () => {
      const mockExecution = {
        id: 1,
        executionId: 'test-exec-123',
      }

      vi.mocked(prisma.agentExecution.create).mockResolvedValue(mockExecution as any)
      vi.mocked(prisma.agentExecution.update).mockResolvedValue(mockExecution as any)

      const result = await agent.run({ test: 'data' })

      expect(result.success).toBe(true)
      expect(prisma.agentExecution.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          status: 'completed',
          completedAt: expect.any(Date),
        }),
      })
    })

    it('should handle execution failure', async () => {
      const mockExecution = {
        id: 1,
        executionId: 'test-exec-123',
      }

      vi.mocked(prisma.agentExecution.create).mockResolvedValue(mockExecution as any)
      vi.mocked(prisma.agentExecution.update).mockResolvedValue(mockExecution as any)

      const result = await agent.run({ shouldFail: true })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Test execution failed')
      expect(prisma.agentExecution.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          status: 'failed',
          errorMessage: 'Test execution failed',
        }),
      })
    })

    it('should track execution time', async () => {
      const mockExecution = {
        id: 1,
        executionId: 'test-exec-123',
      }

      vi.mocked(prisma.agentExecution.create).mockResolvedValue(mockExecution as any)
      vi.mocked(prisma.agentExecution.update).mockResolvedValue(mockExecution as any)

      await agent.run({ test: 'data' })

      const updateCall = vi.mocked(prisma.agentExecution.update).mock.calls[0][0]
      expect(updateCall.data.metrics).toHaveProperty('executionTime')
      expect(typeof updateCall.data.metrics.executionTime).toBe('number')
    })
  })

  describe('Memory Management', () => {
    beforeEach(() => {
      const mockExecution = {
        id: 1,
        executionId: 'test-exec-123',
      }
      vi.mocked(prisma.agentExecution.findFirst).mockResolvedValue(mockExecution as any)
      agent['executionId'] = 'test-exec-123'
    })

    describe('setMemory', () => {
      it('should store memory with key and value', async () => {
        vi.mocked(prisma.agentMemory.upsert).mockResolvedValue({} as any)

        await agent['setMemory']('test_key', { data: 'test' })

        expect(prisma.agentMemory.upsert).toHaveBeenCalledWith({
          where: {
            executionId_memoryKey: {
              executionId: 1,
              memoryKey: 'test_key',
            },
          },
          create: expect.objectContaining({
            memoryKey: 'test_key',
            memoryValue: { data: 'test' },
            agentType: 'test_agent',
          }),
          update: expect.objectContaining({
            memoryValue: { data: 'test' },
          }),
        })
      })

      it('should throw error if no active execution', async () => {
        const noExecAgent = new TestAgent({ brandProfileId: 1 })
        
        await expect(noExecAgent['setMemory']('test', 'value'))
          .rejects
          .toThrow('Cannot set memory without active execution')
      })

      it('should support expiration dates', async () => {
        vi.mocked(prisma.agentMemory.upsert).mockResolvedValue({} as any)
        const expiresAt = new Date('2025-12-31')

        await agent['setMemory']('test_key', { data: 'test' }, expiresAt)

        expect(prisma.agentMemory.upsert).toHaveBeenCalledWith({
          where: expect.any(Object),
          create: expect.objectContaining({
            expiresAt,
          }),
          update: expect.objectContaining({
            expiresAt,
          }),
        })
      })
    })

    describe('getMemory', () => {
      it('should retrieve memory by key', async () => {
        const mockMemory = {
          memoryKey: 'test_key',
          memoryValue: { data: 'test' },
        }
        vi.mocked(prisma.agentMemory.findFirst).mockResolvedValue(mockMemory as any)

        const result = await agent['getMemory']('test_key')

        expect(result).toEqual({ data: 'test' })
      })

      it('should return null if memory not found', async () => {
        vi.mocked(prisma.agentMemory.findFirst).mockResolvedValue(null)

        const result = await agent['getMemory']('nonexistent_key')

        expect(result).toBeNull()
      })

      it('should filter expired memory entries', async () => {
        vi.mocked(prisma.agentMemory.findFirst).mockResolvedValue(null)

        await agent['getMemory']('test_key')

        expect(prisma.agentMemory.findFirst).toHaveBeenCalledWith({
          where: {
            agentType: 'test_agent',
            memoryKey: 'test_key',
            OR: [
              { expiresAt: null },
              { expiresAt: { gte: expect.any(Date) } },
            ],
          },
          orderBy: { createdAt: 'desc' },
        })
      })
    })

    describe('clearMemory', () => {
      it('should delete memory by key', async () => {
        vi.mocked(prisma.agentMemory.deleteMany).mockResolvedValue({ count: 1 } as any)

        await agent['clearMemory']('test_key')

        expect(prisma.agentMemory.deleteMany).toHaveBeenCalledWith({
          where: {
            agentType: 'test_agent',
            memoryKey: 'test_key',
          },
        })
      })
    })
  })

  describe('Helper Methods', () => {
    describe('getBrandProfile', () => {
      it('should fetch brand profile by ID', async () => {
        const mockProfile = {
          id: 1,
          companyName: 'Test Company',
          companyWebsite: 'https://test.com',
        }
        vi.mocked(prisma.brandProfile.findUnique).mockResolvedValue(mockProfile as any)

        const result = await agent['getBrandProfile']()

        expect(result).toEqual(mockProfile)
        expect(prisma.brandProfile.findUnique).toHaveBeenCalledWith({
          where: { id: mockBrandProfileId },
        })
      })
    })

    describe('withRetry', () => {
      it('should succeed on first attempt', async () => {
        const successFn = vi.fn().mockResolvedValue('success')

        const result = await agent['withRetry'](successFn)

        expect(result).toBe('success')
        expect(successFn).toHaveBeenCalledTimes(1)
      })

      it('should retry on failure', async () => {
        const failThenSucceed = vi.fn()
          .mockRejectedValueOnce(new Error('First failure'))
          .mockResolvedValueOnce('success')

        const result = await agent['withRetry'](failThenSucceed, 3)

        expect(result).toBe('success')
        expect(failThenSucceed).toHaveBeenCalledTimes(2)
      })

      it('should throw after max retries', async () => {
        const alwaysFail = vi.fn().mockRejectedValue(new Error('Always fails'))

        await expect(agent['withRetry'](alwaysFail, 2))
          .rejects
          .toThrow('Always fails')

        expect(alwaysFail).toHaveBeenCalledTimes(3) // Initial + 2 retries
      })

      it('should use exponential backoff', async () => {
        const sleepSpy = vi.spyOn(agent as any, 'sleep').mockResolvedValue(undefined)
        const failTwice = vi.fn()
          .mockRejectedValueOnce(new Error('Fail 1'))
          .mockRejectedValueOnce(new Error('Fail 2'))
          .mockResolvedValueOnce('success')

        await agent['withRetry'](failTwice, 3)

        expect(sleepSpy).toHaveBeenCalledWith(1000) // First retry: 1000ms
        expect(sleepSpy).toHaveBeenCalledWith(2000) // Second retry: 2000ms
      })
    })

    describe('getExecutionHistory', () => {
      it('should fetch execution history for agent type', async () => {
        const mockHistory = [
          { id: 1, status: 'completed', createdAt: new Date() },
          { id: 2, status: 'failed', createdAt: new Date() },
        ]
        vi.mocked(prisma.agentExecution.findMany).mockResolvedValue(mockHistory as any)

        const result = await agent.getExecutionHistory(10)

        expect(result).toEqual(mockHistory)
        expect(prisma.agentExecution.findMany).toHaveBeenCalledWith({
          where: {
            brandProfileId: mockBrandProfileId,
            agentType: 'test_agent',
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        })
      })
    })
  })
})
