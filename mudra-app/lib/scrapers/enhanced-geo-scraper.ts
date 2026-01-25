#!/usr/bin/env node

/**
 * Enhanced GEO Technical Scraper
 * 
 * Fixes critical gaps identified in GEO assessment:
 * - Real JSON-LD extraction from HTML source
 * - FAQ structure detection  
 * - Entity recognition
 * - Content freshness analysis
 * - Performance metrics integration
 * 
 * Usage: npx tsx src/enhanced-geo-scraper.ts <url>
 */

import { createFirecrawlApp } from '../config/firecrawl-config';

// Company-page scraping types and results
export type SchemaSourceType = 'json-ld' | 'microdata' | 'rdfa';
export interface SchemaBlock {
  source: SchemaSourceType;
  graph: any;
  raw?: string;
}
export interface FaqItem {
  question: string;
  answer: string;
  provenance?: { source: 'json-ld' | 'dom' | 'llm'; path?: string };
}
export interface ScrapeOpts {
  fresh?: boolean;
  locale?: { country?: string; languages?: string[] };
  userHeaders?: Record<string, string>;
  useLlmJsonMode?: boolean;
  llmSchema?: object;
  llmPrompt?: string;
}
export interface TxtFileCheck {
  url: string;
  exists: boolean;
  status?: number;
  size?: number;
}

export interface ScrapeResult {
  url: string;
  // Essential metadata
  metadata: {
    title?: string;
    description?: string;
    language?: string;
    favicon?: string;
  };
  // HTML structure analysis
  htmlStructure: {
    headings: {
      h1: string[];
      h2: string[];
      h3: string[];
      h4: string[];
      h5: string[];
      h6: string[];
    };
    htmlLength: number;
    rawHtmlLength: number;
    hasProperStructure: boolean;
  };
  // Structured data blocks (JSON-LD, Microdata, RDFa)
  schema: {
    all: SchemaBlock[];
    faqSchema: SchemaBlock[];
    summary: {
      jsonLdCount: number;
      microdataCount: number;
      rdfaCount: number;
      faqSchemaCount: number;
    };
  };
  // FAQ content only
  faqs: {
    fromSchema: FaqItem[];
    fromDom: FaqItem[];
    llmExtracted?: FaqItem[];
    merged: FaqItem[];
    summary: {
      totalUnique: number;
      schemaCount: number;
      domCount: number;
      llmCount: number;
    };
  };
  // Robots and LLM policy files
  txtFiles: {
    robots: TxtFileCheck;
    llms: TxtFileCheck;
    llmsFull: TxtFileCheck;
    summary: {
      hasRobotsTxt: boolean;
      hasLlmsTxt: boolean;
      hasLlmsFullTxt: boolean;
      totalFound: number;
    };
  };
  // Synthesized JSON-LD from page content
  synthesizedJsonLd?: any[];
}

export interface EnhancedGEOResult {
  url: string;
  timestamp: string;
  geoScore: {
    overall: number;
    contentAuthority: number;
    technicalAccessibility: number;
    structuredData: number;
    entityRecognition: number;
    faqOptimization: number;
    contentFreshness: number;
  };
  
  // Enhanced structured data with real parsing
  structuredData: {
    jsonLd: any[];
    microdata: any[];
    rdfa: any[];
    schemaTypes: string[];
    faqSchemas: any[];
    organizationSchema?: any;
    websiteSchema?: any;
    breadcrumbSchema?: any;
  };
  
  // New: Entity recognition
  entityRecognition: {
    organizations: string[];
    people: string[];
    technologies: string[];
    products: string[];
    locations: string[];
  };
  
  // New: FAQ optimization
  faqOptimization: {
    faqSections: any[];
    questionAnswerPairs: number;
    faqStructuredData: boolean;
    faqSchemaPresent: boolean;
  };
  
  // New: Content freshness
  contentFreshness: {
    publishDate?: string;
    lastModified?: string;
    updateFrequency?: string;
    freshnessSignals: string[];
  };
  
  // Enhanced content structure
  contentStructure: {
    headingsHierarchy: {
      h1: string[];
      h2: string[];
      h3: string[];
      h4: string[];
      h5: string[];
      h6: string[];
    };
    authoritySignals: {
      statistics: string[];
      expertQuotes: string[];
      authorInfo: any;
      citations: string[];
      testimonials: string[];
    };
    contentQuality: {
      wordCount?: number;
      paragraphCount?: number;
      listCount?: number;
      tableCount?: number;
      imageCount?: number;
      readingLevel?: string;
    };
  };
  
  // Enhanced technical accessibility
  technicalAccessibility: {
    metaTags: {
      title?: string;
      description?: string;
      robots?: string;
      canonical?: string;
      hreflang?: string[];
      openGraph: Record<string, string>;
      twitterCard: Record<string, string>;
    };
    technicalElements: {
      httpsStatus: boolean;
      statusCode: number;
      contentType?: string;
      responseTime?: number;
      mobileFriendly?: boolean;
      internalLinks: string[];
      coreWebVitals?: {
        lcp?: number; // Largest Contentful Paint
        fid?: number; // First Input Delay  
        cls?: number; // Cumulative Layout Shift
      };
    };
    accessibility: {
      altTextCount: number;
      ariaLabels: string[];
      semanticElements: string[];
      skipLinks: boolean;
      headingStructureValid: boolean;
      landmarkRoles: string[];
    };
  };
}

// Optional extras stored alongside the core GEO result
export interface EnhancedExtractions {
  promptExtraction?: any;
  advancedExtraction?: {
    data: any;
    sources?: string[];
  };
}

export type EnhancedGEOOutput = EnhancedGEOResult & EnhancedExtractions;

/**
 * Parse JSON-LD scripts from HTML content
 */
function parseJsonLdFromHtml(html: string): any[] {
  const jsonLdScripts: any[] = [];
  
  // Regex to find JSON-LD script tags
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gi;
  let match;
  
  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const jsonContent = match[1].trim();
      const parsed = JSON.parse(jsonContent);
      jsonLdScripts.push(parsed);
    } catch (error) {
      console.warn('Failed to parse JSON-LD:', error);
    }
  }
  
  return jsonLdScripts;
}

// Lightweight JSON-LD repair and extraction wrappers for company page scraping
function repairJsonLd(jsonText: string): string {
  let t = jsonText.replace(/^\uFEFF/, '');
  t = t.replace(/(^|\n)\s*\/\/.*(?=\n|$)/g, '$1');
  t = t.replace(/\/\*[\s\S]*?\*\//g, '');
  t = t.replace(/,\s*(\}|\])/g, '$1');
  return t.trim();
}

