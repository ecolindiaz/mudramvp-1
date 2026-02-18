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

/**
 * Escape a string for safe embedding inside a JS template literal
 * that contains a Python triple-quoted string ('''...''').
 *
 * Handles: backslashes, single quotes, newlines,
 * backticks (close the template literal), ${} (JS expression interpolation),
 * and triple-single-quotes (close the Python string).
 */
function escapeForPythonInTemplateLiteral(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
}

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
    const escapedSchema = escapeForPythonInTemplateLiteral(jsonLdSchema)
    
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
    
    # Required properties per type (Google structured data requirements)
    REQUIRED_PROPS = {
        'Organization': ['name', 'url'],
        'WebSite': ['name', 'url'],
        'Product': ['name'],
        'Service': ['name'],
        'Article': ['headline'],
        'BlogPosting': ['headline'],
        'FAQPage': ['mainEntity'],
        'BreadcrumbList': ['itemListElement'],
        'HowTo': ['name', 'step'],
        'SoftwareApplication': ['name'],
        'WebApplication': ['name'],
        'CollectionPage': ['name'],
        'OfferCatalog': ['name'],
        'VideoObject': ['name', 'thumbnailUrl', 'uploadDate'],
        'ItemList': ['itemListElement'],
        'Review': ['author', 'itemReviewed', 'reviewRating'],
        'Person': ['name'],
    }

    required = REQUIRED_PROPS.get(schema_type, [])
    for prop in required:
        if prop not in parsed:
            warnings.append(f"{schema_type} should have '{prop}' property")
    
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

code = '''${escapeForPythonInTemplateLiteral(code)}'''

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
    
    const escapedHtml = escapeForPythonInTemplateLiteral(html)
    
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

export interface FaqValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  faqCount: number
  hasPlaceholders: boolean
}

/**
 * Validate FAQ HTML/JSX in sandbox using BeautifulSoup.
 * Checks: HTML parses, 3-5 Q&A pairs, no placeholders, answers non-empty & ≤ 3 sentences,
 * no broken tags, semantic wrapper present.
 */
