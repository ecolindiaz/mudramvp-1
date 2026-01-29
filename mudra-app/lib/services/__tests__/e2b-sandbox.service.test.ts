/**
 * E2B Sandbox Service Tests
 * 
 * Note: These tests require E2B_API_KEY to be set.
 * Skip E2B integration tests in CI without the key.
 */

import {
  validateSchemaInSandbox,
  testGeneratedCode,
  validateHtmlStructure,
  requiresE2bValidation,
  withSandbox
} from '../e2b-sandbox.service'

// Skip tests if no E2B API key
const describeWithE2B = process.env.E2B_API_KEY ? describe : describe.skip

describe('E2B Sandbox Service - Unit Tests', () => {
  describe('requiresE2bValidation', () => {
    it('returns true for schema_markup', () => {
      expect(requiresE2bValidation('schema_markup')).toBe(true)
    })

    it('returns true for schema_architect', () => {
      expect(requiresE2bValidation('schema_architect')).toBe(true)
    })

    it('returns true for ai_readable_content', () => {
      expect(requiresE2bValidation('ai_readable_content')).toBe(true)
    })

    it('returns false for llms_txt', () => {
      expect(requiresE2bValidation('llms_txt')).toBe(false)
    })

    it('returns false for citation_signals', () => {
      expect(requiresE2bValidation('citation_signals')).toBe(false)
    })

    it('returns false for reddit_opportunity', () => {
      expect(requiresE2bValidation('reddit_opportunity')).toBe(false)
    })
  })
})

describeWithE2B('E2B Sandbox Service - Integration Tests', () => {
  // E2B can take time to spin up
  jest.setTimeout(60000)

  describe('validateSchemaInSandbox', () => {
    it('validates correct JSON-LD Organization schema', async () => {
      const validSchema = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "Test Company",
        "url": "https://example.com"
      })

      const result = await validateSchemaInSandbox(validSchema)

      expect(result.success).toBe(true)
      expect(result.data?.valid).toBe(true)
      expect(result.data?.errors).toHaveLength(0)
      expect(result.executionMs).toBeLessThan(30000)
      expect(result.sandboxId).toBeDefined()
    })

    it('validates correct FAQ schema', async () => {
      const faqSchema = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "What is GEO?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Generative Engine Optimization"
            }
          }
        ]
      })

      const result = await validateSchemaInSandbox(faqSchema)

      expect(result.success).toBe(true)
      expect(result.data?.valid).toBe(true)
    })

    it('rejects invalid JSON', async () => {
      const invalidSchema = '{ not valid json }'

      const result = await validateSchemaInSandbox(invalidSchema)

      expect(result.success).toBe(true) // Sandbox worked
      expect(result.data?.valid).toBe(false)
      expect(result.data?.errors.length).toBeGreaterThan(0)
      expect(result.data?.errors[0]).toContain('JSON parse error')
    })

    it('reports missing @context', async () => {
      const missingContext = JSON.stringify({
        "@type": "Organization",
        "name": "Test"
      })

      const result = await validateSchemaInSandbox(missingContext)

      expect(result.success).toBe(true)
      expect(result.data?.valid).toBe(false)
      expect(result.data?.errors).toContain("Missing @context field")
    })

    it('reports missing @type', async () => {
      const missingType = JSON.stringify({
        "@context": "https://schema.org",
        "name": "Test"
      })

      const result = await validateSchemaInSandbox(missingType)

      expect(result.success).toBe(true)
      expect(result.data?.valid).toBe(false)
      expect(result.data?.errors).toContain("Missing @type field")
    })
  })

  describe('testGeneratedCode', () => {
    it('executes Python code and returns output', async () => {
      const result = await testGeneratedCode('print("Hello, E2B!")')

      expect(result.success).toBe(true)
      expect(result.data?.output).toContain('Hello, E2B!')
      expect(result.data?.exitCode).toBe(0)
    })

    it('returns non-zero exit code on Python error', async () => {
      const result = await testGeneratedCode('raise ValueError("Test error")')

      expect(result.success).toBe(true)
      expect(result.data?.exitCode).toBe(1)
    })

    it('executes JavaScript code via Node', async () => {
      const result = await testGeneratedCode('console.log("Hello from Node!")', 'javascript')

      expect(result.success).toBe(true)
      expect(result.data?.output).toContain('Hello from Node!')
    })

    it('handles multi-line Python code', async () => {
      const code = `
x = 5
y = 10
print(f"Sum: {x + y}")
`
      const result = await testGeneratedCode(code)

      expect(result.success).toBe(true)
      expect(result.data?.output).toContain('Sum: 15')
    })
  })

  describe('validateHtmlStructure', () => {
    it('extracts heading hierarchy', async () => {
      const html = `
        <html>
          <body>
            <h1>Main Title</h1>
            <h2>Section 1</h2>
            <h3>Subsection 1.1</h3>
            <h2>Section 2</h2>
          </body>
        </html>
      `

      const result = await validateHtmlStructure(html)

      expect(result.success).toBe(true)
      expect(result.data?.headingHierarchy).toHaveLength(4)
      expect(result.data?.headingHierarchy[0]).toEqual({ level: 1, text: 'Main Title' })
      expect(result.data?.headingHierarchy[1]).toEqual({ level: 2, text: 'Section 1' })
    })

    it('extracts JSON-LD schema from script tags', async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
              {"@context": "https://schema.org", "@type": "Organization", "name": "Test"}
            </script>
          </head>
        </html>
      `

      const result = await validateHtmlStructure(html)

      expect(result.success).toBe(true)
      expect(result.data?.schemaMarkup).toHaveLength(1)
      expect(result.data?.schemaMarkup[0]).toHaveProperty('@type', 'Organization')
    })

    it('extracts meta tags', async () => {
      const html = `
        <html>
          <head>
            <meta name="description" content="Test description">
            <meta property="og:title" content="OG Title">
          </head>
        </html>
      `

      const result = await validateHtmlStructure(html)

      expect(result.success).toBe(true)
      expect(result.data?.metaTags.length).toBeGreaterThan(0)
      expect(result.data?.metaTags).toContainEqual({ name: 'description', content: 'Test description' })
    })

    it('handles empty HTML gracefully', async () => {
      const result = await validateHtmlStructure('')

      expect(result.success).toBe(true)
      expect(result.data?.headingHierarchy).toEqual([])
      expect(result.data?.schemaMarkup).toEqual([])
    })
  })

  describe('withSandbox', () => {
    it('returns sandbox metadata', async () => {
      const result = await withSandbox(async () => 'test result')

      expect(result.success).toBe(true)
      expect(result.data).toBe('test result')
      expect(result.sandboxId).toBeDefined()
      expect(result.executionMs).toBeGreaterThan(0)
    })

    it('handles errors gracefully', async () => {
      const result = await withSandbox(async () => {
        throw new Error('Test error')
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Test error')
      expect(result.sandboxId).toBeDefined()
    })
  })
})