export function extractAllJsonLd(rawHtml: string): SchemaBlock[] {
  const blocks: SchemaBlock[] = [];
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = jsonLdRegex.exec(rawHtml)) !== null) {
    const raw = (match[1] || '').trim();
    if (!raw) continue;
    const repaired = repairJsonLd(raw);
    try {
      const parsed = JSON.parse(repaired);
      blocks.push({ source: 'json-ld', graph: parsed, raw });
    } catch {
      // ignore bad blocks
    }
  }
  return blocks;
}

/**
 * Parse microdata from HTML content
 */
function parseMicrodataFromHtml(html: string): any[] {
  const microdataItems: any[] = [];
  
  // Find elements with itemscope
  const itemscopeRegex = /<[^>]*itemscope[^>]*>/gi;
  const matches = html.match(itemscopeRegex) || [];
  
  matches.forEach((match, index) => {
    const itemTypeMatch = match.match(/itemtype=["']([^"']+)["']/i);
    const itemPropMatches = html.match(/itemprop=["']([^"']+)["']/gi) || [];
    
    if (itemTypeMatch) {
      microdataItems.push({
        type: itemTypeMatch[1],
        properties: itemPropMatches.map(prop => prop.match(/itemprop=["']([^"']+)["']/i)?.[1]).filter(Boolean),
        index
      });
    }
  });
  
  return microdataItems;
}

// Heuristic Microdata + RDFa normalization for SchemaBlock[]
function extractAllStructuredData(rawHtml: string): SchemaBlock[] {
  const blocks: SchemaBlock[] = [];
  // Microdata nodes
  const itemscopeRegex = /<([a-zA-Z0-9-]+)([^>]*\sitemscope\s[^>]*)>/gi;
  let m: RegExpExecArray | null;
  const microNodes: any[] = [];
  while ((m = itemscopeRegex.exec(rawHtml)) !== null) {
    const tagAttrs = m[2] || '';
    const typeMatch = tagAttrs.match(/itemtype=["']([^"']+)["']/i);
    const props: string[] = [];
    const tail = rawHtml.slice(itemscopeRegex.lastIndex, itemscopeRegex.lastIndex + 2000);
    const propRegex = /itemprop=["']([^"']+)["']/gi;
    let p: RegExpExecArray | null;
    while ((p = propRegex.exec(tail)) !== null) {
      if (p[1]) props.push(p[1]);
    }
    microNodes.push({ type: typeMatch?.[1], properties: props });
  }
  if (microNodes.length) blocks.push({ source: 'microdata', graph: microNodes });

  // RDFa types
  const rdfaTypes: string[] = [];
  const rdfaTypeRegex = /\stypeof=["']([^"']+)["']/gi;
  while ((m = rdfaTypeRegex.exec(rawHtml)) !== null) {
    if (m[1]) rdfaTypes.push(m[1]);
  }
  if (rdfaTypes.length) blocks.push({ source: 'rdfa', graph: rdfaTypes });

  return blocks;
}

/**
 * Extract schema types from structured data
 */
function extractSchemaTypes(jsonLd: any[], microdata: any[]): string[] {
  const types = new Set<string>();
  
  // From JSON-LD
  jsonLd.forEach(item => {
    if (item['@type']) {
      if (Array.isArray(item['@type'])) {
        item['@type'].forEach(type => types.add(type));
      } else {
        types.add(item['@type']);
      }
    }
  });
  
  // From microdata
  microdata.forEach(item => {
    if (item.type) {
      const schemaType = item.type.split('/').pop();
      if (schemaType) types.add(schemaType);
    }
  });
  
  return Array.from(types);
}

// FAQ extractors and utilities
function extractFaqsFromSchema(schemaBlocks: SchemaBlock[]): FaqItem[] {
  const out: FaqItem[] = [];
  for (const b of schemaBlocks) {
    if (!b || !b.graph) continue;
    const graph = b.graph as any;
    const arr = Array.isArray(graph) ? graph : [graph];
    for (const node of arr) {
      if (!node) continue;
      const types: string[] = ([] as string[]).concat(node['@type'] ?? []);
      if (types.includes('FAQPage') && Array.isArray(node.mainEntity)) {
        for (const q of node.mainEntity) {
          const question = q?.name || q?.headline;
          const answer = q?.acceptedAnswer?.text || q?.acceptedAnswer?.answerText || q?.text;
          if (question && answer) out.push({ question, answer, provenance: { source: 'json-ld', path: '@type=FAQPage' } });
        }
      }
      if (types.includes('QAPage') && node?.mainEntity) {
        const q = node.mainEntity;
        const question = q?.name || q?.headline;
        const answer = q?.acceptedAnswer?.text || q?.acceptedAnswer?.answerText || q?.text;
        if (question && answer) out.push({ question, answer, provenance: { source: 'json-ld', path: '@type=QAPage' } });
      }
    }
  }
  return dedupeFAQ(out);
}

function extractFaqsFromDom(rawHtml: string): FaqItem[] {
  const items: FaqItem[] = [];
  
  // Only look for FAQs in sections that actually contain FAQ-related content
  const faqSections = extractFaqSections(rawHtml);
  if (faqSections.length === 0) {
    return []; // No FAQ sections found, return empty
  }
  
  // Process each FAQ section
  for (const section of faqSections) {
    // 1. details/summary pairs (most reliable)
    const detailsRegex = /<details[\s\S]*?<summary[\s\S]*?>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/gi;
    let m1: RegExpExecArray | null;
    while ((m1 = detailsRegex.exec(section)) !== null) {
      const q = stripTags(m1[1]).trim();
      const a = stripTags(m1[2]).trim();
      if (q && a && isValidQuestion(q)) {
        items.push({ question: q, answer: a, provenance: { source: 'dom' } });
      }
    }
    
    // 2. Explicit Q:/A: patterns
    const qaRegex = /<[^>]*>\s*(Q[:\-\s])\s*([^<]+)<\/[^>]*>\s*<[^>]*>\s*(A[:\-\s])\s*([^<]+)<\/[^>]*>/gi;
    let m2: RegExpExecArray | null;
    while ((m2 = qaRegex.exec(section)) !== null) {
      const q = (m2[2] || '').trim();
      const a = (m2[4] || '').trim();
      if (q && a && isValidQuestion(q)) {
        items.push({ question: q, answer: a, provenance: { source: 'dom' } });
      }
    }
    
    // 3. Question headings (only if they look like actual questions)
    const questionHeadingRegex = /<(h[3-6])[^>]*>([\s\S]*?)<\/\1>\s*<[^>]*>([\s\S]*?)<\/[^>]*>/gi;
    let m3: RegExpExecArray | null;
    while ((m3 = questionHeadingRegex.exec(section)) !== null) {
      const q = stripTags(m3[2]).trim();
      const a = stripTags(m3[3]).trim();
      if (q && a && isValidQuestion(q) && a.length > 10 && a.length < 500) {
        items.push({ question: q, answer: a, provenance: { source: 'dom' } });
      }
    }
  }
  
  return dedupeFAQ(items);
}

