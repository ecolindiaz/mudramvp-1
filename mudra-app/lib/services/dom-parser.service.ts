/**
 * DOM Parser Service
 * 
 * Parses HTML content using DOMParser API patterns to extract:
 * - Meta tags (title, description, og:tags, twitter:cards, canonical)
 * - Heading hierarchy (H1-H6 with text and position)
 * - Semantic HTML elements (article, section, nav, aside, header, footer)
 * - JSON-LD structured data
 * - FAQ content from multiple sources
 * 
 * Uses regex-based parsing for Node.js environment (no browser DOM).
 */

import type {
  DOMExtractionResult,
  MetadataExtraction,
  HeadingHierarchy,
  HeadingInfo,
  HeadingViolation,
  SemanticElementsExtraction,
  ArticleContent,
  StructuredDataExtraction,
  JSONLDSchema,
  MicrodataItem,
  RDFaItem,
  FAQExtraction,
  FAQItem,
  ValidationResult,
} from '@/lib/types/site-scraping.types';

/**
 * Strip HTML tags from a string
 */
function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
    '&ndash;': '–',
    '&mdash;': '—',
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™',
  };
  
  let result = text;
  for (const [entity, char] of Object.entries(entities)) {
    result = result.replace(new RegExp(entity, 'gi'), char);
  }
  
  // Handle numeric entities
  result = result.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
  result = result.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  
  return result;
}

/**
 * Extract meta tag content by name or property
 */
function extractMetaContent(html: string, nameOrProperty: string): string | undefined {
  // Try name attribute
  const nameRegex = new RegExp(
    `<meta[^>]*name=["']${nameOrProperty}["'][^>]*content=["']([^"']*)["']`,
    'i'
  );
  let match = html.match(nameRegex);
  if (match) return decodeHtmlEntities(match[1]);
  
  // Try content before name
  const nameRegex2 = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${nameOrProperty}["']`,
    'i'
  );
  match = html.match(nameRegex2);
  if (match) return decodeHtmlEntities(match[1]);
  
  // Try property attribute (for OG/Twitter)
  const propRegex = new RegExp(
    `<meta[^>]*property=["']${nameOrProperty}["'][^>]*content=["']([^"']*)["']`,
    'i'
  );
  match = html.match(propRegex);
  if (match) return decodeHtmlEntities(match[1]);
  
  // Try content before property
  const propRegex2 = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${nameOrProperty}["']`,
    'i'
  );
  match = html.match(propRegex2);
  if (match) return decodeHtmlEntities(match[1]);
  
  return undefined;
}

/**
 * Extract all metadata from HTML
 */
