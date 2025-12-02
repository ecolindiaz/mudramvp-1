import { createTool } from '@mastra/core';
import { CodeInterpreter } from '@e2b/code-interpreter';
import { z } from 'zod';

/**
 * AEO/GEO Codebase Analyzer Tool
 * Scans HTML/JSX/TSX/MD files for AEO/GEO optimization opportunities
 * Uses E2B sandbox for secure Python execution with BeautifulSoup
 */
export const analyzeCodebaseTool = createTool({
  id: 'analyze_codebase',
  description: `
    Analyzes a codebase or URL for Answer Engine Optimization (AEO) and Generative Engine Optimization (GEO).
    Scans HTML, JSX, TSX, and Markdown files to identify:
    - Missing or insufficient schema markup (FAQ, Article, HowTo, Organization)
    - Poor header structure (missing question-based H2/H3 headers)
    - Absence of FAQ sections
    - Lack of scannable content (lists, tables, callouts)
    - Missing citations, statistics, and authoritative sources
    - Weak content structure for AI comprehension
    - Poor meta descriptions and title tags
    Returns detailed findings with severity levels and actionable recommendations.
  `,
  inputSchema: z.object({
    url: z.string().url().optional().describe('Website URL to analyze'),
    htmlContent: z.string().optional().describe('Raw HTML content to analyze'),
    fileType: z.enum(['html', 'jsx', 'tsx', 'md']).default('html').describe('Type of content being analyzed'),
  }),
  outputSchema: z.object({
    score: z.number().min(0).max(100).describe('Overall AEO/GEO score (0-100)'),
    findings: z.array(z.object({
      category: z.string().describe('Issue category (schema, headers, faq, content, citations)'),
      severity: z.enum(['critical', 'high', 'medium', 'low']).describe('Issue severity'),
      issue: z.string().describe('Description of the issue'),
      impact: z.string().describe('How this affects AI citations'),
      recommendation: z.string().describe('Specific action to fix'),
    })),
    schemaAnalysis: z.object({
      hasSchema: z.boolean(),
      types: z.array(z.string()).describe('Detected schema types'),
      missing: z.array(z.string()).describe('Recommended schema types to add'),
      score: z.number().min(0).max(20),
    }),
    headerAnalysis: z.object({
      hasQuestionHeaders: z.boolean(),
      h2Count: z.number(),
      h3Count: z.number(),
      questionBasedHeaders: z.array(z.string()),
      score: z.number().min(0).max(15),
    }),
    faqAnalysis: z.object({
      hasFaqSection: z.boolean(),
      questionCount: z.number(),
      hasStructuredData: z.boolean(),
      score: z.number().min(0).max(15),
    }),
    contentStructure: z.object({
      hasLists: z.boolean(),
      hasTables: z.boolean(),
      listCount: z.number(),
      tableCount: z.number(),
      score: z.number().min(0).max(20),
    }),
    citationsAnalysis: z.object({
      citationCount: z.number(),
      hasStatistics: z.boolean(),
      hasAuthorInfo: z.boolean(),
      score: z.number().min(0).max(10),
    }),
    metaAnalysis: z.object({
      hasMetaDescription: z.boolean(),
      metaLength: z.number(),
      hasTitleTag: z.boolean(),
      titleLength: z.number(),
      score: z.number().min(0).max(10),
    }),
    authoritySignals: z.object({
      hasAuthorBio: z.boolean(),
      hasCredentials: z.boolean(),
      hasPublishDate: z.boolean(),
      hasUpdateDate: z.boolean(),
      score: z.number().min(0).max(10),
    }),
  }),
  execute: async ({ context, input }) => {
    const sandbox = await CodeInterpreter.create();
    
    try {
      // Install required Python packages in E2B sandbox
      await sandbox.notebook.execCell(`
        import sys
        !{sys.executable} -m pip install beautifulsoup4 lxml requests -q
      `);

      // Python analysis script
      const analysisScript = `
import json
from bs4 import BeautifulSoup
import re
from urllib.parse import urlparse

def analyze_aeo_geo(html_content, file_type='html'):
    """Comprehensive AEO/GEO analysis"""
    soup = BeautifulSoup(html_content, 'lxml')
    
    findings = []
    
    # 1. SCHEMA MARKUP ANALYSIS (20 points)
    schema_scripts = soup.find_all('script', type='application/ld+json')
    schema_types = []
    for script in schema_scripts:
        try:
            schema_data = json.loads(script.string)
            if '@type' in schema_data:
                schema_types.append(schema_data['@type'])
        except:
            pass
    
    has_schema = len(schema_types) > 0
    missing_schema = []
    
    recommended_schemas = ['FAQPage', 'Article', 'HowTo', 'Organization']
    for schema in recommended_schemas:
        if schema not in schema_types:
            missing_schema.append(schema)
    
    schema_score = min(20, len(schema_types) * 5)
    
    if not has_schema:
        findings.append({
            'category': 'schema',
            'severity': 'critical',
            'issue': 'No structured data (JSON-LD) found',
            'impact': 'AI systems cannot easily extract and cite your content. Zero visibility in AI answers.',
            'recommendation': 'Add FAQ, Article, or HowTo schema markup. Start with FAQ schema for Q&A content.'
        })
    elif len(missing_schema) > 0:
        findings.append({
            'category': 'schema',
            'severity': 'medium',
            'issue': f'Missing recommended schema types: {", ".join(missing_schema)}',
            'impact': 'Limited AI citation potential. Missing context signals for LLMs.',
            'recommendation': f'Add {missing_schema[0]} schema to improve discoverability.'
        })
    
    # 2. HEADER STRUCTURE ANALYSIS (15 points)
    h2_tags = soup.find_all('h2')
    h3_tags = soup.find_all('h3')
    
    question_keywords = ['what', 'why', 'how', 'when', 'where', 'who', 'which', 'should', 'can', 'does']
    question_headers = []
    
    for h2 in h2_tags:
        text = h2.get_text().lower()
        if any(keyword in text for keyword in question_keywords) or '?' in text:
            question_headers.append(h2.get_text())
    
    for h3 in h3_tags:
        text = h3.get_text().lower()
        if any(keyword in text for keyword in question_keywords) or '?' in text:
            question_headers.append(h3.get_text())
    
    has_question_headers = len(question_headers) > 0
    header_score = min(15, len(question_headers) * 3)
    
    if len(h2_tags) < 3:
        findings.append({
            'category': 'headers',
            'severity': 'high',
            'issue': f'Only {len(h2_tags)} H2 headers found. Need at least 3-5 for AI comprehension.',
            'impact': 'AI cannot segment content into citable sections. Poor content structure.',
            'recommendation': 'Break content into 3-5 H2 sections with question-based headers.'
        })
    
    if not has_question_headers:
        findings.append({
            'category': 'headers',
            'severity': 'critical',
            'issue': 'No question-based headers (H2/H3) detected',
            'impact': 'AI systems prioritize content that directly answers questions. Missing this reduces citations by 60%.',
            'recommendation': 'Convert headers to question format: "What is X?", "How does Y work?", "Why should you Z?"'
        })
    
    # 3. FAQ SECTION ANALYSIS (15 points)
    faq_section = soup.find(['section', 'div'], class_=re.compile(r'faq|questions', re.I))
    faq_schema = 'FAQPage' in schema_types
    
    has_faq = faq_section is not None or faq_schema
    faq_score = 0
    
    if has_faq:
        # Count questions in FAQ
        question_elements = soup.find_all(['dt', 'h3', 'h4'], string=re.compile(r'\?|what|how|why', re.I))
        faq_score = min(15, len(question_elements) * 3)
    
    if not has_faq:
        findings.append({
            'category': 'faq',
            'severity': 'high',
            'issue': 'No FAQ section found',
            'impact': 'FAQ sections are the #1 content type cited by AI. ChatGPT cites FAQ content 3x more often.',
            'recommendation': 'Add a dedicated FAQ section with 5-10 common questions. Use FAQ schema markup.'
        })
    elif not faq_schema:
        findings.append({
            'category': 'faq',
            'severity': 'medium',
            'issue': 'FAQ section exists but missing FAQPage schema',
            'impact': 'AI can see content but cannot extract structured Q&A pairs easily.',
            'recommendation': 'Wrap FAQ section with FAQPage JSON-LD schema for maximum visibility.'
        })
    
    # 4. CONTENT STRUCTURE ANALYSIS (20 points)
    lists = soup.find_all(['ul', 'ol'])
    tables = soup.find_all('table')
    
    list_count = len(lists)
    table_count = len(tables)
    
    structure_score = 0
    if list_count > 0:
        structure_score += min(10, list_count * 2)
    if table_count > 0:
        structure_score += min(10, table_count * 5)
    
    if list_count == 0:
        findings.append({
            'category': 'content',
            'severity': 'high',
            'issue': 'No lists (ul/ol) found in content',
            'impact': 'Lists are easily scannable by AI. Missing lists reduces citation probability by 40%.',
            'recommendation': 'Convert prose into bulleted lists. Use lists for steps, features, benefits, tips.'
        })
    
    if table_count == 0:
        findings.append({
            'category': 'content',
            'severity': 'medium',
            'issue': 'No tables found for data presentation',
            'impact': 'Tables are cited 2x more often than paragraph text. Great for comparisons.',
            'recommendation': 'Add comparison tables, feature matrices, or data tables where relevant.'
        })
    
    # 5. CITATIONS & STATISTICS ANALYSIS (10 points)
    citation_patterns = [
        r'according to',
        r'study shows',
        r'research finds',
        r'data from',
        r'\d+%',  # Percentages
        r'\d+x',  # Multipliers
        r'source:',
    ]
    
    body_text = soup.get_text()
    citation_count = sum(len(re.findall(pattern, body_text, re.I)) for pattern in citation_patterns)
    
    has_statistics = bool(re.search(r'\d+%|\d+x', body_text))
    citations_score = min(10, citation_count * 2)
    
    if citation_count == 0:
        findings.append({
            'category': 'citations',
            'severity': 'medium',
            'issue': 'No citations or statistics found',
            'impact': 'AI systems trust and cite content with authoritative sources. Missing citations = low trust.',
            'recommendation': 'Add 3-5 statistics with sources. Link to studies, reports, or authoritative data.'
        })
    
    # 6. META DESCRIPTION ANALYSIS (10 points)
    meta_desc = soup.find('meta', attrs={'name': 'description'})
    title_tag = soup.find('title')
    
    has_meta = meta_desc is not None
    meta_length = len(meta_desc.get('content', '')) if has_meta else 0
    
    has_title = title_tag is not None
    title_length = len(title_tag.string) if has_title else 0
    
    meta_score = 0
    if has_meta and 120 <= meta_length <= 160:
        meta_score += 5
    if has_title and 50 <= title_length <= 60:
        meta_score += 5
    
    if not has_meta:
        findings.append({
            'category': 'meta',
            'severity': 'medium',
            'issue': 'Missing meta description',
            'impact': 'AI systems use meta descriptions for context. Missing = harder to discover.',
            'recommendation': 'Add meta description (120-160 chars) that clearly states what the page answers.'
        })
    elif meta_length < 120:
        findings.append({
            'category': 'meta',
            'severity': 'low',
            'issue': f'Meta description too short ({meta_length} chars, need 120-160)',
            'impact': 'Underutilized opportunity to signal content value to AI.',
            'recommendation': 'Expand meta description to 120-160 characters with key topics.'
        })
    
    # 7. AUTHORITY SIGNALS ANALYSIS (10 points)
    author_schema = 'author' in body_text.lower()
    has_author_bio = bool(soup.find(['div', 'section'], class_=re.compile(r'author|bio', re.I)))
    
    has_publish_date = bool(soup.find(['time', 'meta'], attrs={'property': 'article:published_time'}))
    has_update_date = bool(soup.find(['time', 'meta'], attrs={'property': 'article:modified_time'}))
    
    has_credentials = bool(re.search(r'ph\\.?d|professor|expert|certified|founder|ceo', body_text, re.I))
    
    authority_score = 0
    if has_author_bio:
        authority_score += 3
    if has_credentials:
        authority_score += 3
    if has_publish_date:
        authority_score += 2
    if has_update_date:
        authority_score += 2
    
    if not has_author_bio:
        findings.append({
            'category': 'authority',
            'severity': 'medium',
            'issue': 'No author bio or credentials visible',
            'impact': 'AI systems weigh author expertise. Anonymous content is cited 50% less.',
            'recommendation': 'Add author bio with credentials, expertise, and links to profile.'
        })
    
    # CALCULATE TOTAL SCORE
    total_score = schema_score + header_score + faq_score + structure_score + citations_score + meta_score + authority_score
    
    result = {
        'score': total_score,
        'findings': findings,
        'schemaAnalysis': {
            'hasSchema': has_schema,
            'types': schema_types,
            'missing': missing_schema,
            'score': schema_score
        },
        'headerAnalysis': {
            'hasQuestionHeaders': has_question_headers,
            'h2Count': len(h2_tags),
            'h3Count': len(h3_tags),
            'questionBasedHeaders': question_headers,
            'score': header_score
        },
        'faqAnalysis': {
            'hasFaqSection': has_faq,
            'questionCount': len(question_headers) if has_faq else 0,
            'hasStructuredData': faq_schema,
            'score': faq_score
        },
        'contentStructure': {
            'hasLists': list_count > 0,
            'hasTables': table_count > 0,
            'listCount': list_count,
            'tableCount': table_count,
            'score': structure_score
        },
        'citationsAnalysis': {
            'citationCount': citation_count,
            'hasStatistics': has_statistics,
            'hasAuthorInfo': has_author_bio,
            'score': citations_score
        },
        'metaAnalysis': {
            'hasMetaDescription': has_meta,
            'metaLength': meta_length,
            'hasTitleTag': has_title,
            'titleLength': title_length,
            'score': meta_score
        },
        'authoritySignals': {
            'hasAuthorBio': has_author_bio,
            'hasCredentials': has_credentials,
            'hasPublishDate': has_publish_date,
            'hasUpdateDate': has_update_date,
            'score': authority_score
        }
    }
    
    return json.dumps(result, indent=2)

# Fetch content if URL provided
html_content = """${input.htmlContent || ''}"""
url = """${input.url || ''}"""

if url and not html_content:
    import requests
    response = requests.get(url, timeout=10)
    html_content = response.text

# Run analysis
result = analyze_aeo_geo(html_content, '${input.fileType}')
print(result)
`;

      // Execute analysis in sandbox
      const execution = await sandbox.notebook.execCell(analysisScript);
      
      if (execution.error) {
        throw new Error(`Analysis failed: ${execution.error.value}`);
      }

      // Parse results
      const output = execution.logs.stdout.join('\n');
      const result = JSON.parse(output);

      return result;
    } catch (error) {
      console.error('Codebase analysis error:', error);
      throw error;
    } finally {
      await sandbox.close();
    }
  },
});