// Extract sections that actually contain FAQ content
function extractFaqSections(rawHtml: string): string[] {
  const sections: string[] = [];
  
  // Look for sections with FAQ-related keywords
  const faqKeywords = ['faq', 'question', 'help', 'support', 'q&a', 'qna', 'ask', 'answer'];
  
  // Find divs/sections with FAQ-related classes, IDs, or content
  const faqSectionRegex = /<(div|section)[^>]*(?:class|id|data-[^=]*)\s*=\s*["'][^"']*(?:faq|question|help|support|q.?a)[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = faqSectionRegex.exec(rawHtml)) !== null) {
    sections.push(match[2]);
  }
  
  // Also look for headings that suggest FAQ sections
  const faqHeadingRegex = /<h[1-6][^>]*>([\s\S]*?(?:faq|question|help|support|q.?a)[\s\S]*?)<\/h[1-6]>([\s\S]*?)(?=<h[1-6]|$)/gi;
  while ((match = faqHeadingRegex.exec(rawHtml)) !== null) {
    sections.push(match[2]);
  }
  
  return sections;
}

// Validate if text looks like an actual question
function isValidQuestion(text: string): boolean {
  if (!text || text.length < 5 || text.length > 200) return false;
  
  // Must end with question mark OR start with question words
  const endsWithQuestion = text.trim().endsWith('?');
  const startsWithQuestionWord = /^(how|what|when|where|why|who|which|can|is|are|do|does|will|would|should|could)\s/i.test(text.trim());
  
  // Avoid obvious non-questions (navigation, headers, etc.)
  const nonQuestionPatterns = [
    /^(home|about|contact|login|signup|menu|nav)/i,
    /^(click|tap|press|visit|go to)/i,
    /^(copyright|terms|privacy|policy)/i,
    /^[A-Z\s]+$/, // All caps (likely headers/navigation)
    /^\d+$/, // Just numbers
  ];
  
  for (const pattern of nonQuestionPatterns) {
    if (pattern.test(text.trim())) return false;
  }
  
  return endsWithQuestion || startsWithQuestionWord;
}

// Check for robots.txt, llms.txt, and llms-full.txt files
async function checkTxtFiles(baseUrl: string): Promise<{
  robots: TxtFileCheck;
  llms: TxtFileCheck;
  llmsFull: TxtFileCheck;
}> {
  const app = await createFirecrawlApp();
  const origin = new URL(baseUrl).origin;
  const targets = ['robots.txt', 'llms.txt', 'llms-full.txt'];

  const checks = await Promise.all(
    targets.map(async (filename): Promise<TxtFileCheck> => {
      const url = `${origin}/${filename}`;
      try {
        const result = await app.scrapeUrl(url, {
          formats: ['rawHtml'],
          onlyMainContent: false,
          timeout: 10000,
        });

        const status = result.success ? 200 : 404;
        const body = result.success ? ((result as any).rawHtml?.trim() ?? '') : '';
        const exists = result.success && body.length > 0;

        return {
          url,
          exists,
          status,
          size: exists ? body.length : 0,
        };
      } catch (error) {
        return {
          url,
          exists: false,
          status: undefined,
          size: 0,
        };
      }
    })
  );

  const byName = Object.fromEntries(checks.map(c => [c.url.split('/').pop()!, c]));
  return {
    robots: byName['robots.txt'],
    llms: byName['llms.txt'],
    llmsFull: byName['llms-full.txt'],
  };
}

function mergeFaqs(groups: FaqItem[][]): FaqItem[] {
  const all = groups.flat().filter(Boolean);
  return dedupeFAQ(all);
}

function dedupeFAQ(items: FaqItem[]): FaqItem[] {
  const seen = new Set<string>();
  const out: FaqItem[] = [];
  for (const it of items) {
    const key = ((it.question || '') + '::' + (it.answer || '')).toLowerCase().slice(0, 800);
    if (!seen.has(key)) { seen.add(key); out.push(it); }
  }
  return out;
}

function stripTags(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '')
             .replace(/<style[\s\S]*?<\/style>/gi, '')
             .replace(/<[^>]+>/g, ' ')
             .replace(/\s+/g, ' ');
}

// Extract headings structure from HTML
function extractHeadingsStructure(html: string): {
  headings: { h1: string[]; h2: string[]; h3: string[]; h4: string[]; h5: string[]; h6: string[] };
  hasProperStructure: boolean;
} {
  const headings = { h1: [] as string[], h2: [] as string[], h3: [] as string[], h4: [] as string[], h5: [] as string[], h6: [] as string[] };
  
  // Extract each heading level
  for (let level = 1; level <= 6; level++) {
    const regex = new RegExp(`<h${level}[^>]*>(.*?)<\/h${level}>`, 'gi');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(html)) !== null) {
      const text = stripTags(match[1]).trim();
      if (text) {
        (headings as any)[`h${level}`].push(text);
      }
    }
  }
  
  // Check for proper structure (should have H1, logical hierarchy)
  const hasH1 = headings.h1.length > 0;
  const hasLogicalHierarchy = headings.h1.length <= 3; // Not too many H1s
  const hasProperStructure = hasH1 && hasLogicalHierarchy;
  
  return { headings, hasProperStructure };
}

/**
 * Calculate GEO score based on analysis
 */
