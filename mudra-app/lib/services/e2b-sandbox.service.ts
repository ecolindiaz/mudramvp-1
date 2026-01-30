/**
 * E2B Sandbox Service
 * 
 * Provides sandboxed code execution for validating agent-generated code
 * before committing to GitHub PRs.
 * 
 * Uses E2B Code Interpreter for:
 * - JSON-LD schema validation
 * - HTML structure analysis
 * - Generated code testing
 */

import { Sandbox } from '@e2b/code-interpreter'

const E2B_TIMEOUT_MS = 30000 // 30 second timeout

export interface SandboxResult<T> {
  success: boolean
  data?: T
  error?: string
  executionMs: number
  sandboxId: string
}

export interface SchemaValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  expanded?: object
}

export interface HtmlAnalysisResult {
  headingHierarchy: { level: number; text: string }[]
  schemaMarkup: object[]
  metaTags: { name: string; content: string }[]
  faqSections: { question: string; answer: string }[]
}

export interface CodeExecutionResult {
  output: string
  exitCode: number
}

/**
 * Generic sandbox wrapper with timeout and lifecycle management
 */
export async function withSandbox<T>(
  fn: (sandbox: Sandbox) => Promise<T>
): Promise<SandboxResult<T>> {
  const startTime = Date.now()
  let sandbox: Sandbox | null = null
  
  try {
    sandbox = await Sandbox.create()
    
    const data = await Promise.race([
      fn(sandbox),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('E2B sandbox timeout')), E2B_TIMEOUT_MS)
      )
    ])
    
    return {
      success: true,
      data,
      executionMs: Date.now() - startTime,
      sandboxId: sandbox.sandboxId
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown sandbox error',
      executionMs: Date.now() - startTime,
      sandboxId: sandbox?.sandboxId || 'unknown'
    }
  } finally {
    if (sandbox) {
      try {
        await sandbox.kill()
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Validate JSON-LD schema markup in sandbox
 * Uses Python for JSON syntax validation (skips remote context fetching)
 */
export async function validateSchemaInSandbox(
  jsonLdSchema: string
): Promise<SandboxResult<SchemaValidationResult>> {
  return withSandbox(async (sandbox) => {
    // Escape the schema for Python string
    const escapedSchema = jsonLdSchema
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
    
    // Validate JSON-LD structure without fetching remote contexts
    // E2B sandboxes have limited internet access, so we skip expansion
    const result = await sandbox.runCode(`
import json

schema_str = '''${escapedSchema}'''
errors = []
warnings = []

try:
    parsed = json.loads(schema_str)
    
    # Check for required JSON-LD fields
    if '@context' not in parsed:
        errors.append("Missing @context field")
    elif parsed.get('@context') not in ['https://schema.org', 'http://schema.org', 'https://schema.org/']:
        warnings.append(f"Non-standard @context: {parsed.get('@context')}")
    
    if '@type' not in parsed:
        errors.append("Missing @type field")
    
    # Validate common schema.org types
    valid_types = [
        'Organization', 'LocalBusiness', 'Product', 'Service', 'FAQPage',
        'Article', 'BlogPosting', 'WebPage', 'WebSite', 'Person', 'Event',
        'HowTo', 'Recipe', 'Review', 'AggregateRating', 'BreadcrumbList',
        'ItemList', 'SoftwareApplication', 'MobileApplication', 'Course',
        'JobPosting', 'Offer', 'Place', 'Restaurant', 'Store', 'Brand'
    ]
    schema_type = parsed.get('@type', '')
    if schema_type and schema_type not in valid_types:
        warnings.append(f"Uncommon @type: {schema_type} (may still be valid)")
    
    # Check for common properties based on type
    if schema_type == 'Organization':
        if 'name' not in parsed:
            warnings.append("Organization should have 'name' property")
    elif schema_type == 'Product':
        if 'name' not in parsed:
            warnings.append("Product should have 'name' property")
    elif schema_type == 'FAQPage':
        if 'mainEntity' not in parsed:
            warnings.append("FAQPage should have 'mainEntity' property")
    
    result = {
        "valid": len(errors) == 0, 
        "errors": errors, 
        "warnings": warnings,
        "parsed": parsed
    }
        
except json.JSONDecodeError as e:
    result = {"valid": False, "errors": [f"JSON parse error: {str(e)}"], "warnings": []}
except Exception as e:
    result = {"valid": False, "errors": [f"Unexpected error: {str(e)}"], "warnings": []}

print(json.dumps(result))
    `)
    
    const output = result.logs?.stdout?.join('') || ''
    
    try {
      return JSON.parse(output.trim())
    } catch {
      return {
        valid: false,
        errors: [`Failed to parse validation output: ${output}`],
        warnings: []
      }
    }
  })
}

/**
 * Execute Python or JavaScript code in sandbox and return output
 */
export async function testGeneratedCode(
  code: string,
  language: 'python' | 'javascript' = 'python'
): Promise<SandboxResult<CodeExecutionResult>> {
  return withSandbox(async (sandbox) => {
    if (language === 'javascript') {
      // For JavaScript, we'll run it through Node
      const result = await sandbox.runCode(`
import subprocess
import json

code = '''${code.replace(/'/g, "\\'")}'''

# Write to temp file and run with Node
with open('/tmp/test.js', 'w') as f:
    f.write(code)

result = subprocess.run(['node', '/tmp/test.js'], capture_output=True, text=True)
print(json.dumps({"output": result.stdout + result.stderr, "exitCode": result.returncode}))
      `)
      
      const output = result.logs?.stdout?.join('') || ''
      return JSON.parse(output.trim())
    } else {
      // Python code runs directly
      const result = await sandbox.runCode(code)
      return {
        output: result.logs?.stdout?.join('\n') || '',
        exitCode: result.error ? 1 : 0
      }
    }
  })
}

/**
 * Analyze HTML structure in sandbox using BeautifulSoup
 */
export async function validateHtmlStructure(
  html: string
): Promise<SandboxResult<HtmlAnalysisResult>> {
  return withSandbox(async (sandbox) => {
    // Install beautifulsoup4
    await sandbox.runCode('!pip install beautifulsoup4 -q')
    
    // Escape HTML for Python
    const escapedHtml = html
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
    
    const result = await sandbox.runCode(`
import json
from bs4 import BeautifulSoup

html = '''${escapedHtml}'''
soup = BeautifulSoup(html, 'html.parser')

# Extract heading hierarchy
headings = []
for tag in soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']):
    headings.append({"level": int(tag.name[1]), "text": tag.get_text().strip()})

# Extract JSON-LD schemas
schemas = []
for script in soup.find_all('script', type='application/ld+json'):
    if script.string:
        try:
            schemas.append(json.loads(script.string))
        except:
            pass

# Extract meta tags
meta_tags = []
for meta in soup.find_all('meta'):
    name = meta.get('name') or meta.get('property', '')
    content = meta.get('content', '')
    if name and content:
        meta_tags.append({"name": name, "content": content})

# Extract FAQ sections (common patterns)
faqs = []
# Look for dl/dt/dd patterns
for dl in soup.find_all('dl'):
    dts = dl.find_all('dt')
    dds = dl.find_all('dd')
    for dt, dd in zip(dts, dds):
        faqs.append({"question": dt.get_text().strip(), "answer": dd.get_text().strip()})

# Look for question/answer class patterns
for q_elem in soup.find_all(class_=lambda x: x and 'question' in x.lower()):
    next_sibling = q_elem.find_next_sibling()
    if next_sibling:
        faqs.append({"question": q_elem.get_text().strip(), "answer": next_sibling.get_text().strip()})

print(json.dumps({
    "headingHierarchy": headings,
    "schemaMarkup": schemas,
    "metaTags": meta_tags,
    "faqSections": faqs
}))
    `)
    
    const output = result.logs?.stdout?.join('') || ''
    
    try {
      return JSON.parse(output.trim())
    } catch {
      return {
        headingHierarchy: [],
        schemaMarkup: [],
        metaTags: [],
        faqSections: []
      }
    }
  })
}

/**
 * Check if an issue type requires E2B validation
 */
export function requiresE2bValidation(agentType: string): boolean {
  const E2B_REQUIRED_TYPES = [
    'schema_markup',
    'schema_architect',
    'ai_readable_content',
    'json_ld_generation',
    'structured_data'
  ]
  return E2B_REQUIRED_TYPES.includes(agentType)
}
