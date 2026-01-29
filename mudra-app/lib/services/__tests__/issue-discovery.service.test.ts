/**
 * Issue Discovery Service Tests
 */

import {
  getTiersForScore,
  getTierDescription,
  generateIssueHash,
  getLatestTechnicalScore,
  getLatestAIVisibilityScore
} from '../issue-discovery.service'

describe('Issue Discovery Service', () => {
  describe('getTiersForScore', () => {
    it('returns only fundamental for score 0', () => {
      expect(getTiersForScore(0)).toEqual(['fundamental'])
    })

    it('returns only fundamental for score 15', () => {
      expect(getTiersForScore(15)).toEqual(['fundamental'])
    })

    it('returns only fundamental for score 29', () => {
      expect(getTiersForScore(29)).toEqual(['fundamental'])
    })

    it('returns fundamental + intermediate for score 30', () => {
      expect(getTiersForScore(30)).toEqual(['fundamental', 'intermediate'])
    })

    it('returns fundamental + intermediate for score 45', () => {
      expect(getTiersForScore(45)).toEqual(['fundamental', 'intermediate'])
    })

    it('returns fundamental + intermediate for score 59', () => {
      expect(getTiersForScore(59)).toEqual(['fundamental', 'intermediate'])
    })

    it('returns up to advanced for score 60', () => {
      expect(getTiersForScore(60)).toEqual(['fundamental', 'intermediate', 'advanced'])
    })

    it('returns up to advanced for score 79', () => {
      expect(getTiersForScore(79)).toEqual(['fundamental', 'intermediate', 'advanced'])
    })

    it('returns all tiers for score 80', () => {
      expect(getTiersForScore(80)).toEqual(['fundamental', 'intermediate', 'advanced', 'polish'])
    })

    it('returns all tiers for score 100', () => {
      expect(getTiersForScore(100)).toEqual(['fundamental', 'intermediate', 'advanced', 'polish'])
    })
  })

  describe('getTierDescription', () => {
    it('returns description for fundamental', () => {
      const desc = getTierDescription('fundamental')
      expect(desc).toContain('basics')
      expect(desc).toContain('foundation')
    })

    it('returns description for intermediate', () => {
      const desc = getTierDescription('intermediate')
      expect(desc).toContain('Common')
    })

    it('returns description for advanced', () => {
      const desc = getTierDescription('advanced')
      expect(desc).toContain('Sophisticated')
    })

    it('returns description for polish', () => {
      const desc = getTierDescription('polish')
      expect(desc).toContain('Fine-tuning')
    })
  })

  describe('generateIssueHash', () => {
    it('generates consistent hash for same inputs', () => {
      const hash1 = generateIssueHash(1, 'technical_structure', 'Add Schema Markup')
      const hash2 = generateIssueHash(1, 'technical_structure', 'Add Schema Markup')
      expect(hash1).toBe(hash2)
    })

    it('generates different hash for different titles', () => {
      const hash1 = generateIssueHash(1, 'technical_structure', 'Add Schema Markup')
      const hash2 = generateIssueHash(1, 'technical_structure', 'Fix Heading Hierarchy')
      expect(hash1).not.toBe(hash2)
    })

    it('generates different hash for different brand profiles', () => {
      const hash1 = generateIssueHash(1, 'technical_structure', 'Add Schema Markup')
      const hash2 = generateIssueHash(2, 'technical_structure', 'Add Schema Markup')
      expect(hash1).not.toBe(hash2)
    })

    it('generates different hash for different categories', () => {
      const hash1 = generateIssueHash(1, 'technical_structure', 'Optimize Content')
      const hash2 = generateIssueHash(1, 'ai_visibility', 'Optimize Content')
      expect(hash1).not.toBe(hash2)
    })

    it('normalizes title case', () => {
      const hash1 = generateIssueHash(1, 'technical_structure', 'Add Schema Markup')
      const hash2 = generateIssueHash(1, 'technical_structure', 'add schema markup')
      expect(hash1).toBe(hash2)
    })

    it('normalizes whitespace', () => {
      const hash1 = generateIssueHash(1, 'technical_structure', 'Add Schema Markup')
      const hash2 = generateIssueHash(1, 'technical_structure', '  Add Schema Markup  ')
      expect(hash1).toBe(hash2)
    })

    it('returns a 16-character hash', () => {
      const hash = generateIssueHash(1, 'technical_structure', 'Add Schema Markup')
      expect(hash.length).toBe(16)
    })

    it('returns only hex characters', () => {
      const hash = generateIssueHash(1, 'technical_structure', 'Add Schema Markup')
      expect(hash).toMatch(/^[0-9a-f]+$/)
    })
  })
})

// Integration tests that require database
describe('Issue Discovery Service - Integration', () => {
  // These would require a test database setup
  describe.skip('getLatestTechnicalScore', () => {
    it('returns 0 when no analysis exists', async () => {
      const score = await getLatestTechnicalScore(99999)
      expect(score).toBe(0)
    })
  })

  describe.skip('getLatestAIVisibilityScore', () => {
    it('returns 0 when no analysis exists', async () => {
      const score = await getLatestAIVisibilityScore(99999)
      expect(score).toBe(0)
    })
  })
})