function calculateGEOScore(data: Omit<EnhancedGEOResult, 'geoScore'>): EnhancedGEOResult['geoScore'] {
  // Content Authority (0-100)
  const contentAuthority = Math.min(100, 
    (data.contentStructure.authoritySignals.statistics.length * 20) +
    (data.contentStructure.authoritySignals.expertQuotes.length * 10) +
    (data.contentStructure.authoritySignals.citations.length * 15) +
    (data.contentStructure.authoritySignals.testimonials.length * 5) +
    (data.contentStructure.contentQuality.wordCount ? Math.min(20, data.contentStructure.contentQuality.wordCount / 100) : 0)
  );
  
  // Technical Accessibility (0-100)
  const technicalAccessibility = 
    (data.technicalAccessibility.technicalElements.httpsStatus ? 20 : 0) +
    (data.technicalAccessibility.metaTags.title ? 15 : 0) +
    (data.technicalAccessibility.metaTags.description ? 15 : 0) +
    (data.technicalAccessibility.metaTags.openGraph['og:title'] ? 10 : 0) +
    (data.technicalAccessibility.metaTags.openGraph['og:image'] ? 10 : 0) +
    (data.technicalAccessibility.accessibility.altTextCount > 0 ? 15 : 0) +
    (data.technicalAccessibility.accessibility.headingStructureValid ? 15 : 0);
  
  // Structured Data (0-100) - Fixed!
  const structuredData = 
    (data.structuredData.jsonLd.length > 0 ? 40 : 0) +
    (data.structuredData.microdata.length > 0 ? 20 : 0) +
    (data.structuredData.organizationSchema ? 20 : 0) +
    (data.structuredData.websiteSchema ? 10 : 0) +
    (data.structuredData.breadcrumbSchema ? 10 : 0);
  
  // Entity Recognition (0-100)
  const entityRecognition = Math.min(100,
    (data.entityRecognition.organizations.length * 20) +
    (data.entityRecognition.people.length * 15) +
    (data.entityRecognition.technologies.length * 10) +
    (data.entityRecognition.products.length * 10) +
    (data.entityRecognition.locations.length * 5)
  );
  
  // FAQ Optimization (0-100)
  const faqOptimization = 
    (data.faqOptimization.faqSections.length > 0 ? 40 : 0) +
    (data.faqOptimization.questionAnswerPairs > 0 ? 30 : 0) +
    (data.faqOptimization.faqStructuredData ? 30 : 0);
  
  // Content Freshness (0-100)
  const contentFreshness = 
    (data.contentFreshness.publishDate ? 30 : 0) +
    (data.contentFreshness.lastModified ? 30 : 0) +
    (data.contentFreshness.updateFrequency ? 20 : 0) +
    (data.contentFreshness.freshnessSignals.length * 5);
  
  const overall = Math.round(
    (contentAuthority * 0.25) +
    (technicalAccessibility * 0.20) +
    (structuredData * 0.20) +
    (entityRecognition * 0.15) +
    (faqOptimization * 0.10) +
    (contentFreshness * 0.10)
  );
  
  return {
    overall,
    contentAuthority: Math.round(contentAuthority),
    technicalAccessibility: Math.round(technicalAccessibility),
    structuredData: Math.round(structuredData),
    entityRecognition: Math.round(entityRecognition),
    faqOptimization: Math.round(faqOptimization),
    contentFreshness: Math.round(contentFreshness)
  };
}

/**
 * Extract comprehensive enhanced GEO data
 */