export function extractMetadata(html: string): MetadataExtraction {
  const metadata: MetadataExtraction = {};
  
  // Title tag
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (titleMatch) {
    metadata.title = decodeHtmlEntities(stripTags(titleMatch[1]));
  }
  
  // Standard meta tags
  metadata.description = extractMetaContent(html, 'description');
  metadata.robots = extractMetaContent(html, 'robots');
  metadata.viewport = extractMetaContent(html, 'viewport');
  
  // Charset
  const charsetMatch = html.match(/<meta[^>]*charset=["']?([^"'\s>]+)["']?/i);
  if (charsetMatch) metadata.charset = charsetMatch[1];
  
  // Canonical link
  const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  if (canonicalMatch) metadata.canonical = canonicalMatch[1];
  
  const canonicalMatch2 = html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i);
  if (!metadata.canonical && canonicalMatch2) metadata.canonical = canonicalMatch2[1];
  
  metadata.linkCanonical = metadata.canonical;
  
  // Hreflang links
  const hreflangRegex = /<link[^>]*rel=["']alternate["'][^>]*hreflang=["']([^"']+)["'][^>]*href=["']([^"']+)["']/gi;
  const hreflangs: string[] = [];
  const alternates: Array<{ href: string; hreflang?: string; type?: string }> = [];
  let hreflangMatch;
  while ((hreflangMatch = hreflangRegex.exec(html)) !== null) {
    hreflangs.push(hreflangMatch[1]);
    alternates.push({ href: hreflangMatch[2], hreflang: hreflangMatch[1] });
  }
  if (hreflangs.length) metadata.hreflang = hreflangs;
  if (alternates.length) metadata.linkAlternates = alternates;
  
  // Open Graph
  metadata.ogTitle = extractMetaContent(html, 'og:title');
  metadata.ogDescription = extractMetaContent(html, 'og:description');
  metadata.ogImage = extractMetaContent(html, 'og:image');
  metadata.ogUrl = extractMetaContent(html, 'og:url');
  metadata.ogType = extractMetaContent(html, 'og:type');
  metadata.ogSiteName = extractMetaContent(html, 'og:site_name');
  
  // Twitter Card
  metadata.twitterCard = extractMetaContent(html, 'twitter:card');
  metadata.twitterTitle = extractMetaContent(html, 'twitter:title');
  metadata.twitterDescription = extractMetaContent(html, 'twitter:description');
  metadata.twitterImage = extractMetaContent(html, 'twitter:image');
  metadata.twitterSite = extractMetaContent(html, 'twitter:site');
  
  return metadata;
}

/**
 * Extract heading hierarchy from HTML
 */
export function extractHeadings(html: string): HeadingHierarchy {
  const headings: HeadingHierarchy = {
    h1: [],
    h2: [],
    h3: [],
    h4: [],
    h5: [],
    h6: [],
    totalHeadings: 0,
    violations: [],
  };
  
  let position = 0;
  const allHeadings: Array<{ level: number; info: HeadingInfo }> = [];
  
  // Extract all headings with their positions
  for (let level = 1; level <= 6; level++) {
    const regex = new RegExp(`<h${level}([^>]*)>([\\s\\S]*?)<\\/h${level}>`, 'gi');
    let match;
    
    while ((match = regex.exec(html)) !== null) {
      const attrs = match[1] || '';
      const content = match[2];
      
      const idMatch = attrs.match(/id=["']([^"']+)["']/i);
      const classMatch = attrs.match(/class=["']([^"']+)["']/i);
      
      const info: HeadingInfo = {
        text: decodeHtmlEntities(stripTags(content)),
        position: match.index,
        id: idMatch?.[1],
        className: classMatch?.[1],
      };
      
      allHeadings.push({ level, info });
    }
  }
  
  // Sort by position
  allHeadings.sort((a, b) => a.info.position - b.info.position);
  
  // Assign sequential positions and populate arrays
  allHeadings.forEach((h, idx) => {
    h.info.position = idx;
    const key = `h${h.level}` as keyof Pick<HeadingHierarchy, 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'>;
    headings[key].push(h.info);
  });
  
  headings.totalHeadings = allHeadings.length;
  
  // Check for violations
  // Multiple H1s
  if (headings.h1.length > 1) {
    headings.violations.push({
      type: 'multiple_h1',
      message: `Found ${headings.h1.length} H1 tags. Best practice is to have exactly one H1 per page.`,
    });
  }
  
  // Empty headings
  for (const h of allHeadings) {
    if (!h.info.text.trim()) {
      headings.violations.push({
        type: 'empty_heading',
        message: `Empty H${h.level} heading found`,
        position: h.info.position,
        level: h.level,
      });
    }
  }
  
  // Skipped levels
  let prevLevel = 0;
  for (const h of allHeadings) {
    if (prevLevel > 0 && h.level > prevLevel + 1) {
      headings.violations.push({
        type: 'skipped_level',
        message: `Heading level jumped from H${prevLevel} to H${h.level}`,
        position: h.info.position,
        level: h.level,
      });
    }
    prevLevel = h.level;
  }
  
  // Too long headings
  for (const h of allHeadings) {
    if (h.info.text.length > 100) {
      headings.violations.push({
        type: 'too_long',
        message: `H${h.level} heading is ${h.info.text.length} characters (recommended: under 100)`,
        position: h.info.position,
        level: h.level,
      });
    }
  }
  
  return headings;
}

/**
 * Extract semantic HTML elements
 */
export function extractSemanticElements(html: string): SemanticElementsExtraction {
  const countElement = (tagName: string): number => {
    const regex = new RegExp(`<${tagName}[\\s>]`, 'gi');
    return (html.match(regex) || []).length;
  };
  
  const extraction: SemanticElementsExtraction = {
    articleCount: countElement('article'),
    sectionCount: countElement('section'),
    navCount: countElement('nav'),
    asideCount: countElement('aside'),
    headerCount: countElement('header'),
    footerCount: countElement('footer'),
    mainCount: countElement('main'),
    articles: [],
    landmarkRoles: [],
    ariaLabels: [],
    hasProperStructure: false,
    semanticScore: 0,
  };
  
  // Extract article content
  const articleRegex = /<article[^>]*>([\s\S]*?)<\/article>/gi;
  let articleMatch;
  let articlePos = 0;
  
  while ((articleMatch = articleRegex.exec(html)) !== null) {
    const articleHtml = articleMatch[1];
    
    // Count headings in article
    const headingMatches = articleHtml.match(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi) || [];
    const headings = headingMatches.map(h => decodeHtmlEntities(stripTags(h)));
    
    // Count paragraphs
    const paragraphCount = (articleHtml.match(/<p[\s>]/gi) || []).length;
    
    // Estimate word count
    const textContent = stripTags(articleHtml);
    const wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length;
    
    // Check for datetime and author
    const hasDatetime = /<time[^>]*datetime/i.test(articleHtml);
    const hasAuthor = /class=["'][^"']*author/i.test(articleHtml) || 
                      /rel=["']author["']/i.test(articleHtml) ||
                      /itemprop=["']author["']/i.test(articleHtml);
    
    extraction.articles.push({
      position: articlePos++,
      headings,
      paragraphCount,
      wordCount,
      hasDatetime,
      hasAuthor,
    });
  }
  
  // Extract landmark roles
  const roleRegex = /role=["']([^"']+)["']/gi;
  let roleMatch;
  while ((roleMatch = roleRegex.exec(html)) !== null) {
    const role = roleMatch[1].toLowerCase();
    if (!extraction.landmarkRoles.includes(role)) {
      extraction.landmarkRoles.push(role);
    }
  }
  
  // Extract ARIA labels
  const ariaLabelRegex = /aria-label=["']([^"']+)["']/gi;
  let ariaMatch;
  while ((ariaMatch = ariaLabelRegex.exec(html)) !== null) {
    extraction.ariaLabels.push(ariaMatch[1]);
  }
  
  // Calculate semantic score
  let score = 0;
  if (extraction.mainCount >= 1) score += 15;
  if (extraction.headerCount >= 1) score += 10;
  if (extraction.footerCount >= 1) score += 10;
  if (extraction.navCount >= 1) score += 10;
  if (extraction.articleCount >= 1) score += 15;
  if (extraction.sectionCount >= 1) score += 10;
  if (extraction.landmarkRoles.length >= 3) score += 10;
  if (extraction.ariaLabels.length >= 5) score += 10;
  if (extraction.asideCount >= 1) score += 5;
  
  // Bonus for articles with proper attribution
  const articlesWithAttribution = extraction.articles.filter(a => a.hasDatetime || a.hasAuthor).length;
  if (articlesWithAttribution > 0) score += 5;
  
  extraction.semanticScore = Math.min(100, score);
  extraction.hasProperStructure = score >= 50;
  
  return extraction;
}

/**
 * Repair common JSON-LD issues
 */
function repairJsonLd(jsonText: string): string {
  let t = jsonText.replace(/^\uFEFF/, ''); // Remove BOM
  t = t.replace(/(^|\n)\s*\/\/.*(?=\n|$)/g, '$1'); // Remove line comments
  t = t.replace(/\/\*[\s\S]*?\*\//g, ''); // Remove block comments
  t = t.replace(/,\s*(\}|\])/g, '$1'); // Remove trailing commas
  return t.trim();
}

/**
 * Extract JSON-LD structured data
 */
export function extractJsonLd(html: string): JSONLDSchema[] {
  const schemas: JSONLDSchema[] = [];
  
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  
  while ((match = jsonLdRegex.exec(html)) !== null) {
    const raw = (match[1] || '').trim();
    if (!raw) continue;
    
    const repaired = repairJsonLd(raw);
    
    try {
      const parsed = JSON.parse(repaired);
      
      // Extract type(s)
      let type: string | string[] = parsed['@type'] || 'Unknown';
      
      // Handle @graph
      if (parsed['@graph'] && Array.isArray(parsed['@graph'])) {
        const graphSchemas = parsed['@graph'].map((item: any) => ({
          type: item['@type'] || 'Unknown',
          graph: undefined,
          raw: JSON.stringify(item),
          parsed: item,
          isValid: true,
        }));
        schemas.push(...graphSchemas);
      } else {
        schemas.push({
          type,
          raw,
          parsed,
          isValid: true,
        });
      }
    } catch (error) {
      schemas.push({
        type: 'Invalid',
        raw,
        parsed: null,
        isValid: false,
        validationErrors: [error instanceof Error ? error.message : 'Parse error'],
      });
    }
  }
  
  return schemas;
}

/**
 * Extract Microdata
 */
export function extractMicrodata(html: string): MicrodataItem[] {
  const items: MicrodataItem[] = [];
  
  const itemscopeRegex = /<([a-zA-Z0-9-]+)([^>]*\sitemscope\s[^>]*)>/gi;
  let match;
  let position = 0;
  
  while ((match = itemscopeRegex.exec(html)) !== null) {
    const attrs = match[2] || '';
    const typeMatch = attrs.match(/itemtype=["']([^"']+)["']/i);
    
    if (typeMatch) {
      // Extract properties from nearby content
      const props: string[] = [];
      const tail = html.slice(match.index, match.index + 2000);
      const propRegex = /itemprop=["']([^"']+)["']/gi;
      let propMatch;
      while ((propMatch = propRegex.exec(tail)) !== null) {
        if (propMatch[1] && !props.includes(propMatch[1])) {
          props.push(propMatch[1]);
        }
      }
      
      items.push({
        type: typeMatch[1],
        properties: props,
        position: position++,
      });
    }
  }
  
  return items;
}

/**
 * Extract RDFa
 */
export function extractRdfa(html: string): RDFaItem[] {
  const items: RDFaItem[] = [];
  
  const rdfaRegex = /\stypeof=["']([^"']+)["']/gi;
  let match;
  
  while ((match = rdfaRegex.exec(html)) !== null) {
    items.push({
      typeof: match[1],
    });
  }
  
  return items;
}

/**
 * Extract all structured data
 */
export function extractStructuredData(html: string): StructuredDataExtraction {
  const jsonLd = extractJsonLd(html);
  const microdata = extractMicrodata(html);
  const rdfa = extractRdfa(html);
  
  // Collect all schema types
  const schemaTypes = new Set<string>();
  
  for (const schema of jsonLd) {
    if (schema.isValid) {
      const types = Array.isArray(schema.type) ? schema.type : [schema.type];
      types.forEach(t => schemaTypes.add(t));
    }
  }
  
  for (const item of microdata) {
    const type = item.type.split('/').pop();
    if (type) schemaTypes.add(type);
  }
  
  for (const item of rdfa) {
    schemaTypes.add(item.typeof);
  }
  
  // Check for specific schemas
  const hasSchema = (name: string): boolean => {
    return schemaTypes.has(name) || 
           Array.from(schemaTypes).some(t => t.toLowerCase().includes(name.toLowerCase()));
  };
  
  return {
    jsonLd,
    microdata,
    rdfa,
    schemaTypes: Array.from(schemaTypes),
    schemaValidation: jsonLd.map(s => ({
      schemaType: Array.isArray(s.type) ? s.type.join(', ') : s.type,
      isValid: s.isValid,
      errors: s.validationErrors || [],
      warnings: [],
    })),
    hasOrganizationSchema: hasSchema('Organization'),
    hasWebSiteSchema: hasSchema('WebSite'),
    hasProductSchema: hasSchema('Product'),
    hasServiceSchema: hasSchema('Service'),
    hasArticleSchema: hasSchema('Article'),
    hasBlogPostingSchema: hasSchema('BlogPosting'),
    hasFAQPageSchema: hasSchema('FAQPage'),
    hasBreadcrumbSchema: hasSchema('BreadcrumbList'),
    hasHowToSchema: hasSchema('HowTo'),
    hasSoftwareApplicationSchema: hasSchema('SoftwareApplication'),
  };
}

/**
 * Extract FAQs from JSON-LD schema
 */
function extractFaqsFromSchema(jsonLd: JSONLDSchema[]): FAQItem[] {
  const faqs: FAQItem[] = [];
  
  for (const schema of jsonLd) {
    if (!schema.isValid || !schema.parsed) continue;
    
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    
    if (types.includes('FAQPage') && schema.parsed.mainEntity) {
      const entities = Array.isArray(schema.parsed.mainEntity) 
        ? schema.parsed.mainEntity 
        : [schema.parsed.mainEntity];
      
      for (const entity of entities) {
        const question = entity.name || entity.headline;
        const answer = entity.acceptedAnswer?.text || 
                       entity.acceptedAnswer?.answerText ||
                       entity.text;
        
        if (question && answer) {
          faqs.push({
            question: stripTags(question),
            answer: stripTags(answer),
            source: 'json-ld',
            questionLength: question.length,
            answerLength: answer.length,
          });
        }
      }
    }
  }
  
  return faqs;
}

/**
 * Extract FAQs from <details>/<summary> elements
 */
function extractFaqsFromDetails(html: string): FAQItem[] {
  const faqs: FAQItem[] = [];
  
  const detailsRegex = /<details[^>]*>[\s\S]*?<summary[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/gi;
  let match;
  
  while ((match = detailsRegex.exec(html)) !== null) {
    const question = stripTags(match[1]).trim();
    const answer = stripTags(match[2]).trim();
    
    if (question && answer && question.length > 5 && answer.length > 10) {
      faqs.push({
        question,
        answer,
        source: 'details-summary',
        questionLength: question.length,
        answerLength: answer.length,
      });
    }
  }
  
  return faqs;
}

/**
 * Extract FAQs from Q:/A: patterns
 */
function extractFaqsFromPatterns(html: string): FAQItem[] {
  const faqs: FAQItem[] = [];
  
  // Look for FAQ sections first
  const faqSectionRegex = /<(div|section)[^>]*(?:class|id)=["'][^"']*faq[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi;
  let sectionMatch;
  
  const processSection = (sectionHtml: string) => {
    // Q/A pattern
    const qaRegex = /<[^>]*>\s*Q[:\.\-]?\s*([^<]+)<\/[^>]*>\s*<[^>]*>\s*A[:\.\-]?\s*([^<]+)<\/[^>]*>/gi;
    let qaMatch;
    
    while ((qaMatch = qaRegex.exec(sectionHtml)) !== null) {
      const question = qaMatch[1].trim();
      const answer = qaMatch[2].trim();
      
      if (question && answer && question.length > 5) {
        faqs.push({
          question,
          answer,
          source: 'pattern',
          questionLength: question.length,
          answerLength: answer.length,
        });
      }
    }
    
    // Question headings (h3-h6 ending with ?)
    const headingQRegex = /<h([3-6])[^>]*>([^<]*\?[^<]*)<\/h\1>\s*<p[^>]*>([^<]+)<\/p>/gi;
    let headingMatch;
    
    while ((headingMatch = headingQRegex.exec(sectionHtml)) !== null) {
      const question = stripTags(headingMatch[2]).trim();
      const answer = stripTags(headingMatch[3]).trim();
      
      if (question && answer && answer.length > 20) {
        faqs.push({
          question,
          answer,
          source: 'heading-pattern',
          questionLength: question.length,
          answerLength: answer.length,
        });
      }
    }
  };
  
  while ((sectionMatch = faqSectionRegex.exec(html)) !== null) {
    processSection(sectionMatch[2]);
  }
  
  return faqs;
}

/**
 * Deduplicate FAQs by question similarity
 */
function dedupeFaqs(faqs: FAQItem[]): FAQItem[] {
  const seen = new Set<string>();
  const unique: FAQItem[] = [];
  
  for (const faq of faqs) {
    // Normalize question for comparison
    const normalized = faq.question.toLowerCase().replace(/[^\w\s]/g, '').trim();
    
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(faq);
    }
  }
  
  return unique;
}

/**
 * Extract all FAQ content
 */
export function extractFaqContent(html: string, jsonLd: JSONLDSchema[]): FAQExtraction {
  const fromSchema = extractFaqsFromSchema(jsonLd);
  const fromDetails = extractFaqsFromDetails(html);
  const fromPatterns = extractFaqsFromPatterns(html);
  
  // Merge and deduplicate
  const allFaqs = [...fromSchema, ...fromDetails, ...fromPatterns];
  const merged = dedupeFaqs(allFaqs);
  
  return {
    fromSchema,
    fromDetails,
    fromPatterns,
    merged,
    totalUnique: merged.length,
    hasSchemaFAQ: fromSchema.length > 0,
    hasHTMLFAQ: fromDetails.length > 0 || fromPatterns.length > 0,
  };
}

/**
 * Generate validation results
 */
function generateValidations(
  metadata: MetadataExtraction,
  headings: HeadingHierarchy,
  structuredData: StructuredDataExtraction,
  semanticElements: SemanticElementsExtraction,
  faqContent: FAQExtraction
): ValidationResult[] {
  const results: ValidationResult[] = [];
  
  // Metadata validations
  if (!metadata.title) {
    results.push({
      category: 'metadata',
      severity: 'error',
      code: 'MISSING_TITLE',
      message: 'Page is missing a title tag',
      suggestion: 'Add a descriptive <title> tag',
    });
  } else if (metadata.title.length > 60) {
    results.push({
      category: 'metadata',
      severity: 'warning',
      code: 'TITLE_TOO_LONG',
      message: `Title is ${metadata.title.length} characters (recommended: under 60)`,
      suggestion: 'Shorten the title to improve display in search results',
    });
  }
  
  if (!metadata.description) {
    results.push({
      category: 'metadata',
      severity: 'warning',
      code: 'MISSING_DESCRIPTION',
      message: 'Page is missing a meta description',
      suggestion: 'Add a meta description between 120-160 characters',
    });
  }
  
  if (!metadata.canonical) {
    results.push({
      category: 'metadata',
      severity: 'warning',
      code: 'MISSING_CANONICAL',
      message: 'Page is missing a canonical URL',
      suggestion: 'Add <link rel="canonical" href="..."> to prevent duplicate content issues',
    });
  }
  
  if (!metadata.ogTitle || !metadata.ogDescription) {
    results.push({
      category: 'metadata',
      severity: 'info',
      code: 'INCOMPLETE_OG',
      message: 'Open Graph tags are incomplete',
      suggestion: 'Add og:title and og:description for better social sharing',
    });
  }
  
  // Heading validations
  if (headings.h1.length === 0) {
    results.push({
      category: 'headings',
      severity: 'error',
      code: 'MISSING_H1',
      message: 'Page is missing an H1 heading',
      suggestion: 'Add exactly one H1 heading that describes the page content',
    });
  }
  
  for (const violation of headings.violations) {
    results.push({
      category: 'headings',
      severity: violation.type === 'multiple_h1' ? 'warning' : 'info',
      code: `HEADING_${violation.type.toUpperCase()}`,
      message: violation.message,
    });
  }
  
  // Schema validations
  if (structuredData.jsonLd.length === 0) {
    results.push({
      category: 'schema',
      severity: 'warning',
      code: 'NO_JSON_LD',
      message: 'No JSON-LD structured data found',
      suggestion: 'Add JSON-LD schema markup for better search visibility',
    });
  }
  
  if (!structuredData.hasOrganizationSchema) {
    results.push({
      category: 'schema',
      severity: 'info',
      code: 'MISSING_ORG_SCHEMA',
      message: 'Organization schema not found',
      suggestion: 'Add Organization schema to establish brand identity',
    });
  }
  
  // Invalid schemas
  for (const schema of structuredData.jsonLd) {
    if (!schema.isValid) {
      results.push({
        category: 'schema',
        severity: 'error',
        code: 'INVALID_JSON_LD',
        message: `Invalid JSON-LD: ${schema.validationErrors?.join(', ')}`,
        element: schema.raw.substring(0, 100) + '...',
      });
    }
  }
  
  // Semantic HTML validations
  if (!semanticElements.hasProperStructure) {
    results.push({
      category: 'semantic',
      severity: 'warning',
      code: 'POOR_SEMANTIC_STRUCTURE',
      message: `Semantic HTML score is ${semanticElements.semanticScore}/100`,
      suggestion: 'Use semantic HTML5 elements like <main>, <article>, <nav>, <header>, <footer>',
    });
  }
  
  if (semanticElements.mainCount === 0) {
    results.push({
      category: 'semantic',
      severity: 'info',
      code: 'MISSING_MAIN',
      message: 'Page is missing a <main> element',
      suggestion: 'Wrap primary content in a <main> element',
    });
  }
  
  // FAQ validations
  if (faqContent.hasHTMLFAQ && !faqContent.hasSchemaFAQ) {
    results.push({
      category: 'faq',
      severity: 'warning',
      code: 'FAQ_NO_SCHEMA',
      message: `Found ${faqContent.merged.length} FAQ items but no FAQPage schema`,
      suggestion: 'Add FAQPage JSON-LD schema to enable FAQ rich results',
    });
  }
  
  return results;
}

/**
 * Main function to extract all DOM data from HTML
 */
export function extractDOMData(html: string): DOMExtractionResult {
  // Extract all components
  const metadata = extractMetadata(html);
  const headings = extractHeadings(html);
  const semanticElements = extractSemanticElements(html);
  const structuredData = extractStructuredData(html);
  const faqContent = extractFaqContent(html, structuredData.jsonLd);
  
  // Generate validations
  const validation = generateValidations(
    metadata,
    headings,
    structuredData,
    semanticElements,
    faqContent
  );
  
  return {
    metadata,
    headings,
    semanticElements,
    structuredData,
    faqContent,
    validation,
  };
}