export async function validateFaqInSandbox(
  faqHtml: string
): Promise<SandboxResult<FaqValidationResult>> {
  return withSandbox(async (sandbox) => {
    await sandbox.runCode('!pip install beautifulsoup4 -q')

    const escapedHtml = escapeForPythonInTemplateLiteral(faqHtml)

    const result = await sandbox.runCode(`
import json
from bs4 import BeautifulSoup
import re

html = '''${escapedHtml}'''
errors = []
warnings = []
faq_count = 0
has_placeholders = False

# 1. Parse HTML
try:
    soup = BeautifulSoup(html, 'html.parser')
except Exception as e:
    errors.append(f"HTML parse error: {str(e)}")
    print(json.dumps({"valid": False, "errors": errors, "warnings": [], "faqCount": 0, "hasPlaceholders": False}))
    raise SystemExit

# 2. Check for broken/unclosed tags
raw_open = len(re.findall(r'<[a-zA-Z][^/>]*(?<!/)>', html))
raw_close = len(re.findall(r'</[a-zA-Z][^>]*>', html))
self_closing = len(re.findall(r'<[a-zA-Z][^>]*/\\s*>', html))
if abs(raw_open - self_closing - raw_close) > 2:
    warnings.append(f"Possible unclosed tags: {raw_open} opens, {raw_close} closes, {self_closing} self-closing")

# 3. Detect Q&A pairs via multiple patterns — try all, keep best
all_results = {}

# Pattern A: dt/dd
dt_pairs = []
for dl in soup.find_all('dl'):
    dts = dl.find_all('dt')
    dds = dl.find_all('dd')
    for dt, dd in zip(dts, dds):
        dt_pairs.append((dt.get_text().strip(), dd.get_text().strip()))
if dt_pairs:
    all_results['dt_dd'] = dt_pairs

# Pattern B: details/summary (check BEFORE heading pattern to avoid false match)
detail_pairs = []
for details in soup.find_all('details'):
    summary = details.find('summary')
    if summary:
        answer_text = details.get_text().replace(summary.get_text(), '').strip()
        if answer_text:
            detail_pairs.append((summary.get_text().strip(), answer_text))
if detail_pairs:
    all_results['details'] = detail_pairs

# Pattern C: h3 (or h2/h4) + following p (common FAQ pattern)
heading_pairs = []
for heading in soup.find_all(['h2', 'h3', 'h4']):
    answer_parts = []
    sibling = heading.find_next_sibling()
    while sibling and sibling.name in ['p', 'div', 'span']:
        # Skip if sibling contains details elements (handled by Pattern B)
        if sibling.find('details') or sibling.name == 'details':
            break
        answer_parts.append(sibling.get_text().strip())
        sibling = sibling.find_next_sibling()
        if sibling and sibling.name in ['h2', 'h3', 'h4']:
            break
    if answer_parts:
        heading_pairs.append((heading.get_text().strip(), ' '.join(answer_parts)))
if heading_pairs:
    all_results['heading'] = heading_pairs

# Pattern D: elements with question/answer classes or itemscope
scope_pairs = []
for q_elem in soup.find_all(attrs={"itemprop": "name"}):
    parent = q_elem.find_parent(attrs={"itemscope": True})
    if parent:
        a_elem = parent.find(attrs={"itemprop": "acceptedAnswer"})
        if a_elem:
            scope_pairs.append((q_elem.get_text().strip(), a_elem.get_text().strip()))
if scope_pairs:
    all_results['itemscope'] = scope_pairs

# Pick the pattern that found the most Q&A pairs
qa_pairs = []
if all_results:
    best_key = max(all_results, key=lambda k: len(all_results[k]))
    qa_pairs = all_results[best_key]

faq_count = len(qa_pairs)

if faq_count < 3:
    errors.append(f"Expected 3-5 Q&A pairs, found {faq_count}")
elif faq_count > 5:
    warnings.append(f"Expected 3-5 Q&A pairs, found {faq_count}")

# 4. Placeholder detection
placeholder_patterns = [
    r'\\[Replace', r'\\[Your', r'\\[Insert', r'TODO', r'PLACEHOLDER',
    r'Your question here', r'Your answer here', r'Lorem ipsum',
    r'\\[Company\\]', r'\\[Product\\]',
]
full_text = soup.get_text()
for pat in placeholder_patterns:
    if re.search(pat, full_text, re.IGNORECASE):
        has_placeholders = True
        warnings.append(f"Placeholder text detected: {pat}")
        break

# 5. Answer quality checks
for q, a in qa_pairs:
    if not a or len(a) < 10:
        warnings.append(f"Empty or too-short answer for: {q[:50]}")
    sentence_count = len(re.split(r'[.!?]+', a.strip()))
    if sentence_count > 4:
        warnings.append(f"Answer too long ({sentence_count} sentences) for: {q[:50]}")

# 6. Semantic wrapper check
has_wrapper = bool(soup.find('section') or soup.find('div') or soup.find('aside'))
if not has_wrapper and not html.strip().startswith('<'):
    warnings.append("No semantic wrapper element found (expected <section>, <div>, or similar)")

valid = len(errors) == 0
print(json.dumps({
    "valid": valid,
    "errors": errors,
    "warnings": warnings,
    "faqCount": faq_count,
    "hasPlaceholders": has_placeholders,
}))
    `)

    const output = result.logs?.stdout?.join('') || ''

    try {
      return JSON.parse(output.trim())
    } catch {
      return {
        valid: false,
        errors: [`Failed to parse validation output: ${output}`],
        warnings: [],
        faqCount: 0,
        hasPlaceholders: false,
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
    'ai_readable_content',
    'faq_sections',
  ]
  return E2B_REQUIRED_TYPES.includes(agentType)
}