export async function extractEnhancedGEOData(url: string): Promise<EnhancedGEOOutput> {
  const app = await createFirecrawlApp();
  
  console.log(`🔍 Running Enhanced GEO Analysis on: ${url}`);
  
  // Make sequential API calls to respect rate limits (Free plan: 10 requests/min)
  console.log('📄 Step 1/5: Extracting HTML and structured data...');
  const htmlResult = await app.scrapeUrl(url, {
    formats: ["html", "markdown", "extract"],
    extract: {
      prompt: "Find and extract all JSON-LD structured data, microdata, and Schema.org markup. Look for @context, @type, itemscope, itemtype, and structured data examples. Return complete JSON objects."
    },
    onlyMainContent: false,
    timeout: 180000
  });
  
  // Wait 8 seconds between requests to stay under rate limit
  await new Promise(resolve => setTimeout(resolve, 8000));
  
  console.log('🏗️ Step 2/5: Analyzing content structure and authority...');
  const contentResult = await app.scrapeUrl(url, {
    formats: ["extract"],
    extract: {
      prompt: `Extract comprehensive content analysis:
      
      1. Heading hierarchy (H1-H6) with exact text
      2. Authority signals: statistics with numbers, expert quotes, testimonials, citations
      3. Author information and credentials
      4. Content quality: word count, paragraph count, lists, tables, images
      5. Reading level assessment
      
      Return as structured JSON with counts and text arrays.`
    },
    timeout: 180000
  });
  
  await new Promise(resolve => setTimeout(resolve, 8000));
  
  console.log('🧠 Step 3/5: Recognizing entities and knowledge graph signals...');
  const entityResult = await app.scrapeUrl(url, {
    formats: ["extract"],
    extract: {
      prompt: `Extract entities and knowledge graph signals:
      
      1. Organizations and companies mentioned
      2. People and experts referenced
      3. Technologies, frameworks, and tools
      4. Products and services
      5. Locations and geographical references
      
      Return as: {
        "organizations": [...],
        "people": [...],
        "technologies": [...],
        "products": [...],
        "locations": [...]
      }`
    },
    timeout: 180000
  });
  
  await new Promise(resolve => setTimeout(resolve, 8000));
  
  console.log('❓ Step 4/5: Detecting FAQ and Q&A structures...');
  const faqResult = await app.scrapeUrl(url, {
    formats: ["extract"],
    extract: {
      prompt: `Detect FAQ structures and Q&A content:
      
      1. FAQ sections and help content
      2. Question-answer pairs
      3. Support documentation structure
      4. How-to guides and tutorials
      5. Troubleshooting sections
      
      Return as: {
        "faqSections": [...],
        "questionAnswerPairs": number,
        "supportStructures": [...]
      }`
    },
    timeout: 180000
  });
  
  await new Promise(resolve => setTimeout(resolve, 8000));
  
  console.log('🕐 Step 5/5: Analyzing content freshness signals...');
  const freshnessResult = await app.scrapeUrl(url, {
    formats: ["extract"],
    extract: {
      prompt: `Extract temporal data and freshness signals:
      
      1. Publication dates and timestamps
      2. Last modified or updated dates
      3. Update frequency indicators
      4. News, blog posts, or recent content
      5. Version numbers or release dates
      
      Return as: {
        "publishDate": "...",
        "lastModified": "...",
        "updateFrequency": "...",
        "freshnessSignals": [...]
      }`
    },
    timeout: 180000
  });
  
  // Parse structured data from HTML AND AI extraction
  const html = (htmlResult as any).html || '';
  const htmlJsonLd = parseJsonLdFromHtml(html);
  const htmlMicrodata = parseMicrodataFromHtml(html);
  
  // Get AI-extracted structured data (often finds more than regex)
  const aiStructuredData = (htmlResult as any).extract || {};
  let aiJsonLd = [];
  
  // Process AI-found JSON-LD scripts (AI uses different property names)
  if (aiStructuredData.jsonLD && Array.isArray(aiStructuredData.jsonLD)) {
    aiJsonLd = aiStructuredData.jsonLD;
  } else if (aiStructuredData.jsonLdScripts && Array.isArray(aiStructuredData.jsonLdScripts)) {
    aiJsonLd = aiStructuredData.jsonLdScripts.map((script: any) => {
      try {
        if (typeof script === 'object' && script.content) {
          return JSON.parse(script.content);
        } else if (typeof script === 'string') {
          return JSON.parse(script);
        } else if (typeof script === 'object') {
          return script;
        }
      } catch (error) {
        console.warn('Failed to parse AI-extracted JSON-LD:', error);
        return script;
      }
      return script;
    });
  }
  
  // Combine both sources
  const jsonLd = [...htmlJsonLd, ...aiJsonLd];
  const microdata = htmlMicrodata; // AI doesn't extract microdata as well
  const schemaTypes = extractSchemaTypes(jsonLd, microdata);
  
  // Process AI extraction results
  const content = (contentResult as any).extract || {};
  const entities = (entityResult as any).extract || {};
  const faq = (faqResult as any).extract || {};
  const freshness = (freshnessResult as any).extract || {};
  const metadata = (htmlResult as any).metadata || {};
  
  // Find specific schema types
  const organizationSchema = jsonLd.find(item => 
    item['@type'] === 'Organization' || item['@type'] === 'LocalBusiness'
  );
  const websiteSchema = jsonLd.find(item => item['@type'] === 'WebSite');
  const breadcrumbSchema = jsonLd.find(item => item['@type'] === 'BreadcrumbList');
  const faqSchemas = jsonLd.filter(item => item['@type'] === 'FAQPage');
  
  // Build result without geoScore first
  const resultData: Omit<EnhancedGEOResult, 'geoScore'> = {
    url,
    timestamp: new Date().toISOString(),
    
    structuredData: {
      jsonLd,
      microdata,
      rdfa: [], // TODO: Implement RDFa parsing
      schemaTypes,
      faqSchemas,
      organizationSchema,
      websiteSchema,
      breadcrumbSchema
    },
    
    entityRecognition: {
      organizations: entities.organizations || [],
      people: entities.people || [],
      technologies: entities.technologies || [],
      products: entities.products || [],
      locations: entities.locations || []
    },
    
    faqOptimization: {
      faqSections: faq.faqSections || [],
      questionAnswerPairs: faq.questionAnswerPairs || 0,
      faqStructuredData: faqSchemas.length > 0,
      faqSchemaPresent: faqSchemas.length > 0
    },
    
    contentFreshness: {
      publishDate: freshness.publishDate,
      lastModified: freshness.lastModified,
      updateFrequency: freshness.updateFrequency,
      freshnessSignals: freshness.freshnessSignals || []
    },
    
    contentStructure: {
      headingsHierarchy: content.headingsHierarchy || {
        h1: [], h2: [], h3: [], h4: [], h5: [], h6: []
      },
      authoritySignals: {
        statistics: content.authoritySignals?.statistics || [],
        expertQuotes: content.authoritySignals?.expertQuotes || [],
        authorInfo: content.authoritySignals?.authorInfo || {},
        citations: content.authoritySignals?.citations || [],
        testimonials: content.authoritySignals?.testimonials || []
      },
      contentQuality: content.contentQuality || {}
    },
    
    technicalAccessibility: {
      metaTags: {
        title: metadata.title,
        description: metadata.description,
        robots: metadata.robots,
        canonical: metadata.canonical,
        hreflang: [], // TODO: Extract from HTML
        openGraph: {
          'og:title': metadata.ogTitle || '',
          'og:description': metadata.ogDescription || '',
          'og:image': metadata.ogImage || '',
          'og:url': metadata.ogUrl || ''
        },
        twitterCard: {
          'twitter:card': metadata.twitterCard || '',
          'twitter:title': metadata.twitterTitle || '',
          'twitter:description': metadata.twitterDescription || '',
          'twitter:image': metadata.twitterImage || ''
        }
      },
      technicalElements: {
        httpsStatus: url.startsWith('https://'),
        statusCode: metadata.statusCode || 0,
        contentType: metadata.contentType,
        responseTime: metadata.responseTime,
        mobileFriendly: undefined, // TODO: Implement
        internalLinks: [], // TODO: Extract from content
        coreWebVitals: undefined // TODO: Implement performance metrics
      },
      accessibility: {
        altTextCount: 0, // TODO: Count from HTML
        ariaLabels: [], // TODO: Extract from HTML
        semanticElements: [], // TODO: Extract from HTML
        skipLinks: false, // TODO: Detect from HTML
        headingStructureValid: true, // TODO: Validate hierarchy
        landmarkRoles: [] // TODO: Extract ARIA landmarks
      }
    }
  };
  
  // Calculate GEO score
  const geoScore = calculateGEOScore(resultData);
  
  // Base output
  const output: EnhancedGEOOutput = {
    ...resultData,
    geoScore
  };

  // Optional: Prompt-based and Agent-based extractions (via CLI flags)
  const { promptExtract, agentPrompt } = parseOptionalPromptsFromArgs();
  if (promptExtract) {
    console.log('🧾 Extra: Prompt-based extraction...');
    const promptRes = await app.scrapeUrl(url, {
      formats: ["json"],
      jsonOptions: { prompt: promptExtract },
      onlyMainContent: false,
      timeout: 180000
    });
    if ((promptRes as any)?.success) {
      (output as any).promptExtraction = (promptRes as any).json ?? (promptRes as any).extract ?? null;
    } else {
      console.warn('Prompt-based extraction failed:', (promptRes as any)?.error);
    }
  }

  if (agentPrompt) {
    console.log('🤖 Extra: Advanced extraction (agent)...');
    const agentRes = await app.extract([url], {
      prompt: agentPrompt,
      showSources: true,
      allowExternalLinks: true,
      enableWebSearch: false,
      includeSubdomains: false,
      scrapeOptions: {
        waitFor: 2500,
        timeout: 180000
      }
    });
    if ((agentRes as any)?.success) {
      (output as any).advancedExtraction = {
        data: (agentRes as any).data,
        sources: (agentRes as any).sources
      };
    } else {
      console.warn('Advanced extraction failed:', (agentRes as any)?.error);
    }
  }

  return output;
}

// Company-page scrape using Firecrawl formats html + rawHtml, plus optional JSON mode
export async function scrapeCompanyPage(url: string, opts: ScrapeOpts = {}): Promise<ScrapeResult> {
  const app = await createFirecrawlApp();
  const { fresh, locale, userHeaders, useLlmJsonMode, llmSchema, llmPrompt } = opts;
  const scrapeParams: any = {
    formats: ['html', 'rawHtml'],
    onlyMainContent: false,
    headers: userHeaders,
    location: locale,
    timeout: 180000,
    ...(fresh ? { maxAge: 0 } : {})
  };
  if (useLlmJsonMode) {
    scrapeParams.formats.push('json');
    scrapeParams.jsonOptions = {
      schema: llmSchema ?? {
        type: 'object',
        properties: {
          faqs: {
            type: 'array',
            items: {
              type: 'object',
              properties: { question: { type: 'string' }, answer: { type: 'string' } },
              required: ['question', 'answer']
            }
          }
        }
      },
      prompt: llmPrompt ?? 'Extract FAQs as question/answer pairs.'
    };
  }
  // Scrape main page and check txt files in parallel
  let res: any;
  let txtFilesResult: any;
  
  try {
    console.log('[Firecrawl] Starting scrape for:', url);
    [res, txtFilesResult] = await Promise.all([
      app.scrapeUrl(url, scrapeParams).catch((err: any) => {
        // Capture SDK-level errors
        console.error('[Firecrawl] SDK error:', err?.message || 'Unknown SDK error');
        throw err;
      }),
      checkTxtFiles(url)
    ]);
    console.log('[Firecrawl] Scrape completed, success:', res?.success);
  } catch (scrapeError: any) {
    // Handle Firecrawl SDK errors (e.g., undefined response, network errors)
    const errorMessage = scrapeError?.message || 'Unknown Firecrawl error';
    const errorStatus = scrapeError?.status || scrapeError?.statusCode || 'N/A';
    console.error('[Firecrawl] Scrape error:', errorMessage);
    console.error('[Firecrawl] Error status:', errorStatus);
    console.error('[Firecrawl] Full error:', JSON.stringify(scrapeError, null, 2));
    throw new Error(`Firecrawl scrape failed (status: ${errorStatus}): ${errorMessage}`);
  }
  
  if (!res) {
    throw new Error('Firecrawl returned undefined response');
  }
  
  if (!('success' in res) || !res.success) throw new Error((res as any)?.error || 'Scrape failed');
  const html: string = (res as any).html ?? '';
  const rawHtml: string = (res as any).rawHtml ?? html;
  const fullMetadata: Record<string, any> | undefined = (res as any).metadata;
  
  // Extract structured data
  const jsonLdBlocks = extractAllJsonLd(rawHtml);
  const otherStructured = extractAllStructuredData(rawHtml);
  const allSchema: SchemaBlock[] = [...jsonLdBlocks, ...otherStructured];
  const faqSchemaBlocks = allSchema.filter(b => {
    const g = b.graph as any; const arr = Array.isArray(g) ? g : [g];
    return arr.some((node: any) => node && (node['@type'] === 'FAQPage' || node['@type'] === 'QAPage'));
  });
  
  // Extract FAQs
  const faqsFromSchema = extractFaqsFromSchema(allSchema);
  const faqsFromDom = extractFaqsFromDom(rawHtml);
  let llmExtracted: FaqItem[] | undefined;
  if (useLlmJsonMode) {
    const json = (res as any).json;
    if (json?.faqs && Array.isArray(json.faqs)) {
      llmExtracted = json.faqs.map((f: any) => ({ question: f?.question, answer: f?.answer, provenance: { source: 'llm' as const } })).filter((f: FaqItem) => f.question && f.answer);
    }
  }
  const merged = mergeFaqs([faqsFromSchema, faqsFromDom, llmExtracted || []]);
  
  // Filter to only essential metadata
  const essentialMetadata = {
    title: fullMetadata?.title,
    description: fullMetadata?.description,
    language: fullMetadata?.language,
    favicon: fullMetadata?.favicon
  };
  
  // Analyze HTML structure and headings
  const { headings, hasProperStructure } = extractHeadingsStructure(html);
  
  // Create summary stats
  const jsonLdCount = allSchema.filter(b => b.source === 'json-ld').length;
  const microdataCount = allSchema.filter(b => b.source === 'microdata').length;
  const rdfaCount = allSchema.filter(b => b.source === 'rdfa').length;
  
  // Create txt files summary
  const txtFilesSummary = {
    hasRobotsTxt: txtFilesResult.robots.exists,
    hasLlmsTxt: txtFilesResult.llms.exists,
    hasLlmsFullTxt: txtFilesResult.llmsFull.exists,
    totalFound: [txtFilesResult.robots, txtFilesResult.llms, txtFilesResult.llmsFull].filter(f => f.exists).length
  };

  // Build synthesized JSON-LD from content
  const synthesizedJsonLd = buildSynthesizedJsonLd(url, essentialMetadata, merged, headings);

  return {
    url,
    metadata: essentialMetadata,
    htmlStructure: {
      headings,
      htmlLength: html.length,
      rawHtmlLength: rawHtml.length,
      hasProperStructure
    },
    schema: {
      all: allSchema,
      faqSchema: faqSchemaBlocks,
      summary: {
        jsonLdCount,
        microdataCount,
        rdfaCount,
        faqSchemaCount: faqSchemaBlocks.length
      }
    },
    faqs: {
      fromSchema: faqsFromSchema,
      fromDom: faqsFromDom,
      llmExtracted,
      merged,
      summary: {
        totalUnique: merged.length,
        schemaCount: faqsFromSchema.length,
        domCount: faqsFromDom.length,
        llmCount: llmExtracted?.length || 0
      }
    },
    txtFiles: {
      robots: txtFilesResult.robots,
      llms: txtFilesResult.llms,
      llmsFull: txtFilesResult.llmsFull,
      summary: txtFilesSummary
    },
    synthesizedJsonLd
  };
}

// Batch scrape using Firecrawl batch APIs
export async function batchScrape(urls: string[], opts: ScrapeOpts = {}): Promise<ScrapeResult[]> {
  // ✅ RATE LIMIT: Maximum 10 pages per user
  const MAX_PAGES_PER_USER = 10;
  if (urls.length > MAX_PAGES_PER_USER) {
    console.warn(`⚠️ [Scraper] Rate limit: ${urls.length} URLs requested, limiting to ${MAX_PAGES_PER_USER} important pages`);
    urls = urls.slice(0, MAX_PAGES_PER_USER);
  }

  const app = await createFirecrawlApp();
  const { fresh, locale, userHeaders, useLlmJsonMode, llmSchema, llmPrompt } = opts;
  const scrapeParams: any = {
    formats: ['html', 'rawHtml'],
    onlyMainContent: false,
    headers: userHeaders,
    location: locale,
    timeout: 180000,
    ...(fresh ? { maxAge: 0 } : {})
  };
  if (useLlmJsonMode) {
    scrapeParams.formats.push('json');
    scrapeParams.jsonOptions = {
      schema: llmSchema ?? {
        type: 'object',
        properties: { faqs: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, answer: { type: 'string' } }, required: ['question', 'answer'] } } }
      },
      prompt: llmPrompt ?? 'Extract FAQs as question/answer pairs.'
    };
  }
  const start = await app.asyncBatchScrapeUrls(urls, scrapeParams);
  if (!('success' in start) || !start.success) throw new Error((start as any)?.error || 'Failed to start batch scrape');
  const jobId = (start as any).id; if (!jobId) throw new Error('No batch job id');
  let status: any;
  for (;;) {
    status = await app.checkBatchScrapeStatus(jobId);
    if (!('success' in status) || !status.success) throw new Error((status as any)?.error || 'Batch status failed');
    if (status.status === 'completed') break;
    if (status.status === 'failed' || status.status === 'cancelled') throw new Error('Batch job failed or cancelled');
    await new Promise(r => setTimeout(r, 2000));
  }
  const docs = (status as any).data || [];
  const results: ScrapeResult[] = [];
  for (const d of docs) {
    const pageUrl: string = d?.url || d?.metadata?.sourceURL || urls[0];
    const html: string = d?.html || '';
    const rawHtml: string = d?.rawHtml || html;
    const metadata: Record<string, any> | undefined = d?.metadata;
    const jsonLdBlocks = extractAllJsonLd(rawHtml);
    const otherStructured = extractAllStructuredData(rawHtml);
    const allSchema: SchemaBlock[] = [...jsonLdBlocks, ...otherStructured];
    const faqSchemaBlocks = allSchema.filter(b => { const g = b.graph as any; const arr = Array.isArray(g) ? g : [g]; return arr.some((node: any) => node && (node['@type'] === 'FAQPage' || node['@type'] === 'QAPage')); });
    const faqsFromSchema = extractFaqsFromSchema(allSchema);
    const faqsFromDom = extractFaqsFromDom(rawHtml);
    let llmExtracted: FaqItem[] | undefined;
    if (useLlmJsonMode) {
      const json = d?.json; if (json?.faqs && Array.isArray(json.faqs)) { llmExtracted = json.faqs.map((f: any) => ({ question: f?.question, answer: f?.answer, provenance: { source: 'llm' as const } })).filter((f: FaqItem) => f.question && f.answer); }
    }
    const merged = mergeFaqs([faqsFromSchema, faqsFromDom, llmExtracted || []]);
    // Filter metadata and create summaries
    const essentialMetadata = {
      title: metadata?.title,
      description: metadata?.description,
      language: metadata?.language,
      favicon: metadata?.favicon
    };
    
    // Analyze HTML structure
    const { headings, hasProperStructure } = extractHeadingsStructure(html);
    
    const jsonLdCount = allSchema.filter(b => b.source === 'json-ld').length;
    const microdataCount = allSchema.filter(b => b.source === 'microdata').length;
    const rdfaCount = allSchema.filter(b => b.source === 'rdfa').length;
    
    results.push({
      url: pageUrl,
      metadata: essentialMetadata,
      htmlStructure: {
        headings,
        htmlLength: html.length,
        rawHtmlLength: rawHtml.length,
        hasProperStructure
      },
      schema: {
        all: allSchema,
        faqSchema: faqSchemaBlocks,
        summary: {
          jsonLdCount,
          microdataCount,
          rdfaCount,
          faqSchemaCount: faqSchemaBlocks.length
        }
      },
      faqs: {
        fromSchema: faqsFromSchema,
        fromDom: faqsFromDom,
        llmExtracted,
        merged,
        summary: {
          totalUnique: merged.length,
          schemaCount: faqsFromSchema.length,
          domCount: faqsFromDom.length,
          llmCount: llmExtracted?.length || 0
        }
      },
      txtFiles: {
        robots: { url: '', exists: false, size: 0 },
        llms: { url: '', exists: false, size: 0 },
        llmsFull: { url: '', exists: false, size: 0 },
        summary: { hasRobotsTxt: false, hasLlmsTxt: false, hasLlmsFullTxt: false, totalFound: 0 }
      }
    });
  }
  return results;
}



/**
 * Save enhanced results
 */
async function saveEnhancedResults(data: { url: string } & Record<string, any>): Promise<string> {
  const fs = await import('fs');
  const path = await import('path');
  
  const outputDir = 'output';
  const domain = new URL(data.url).hostname.replace(/\./g, '-');
  const filename = `enhanced-geo-${domain}-${Date.now()}.json`;
  const filepath = path.join(outputDir, filename);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  return filepath;
}

/**
 * Parse optional prompts from CLI flags
 * --prompt "..." and --agent-prompt "..."
 */
function parseOptionalPromptsFromArgs(): { promptExtract?: string; agentPrompt?: string } {
  const argv = process.argv;
  let promptExtract: string | undefined;
  let agentPrompt: string | undefined;
  for (let i = 3; i < argv.length; i++) {
    const a = argv[i];
    if (!a) continue;
    if (a === '--prompt') {
      if (i + 1 < argv.length) {
        promptExtract = argv[i + 1];
        i++;
      }
    } else if (a === '--agent-prompt') {
      if (i + 1 < argv.length) {
        agentPrompt = argv[i + 1];
        i++;
      }
    }
  }
  return { promptExtract, agentPrompt };
}

// Display formatted scrape results to console
function displayScrapeResult(result: ScrapeResult): void {
  console.log('\n🧭 COMPANY PAGE SCRAPE RESULTS (FILTERED)');
  console.log('================================================================================');
  console.log(`URL: ${result.url}\n`);
  
  // Essential metadata
  console.log('📄 ESSENTIAL METADATA');
  console.log(`Title: ${result.metadata.title || 'N/A'}`);
  console.log(`Description: ${result.metadata.description || 'N/A'}`);
  console.log(`Language: ${result.metadata.language || 'N/A'}`);
  console.log(`Favicon: ${result.metadata.favicon || 'N/A'}\n`);
  
  // HTML structure analysis
  console.log('🏗️ HTML STRUCTURE & HEADINGS');
  console.log(`HTML Length: ${result.htmlStructure.htmlLength.toLocaleString()} chars`);
  console.log(`Raw HTML Length: ${result.htmlStructure.rawHtmlLength.toLocaleString()} chars`);
  console.log(`Proper Structure: ${result.htmlStructure.hasProperStructure ? '✅' : '❌'}`);
  
  // Show headings summary
  const { headings } = result.htmlStructure;
  for (const [level, items] of Object.entries(headings)) {
    if (items.length > 0) {
      console.log(`${level.toUpperCase()}: ${items.length} headings`);
      const preview = items.slice(0, 3);
      preview.forEach((text, i) => console.log(`  ${i + 1}. ${text}`));
      if (items.length > 3) {
        console.log(`  ... and ${items.length - 3} more ${level.toUpperCase()} headings`);
      }
    }
  }
  console.log('');
  
  // Structured data summary
  console.log('📋 STRUCTURED DATA SUMMARY');
  console.log(`JSON-LD blocks: ${result.schema.summary.jsonLdCount}`);
  console.log(`Microdata blocks: ${result.schema.summary.microdataCount}`);
  console.log(`RDFa blocks: ${result.schema.summary.rdfaCount}`);
  console.log(`FAQ Schema blocks: ${result.schema.summary.faqSchemaCount}\n`);
  
  // Print full JSON-LD blocks (truncated only by console width)
  if (result.schema.summary.jsonLdCount > 0) {
    console.log('🧾 JSON-LD BLOCKS (raw)');
    result.schema.all
      .filter(b => b.source === 'json-ld')
      .forEach((b, i) => {
        console.log(`-- JSON-LD #${i + 1} --`);
        const raw = (b as any).raw ?? JSON.stringify(b.graph, null, 2);
        console.log(raw);
      });
    console.log('');
  }
  
  // Print synthesized JSON-LD
  if (result.synthesizedJsonLd && result.synthesizedJsonLd.length > 0) {
    console.log('🧩 SYNTHESIZED JSON-LD (WebPage/FAQPage)');
    result.synthesizedJsonLd.forEach((obj, i) => {
      console.log(`-- Synth #${i + 1} --`);
      console.log(JSON.stringify(obj, null, 2));
    });
    console.log('');
  }
  
  // FAQ summary
  console.log('❓ FAQ SUMMARY');
  console.log(`From Schema: ${result.faqs.summary.schemaCount}`);
  console.log(`From DOM: ${result.faqs.summary.domCount}`);
  console.log(`From LLM: ${result.faqs.summary.llmCount}`);
  console.log(`Total Unique: ${result.faqs.summary.totalUnique}\n`);
  
  // Show sample FAQs if any exist
  if (result.faqs.merged.length > 0) {
    console.log('📝 SAMPLE FAQs (First 3):');
    result.faqs.merged.slice(0, 3).forEach((faq, i) => {
      console.log(`${i + 1}. Q: ${faq.question}`);
      console.log(`   A: ${faq.answer?.substring(0, 100)}${faq.answer && faq.answer.length > 100 ? '...' : ''}\n`);
      console.log(`   Source: ${faq.provenance?.source || 'unknown'}`);
    });
    if (result.faqs.merged.length > 3) {
      console.log(`   ... and ${result.faqs.merged.length - 3} more FAQs\n`);
    }
  }
  
  // TXT Files summary
  console.log('🤖 ROBOTS & LLM POLICY FILES');
  console.log(`robots.txt: ${result.txtFiles.summary.hasRobotsTxt ? '✅' : '❌'} ${result.txtFiles.robots.exists ? `(${result.txtFiles.robots.size} bytes)` : '(not found)'}`);
  console.log(`llms.txt: ${result.txtFiles.summary.hasLlmsTxt ? '✅' : '❌'} ${result.txtFiles.llms.exists ? `(${result.txtFiles.llms.size} bytes)` : '(not found)'}`);
  console.log(`llms-full.txt: ${result.txtFiles.summary.hasLlmsFullTxt ? '✅' : '❌'} ${result.txtFiles.llmsFull.exists ? `(${result.txtFiles.llmsFull.size} bytes)` : '(not found)'}`);
  console.log(`Total Policy Files Found: ${result.txtFiles.summary.totalFound}/3\n`);
}

/**
 * Main execution - only run if called directly from command line
 */
async function main() {
  const url = process.argv[2];
  
  if (!url) {
    console.log('❌ Error: URL is required');
    console.log('Usage: npx tsx src/enhanced-geo-scraper.ts <url>');
    process.exit(1);
  }
  
  try {
    new URL(url);
  } catch (error) {
    console.log('❌ Error: Invalid URL format');
    process.exit(1);
  }
  
  if (!process.env.FIRECRAWL_API_KEY) {
    console.log('❌ Error: FIRECRAWL_API_KEY environment variable is required');
    process.exit(1);
  }
  
  // CLI flags for company-page scraping
  const { fresh, useLlm } = parseCliFlags();

  try {
    const result = await scrapeCompanyPage(url, { fresh, useLlmJsonMode: useLlm });
    displayScrapeResult(result);
    const filepath = await saveEnhancedResults(result);
    console.log(`\n💾 Scrape saved to: ${filepath}`);
    console.log('\n✅ Company Page Scrape completed!');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Company Page Scrape failed:', errorMessage);
    process.exit(1);
  }
}

// Only run main() if this file is executed directly
if (require.main === module) {
  main();
} 

function parseCliFlags(): { fresh: boolean; useLlm: boolean } {
  const argv = process.argv;
  let fresh = false;
  let useLlm = false;
  for (let i = 3; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--fresh') fresh = true;
    else if (a === '--use-llm') useLlm = true;
  }
  return { fresh, useLlm };
}

// Build synthesized JSON-LD (WebPage and FAQPage) from extracted pieces
function buildSynthesizedJsonLd(url: string, metadata: { title?: string; description?: string; language?: string }, faqs: FaqItem[], headings: { h1: string[]; h2: string[]; h3: string[]; h4: string[]; h5: string[]; h6: string[] }): any[] {
  const out: any[] = [];
  const origin = (() => { try { return new URL(url).origin; } catch { return undefined; } })();
  // WebPage
  out.push({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    url,
    name: metadata.title || headings.h1?.[0] || undefined,
    description: metadata.description || undefined,
    inLanguage: metadata.language || undefined,
    headline: headings.h1?.[0] || undefined,
    about: (headings.h2 || []).slice(0, 6)
  });
  // FAQPage if we have FAQs
  if (faqs.length > 0) {
    out.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map(f => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer }
      }))
    });
  }
  // Organization (basic placeholder using origin as url)
  if (origin) {
    out.push({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      url: origin,
      name: metadata.title || undefined,
      description: metadata.description || undefined
    });
  }
  // Article (if headings suggest an article-like structure)
  if ((headings.h2?.length || 0) > 3 || (headings.h3?.length || 0) > 5) {
    out.push({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: headings.h1?.[0] || metadata.title || undefined,
      description: metadata.description || undefined,
      inLanguage: metadata.language || undefined,
      mainEntityOfPage: url
    });
  }
  // Product (lightweight, inferred if certain keywords exist in headings)
  const productHint = [...(headings.h1 || []), ...(headings.h2 || [])]
    .join(' ').toLowerCase().match(/pricing|plan|buy|product|features|trial|demo/);
  if (productHint) {
    out.push({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: headings.h1?.[0] || metadata.title || 'Product',
      description: metadata.description || undefined,
      url
    });
  }
  // BreadcrumbList (derive from URL path segments)
  try {
    const u = new URL(url);
    const segments = u.pathname.split('/').filter(Boolean);
    if (segments.length > 0) {
      out.push({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: segments.map((seg, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          name: seg,
          item: `${u.origin}/${segments.slice(0, idx + 1).join('/')}`
        }))
      });
    }
  } catch {}
  return out;
} 