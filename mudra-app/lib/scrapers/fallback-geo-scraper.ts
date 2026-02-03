/**
 * Fallback GEO Scraper - No External API Dependencies
 * 
 * This scraper uses basic web scraping to provide analysis when Firecrawl credits are exhausted.
 * It provides a subset of features but requires no external credits/payments.
 */

import type { EnhancedGEOResult } from './enhanced-geo-scraper';
import { createFirecrawlApp } from '../config/firecrawl-config';

interface BasicScrapedData {
  html: string;
  title: string;
  description: string;
  headings: {
    h1: string[];
    h2: string[];
    h3: string[];
    h4: string[];
    h5: string[];
    h6: string[];
  };
  metaTags: {
    title?: string;
    description?: string;
    canonical?: string;
    robots?: string;
  };
  jsonLdScripts: any[];
  links: { text: string; href: string }[];
  images: { src: string; alt: string }[];
}

/**
 * Basic web scraper using fetch and regex parsing
 */
async function scrapeBasicData(url: string): Promise<BasicScrapedData> {
  console.log(`🔍 Fetching: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();

  // Extract title
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';

  // Extract meta description
  const descMatch = html.match(/<meta[^>]*name=[\"']description[\"'][^>]*content=[\"']([^\"']*)[\"'][^>]*>/i);
  const description = descMatch ? descMatch[1].trim() : '';

  // Extract headings
  const headings = {
    h1: extractHeadings(html, 'h1'),
    h2: extractHeadings(html, 'h2'),
    h3: extractHeadings(html, 'h3'),
    h4: extractHeadings(html, 'h4'),
    h5: extractHeadings(html, 'h5'),
    h6: extractHeadings(html, 'h6'),
  };

  // Extract meta tags
  const metaTags = {
    title: title,
    description: description,
    canonical: extractMetaContent(html, 'canonical'),
    robots: extractMetaContent(html, 'robots'),
  };

  // Extract JSON-LD scripts
  let jsonLdScripts = extractJsonLdScripts(html);

  // If plain fetch found no JSON-LD, try Firecrawl rawHtml to catch JS-rendered schemas
  if (jsonLdScripts.length === 0) {
    try {
      console.log('⚡ No JSON-LD found via plain fetch, trying Firecrawl rawHtml...');
      const app = await createFirecrawlApp();
      const firecrawlResult = await app.scrapeUrl(url, {
        formats: ["rawHtml"],
        onlyMainContent: false,
        timeout: 60000
      });
      const rawHtml = (firecrawlResult as any).rawHtml || '';
      if (rawHtml) {
        jsonLdScripts = extractJsonLdScripts(rawHtml);
        if (jsonLdScripts.length > 0) {
          console.log(`✅ Firecrawl found ${jsonLdScripts.length} JSON-LD schema(s)`);
        }
      }
    } catch (error) {
      console.warn('⚠️ Firecrawl fallback unavailable, continuing with plain fetch results:',
        error instanceof Error ? error.message : 'Unknown error');
    }
  }

  // Extract links and images (basic)
  const links = extractLinks(html);
  const images = extractImages(html);

  return {
    html,
    title,
    description,
    headings,
    metaTags,
    jsonLdScripts,
    links,
    images
  };
}

/**
 * Extract headings of a specific level
 */
function extractHeadings(html: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 'gi');
  const matches = [];
  let match;
  
  while ((match = regex.exec(html)) !== null) {
    const text = match[1].replace(/<[^>]*>/g, '').trim();
    if (text) {
      matches.push(text);
    }
  }
  
  return matches;
}

/**
 * Extract meta tag content
 */
function extractMetaContent(html: string, name: string): string | undefined {
  const regex = new RegExp(`<meta[^>]*(?:name|property)=[\"']${name}[\"'][^>]*content=[\"']([^\"']*)[\"'][^>]*>`, 'i');
  const match = html.match(regex);
  return match ? match[1].trim() : undefined;
}

/**
 * Extract JSON-LD structured data scripts
 */
function extractJsonLdScripts(html: string): any[] {
  const scripts = [];
  const regex = /<script[^>]*type=[\"']application\/ld\+json[\"'][^>]*>(.*?)<\/script>/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    try {
      const jsonData = JSON.parse(match[1].trim());
      scripts.push(jsonData);
    } catch (error) {
      console.warn('Failed to parse JSON-LD script:', error);
    }
  }

  return scripts;
}

/**
 * Extract basic links
 */
function extractLinks(html: string): { text: string; href: string }[] {
  const links = [];
  const regex = /<a[^>]*href=[\"']([^\"']*)[\"'][^>]*>(.*?)<\/a>/gi;
  let match;

  while ((match = regex.exec(html)) !== null && links.length < 50) {
    const href = match[1];
    const text = match[2].replace(/<[^>]*>/g, '').trim();
    if (text && href) {
      links.push({ text, href });
    }
  }

  return links;
}

/**
 * Extract basic images
 */
function extractImages(html: string): { src: string; alt: string }[] {
  const images = [];
  const regex = /<img[^>]*src=[\"']([^\"']*)[\"'][^>]*(?:alt=[\"']([^\"']*)[\"'])?[^>]*>/gi;
  let match;

  while ((match = regex.exec(html)) !== null && images.length < 20) {
    const src = match[1];
    const alt = match[2] || '';
    if (src) {
      images.push({ src, alt });
    }
  }

  return images;
}

/**
 * Calculate basic GEO score from scraped data
 */
function calculateBasicGEOScore(data: BasicScrapedData): {
  overall: number;
  contentAuthority: number;
  technicalAccessibility: number;
  structuredData: number;
  entityRecognition: number;
  faqOptimization: number;
  contentFreshness: number;
} {
  // Structured Data Score (0-100)
  let structuredDataScore = 0;
  if (data.jsonLdScripts.length > 0) structuredDataScore += 40;
  if (data.jsonLdScripts.some(script => script['@type'] === 'Organization')) structuredDataScore += 20;
  if (data.jsonLdScripts.some(script => script['@type'] === 'WebSite')) structuredDataScore += 20;
  if (data.jsonLdScripts.some(script => script['@type'] === 'FAQPage')) structuredDataScore += 20;

  // Technical Accessibility Score (0-100)
  let technicalScore = 0;
  if (data.metaTags.title && data.metaTags.title.length > 10) technicalScore += 25;
  if (data.metaTags.description && data.metaTags.description.length > 50) technicalScore += 25;
  if (data.metaTags.canonical) technicalScore += 15;
  if (data.headings.h1.length === 1) technicalScore += 20; // Exactly one H1
  if (data.headings.h2.length > 0) technicalScore += 15; // Has H2s

  // Content Authority Score (0-100)
  let contentScore = 0;
  const totalHeadings = Object.values(data.headings).flat().length;
  if (totalHeadings > 3) contentScore += 30;
  if (data.links.length > 5) contentScore += 20;
  if (data.images.length > 2) contentScore += 20;
  
  // Check for authority signals in text
  const htmlText = data.html.toLowerCase();
  if (htmlText.includes('expert') || htmlText.includes('professional')) contentScore += 15;
  if (htmlText.includes('award') || htmlText.includes('certified')) contentScore += 15;

  // Entity Recognition Score (0-100) - Basic keyword detection
  let entityScore = 0;
  const commonEntities = ['company', 'business', 'service', 'product', 'technology', 'team', 'about'];
  const foundEntities = commonEntities.filter(entity => htmlText.includes(entity));
  entityScore = Math.min(foundEntities.length * 15, 100);

  // FAQ Optimization Score (0-100)
  let faqScore = 0;
  if (htmlText.includes('faq') || htmlText.includes('frequently asked')) faqScore += 40;
  if (htmlText.includes('question') && htmlText.includes('answer')) faqScore += 30;
  if (data.jsonLdScripts.some(script => script['@type'] === 'FAQPage')) faqScore += 30;

  // Content Freshness Score (0-100) - Basic date detection
  let freshnessScore = 50; // Default neutral score
  const currentYear = new Date().getFullYear();
  if (htmlText.includes(currentYear.toString())) freshnessScore = 80;
  if (htmlText.includes((currentYear - 1).toString())) freshnessScore = 60;

  // Calculate overall score
  const overall = Math.round(
    (structuredDataScore + technicalScore + contentScore + entityScore + faqScore + freshnessScore) / 6
  );

  return {
    overall,
    contentAuthority: contentScore,
    technicalAccessibility: technicalScore,
    structuredData: structuredDataScore,
    entityRecognition: entityScore,
    faqOptimization: faqScore,
    contentFreshness: freshnessScore
  };
}

/**
 * Main fallback GEO analysis function
 */
export async function extractFallbackGEOData(url: string): Promise<EnhancedGEOResult> {
  console.log(`🔄 Running Fallback GEO Analysis (No Credits Required): ${url}`);
  
  try {
    const scrapedData = await scrapeBasicData(url);
    const geoScore = calculateBasicGEOScore(scrapedData);

    // Build result in expected format
    const result: EnhancedGEOResult = {
      url,
      timestamp: new Date().toISOString(),
      geoScore,
      
      structuredData: {
        jsonLd: scrapedData.jsonLdScripts,
        microdata: [], // Not extracted in fallback
        rdfa: [], // Not extracted in fallback
        schemaTypes: scrapedData.jsonLdScripts.map(script => script['@type']).filter(Boolean),
        faqSchemas: scrapedData.jsonLdScripts.filter(script => script['@type'] === 'FAQPage'),
        organizationSchema: scrapedData.jsonLdScripts.find(script => script['@type'] === 'Organization'),
        websiteSchema: scrapedData.jsonLdScripts.find(script => script['@type'] === 'WebSite'),
        breadcrumbSchema: scrapedData.jsonLdScripts.find(script => script['@type'] === 'BreadcrumbList')
      },
      
      entityRecognition: {
        organizations: extractBasicEntities(scrapedData.html, 'organization'),
        people: extractBasicEntities(scrapedData.html, 'person'),
        technologies: extractBasicEntities(scrapedData.html, 'technology'),
        products: extractBasicEntities(scrapedData.html, 'product'),
        locations: extractBasicEntities(scrapedData.html, 'location')
      },
      
      faqOptimization: {
        faqSections: detectFAQSections(scrapedData.html),
        questionAnswerPairs: countQuestionAnswerPairs(scrapedData.html),
        faqStructuredData: scrapedData.jsonLdScripts.some(script => script['@type'] === 'FAQPage'),
        faqSchemaPresent: scrapedData.jsonLdScripts.some(script => script['@type'] === 'FAQPage')
      },
      
      contentFreshness: {
        publishDate: extractDateFromHtml(scrapedData.html, 'published'),
        lastModified: extractDateFromHtml(scrapedData.html, 'modified'),
        updateFrequency: 'unknown',
        freshnessSignals: detectFreshnessSignals(scrapedData.html)
      },
      
      contentStructure: {
        headingsHierarchy: scrapedData.headings,
        authoritySignals: {
          statistics: extractStatistics(scrapedData.html),
          expertQuotes: extractQuotes(scrapedData.html),
          authorInfo: {},
          citations: extractCitations(scrapedData.html),
          testimonials: extractTestimonials(scrapedData.html)
        },
        contentQuality: {
          wordCount: estimateWordCount(scrapedData.html),
          paragraphCount: (scrapedData.html.match(/<p[^>]*>/gi) || []).length,
          listCount: (scrapedData.html.match(/<[uo]l[^>]*>/gi) || []).length,
          tableCount: (scrapedData.html.match(/<table[^>]*>/gi) || []).length,
          imageCount: scrapedData.images.length,
          readingLevel: 'intermediate'
        }
      },
      
      technicalAccessibility: {
        metaTags: {
          title: scrapedData.metaTags.title,
          description: scrapedData.metaTags.description,
          robots: scrapedData.metaTags.robots,
          canonical: scrapedData.metaTags.canonical,
          hreflang: [],
          openGraph: extractOpenGraphTags(scrapedData.html),
          twitterCard: extractTwitterCardTags(scrapedData.html)
        },
        technicalElements: {
          httpsStatus: url.startsWith('https://'),
          statusCode: 200,
          contentType: 'text/html',
          responseTime: undefined,
          mobileFriendly: undefined,
          internalLinks: scrapedData.links.filter(link => 
            link.href.startsWith('/') || link.href.includes(new URL(url).hostname)
          ).map(link => link.href),
          coreWebVitals: undefined
        },
        accessibility: {
          altTextCount: scrapedData.images.filter(img => img.alt).length,
          ariaLabels: [],
          semanticElements: extractSemanticElements(scrapedData.html),
          skipLinks: scrapedData.html.includes('skip') && scrapedData.html.includes('content'),
          headingStructureValid: validateHeadingStructure(scrapedData.headings),
          landmarkRoles: []
        }
      }
    };

    console.log(`✅ Fallback Analysis Complete - Score: ${geoScore.overall}/100`);
    return result;

  } catch (error) {
    console.error('❌ Fallback scraper failed:', error);
    throw new Error(`Fallback scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Helper functions for basic content extraction
function extractBasicEntities(html: string, type: string): string[] {
  const entities = [];
  const text = html.replace(/<[^>]*>/g, ' ').toLowerCase();
  
  // Basic keyword matching based on type
  const patterns = {
    organization: /\b(company|corporation|inc|llc|ltd|business|firm|agency|startup)\b/g,
    person: /\b(ceo|founder|director|manager|expert|author|speaker|consultant)\b/g,
    technology: /\b(javascript|python|react|nodejs|ai|machine learning|cloud|api|software)\b/g,
    product: /\b(product|service|solution|platform|tool|app|software|system)\b/g,
    location: /\b(office|headquarters|located|based in|new york|california|london|remote)\b/g
  };

  const matches = text.match(patterns[type as keyof typeof patterns]) || [];
  return [...new Set(matches)].slice(0, 10); // Unique values, max 10
}

function detectFAQSections(html: string): string[] {
  const sections = [];
  const faqRegex = /<[^>]*(?:faq|question|q&a)[^>]*>(.*?)<\/[^>]*>/gi;
  let match;
  
  while ((match = faqRegex.exec(html)) !== null && sections.length < 10) {
    const content = match[1].replace(/<[^>]*>/g, '').trim();
    if (content.length > 10) {
      sections.push(content);
    }
  }
  
  return sections;
}

function countQuestionAnswerPairs(html: string): number {
  const questionCount = (html.match(/\?/g) || []).length;
  const answerWords = (html.match(/\b(answer|reply|response|solution)\b/gi) || []).length;
  return Math.min(questionCount, answerWords);
}

function extractDateFromHtml(html: string, type: string): string | undefined {
  const patterns = {
    published: /<time[^>]*datetime=[\"']([^\"']*)[\"'][^>]*>/i,
    modified: /<meta[^>]*property=[\"']article:modified_time[\"'][^>]*content=[\"']([^\"']*)[\"'][^>]*>/i
  };
  
  const match = html.match(patterns[type as keyof typeof patterns]);
  return match ? match[1] : undefined;
}

function detectFreshnessSignals(html: string): string[] {
  const signals = [];
  const currentYear = new Date().getFullYear();
  
  if (html.includes(currentYear.toString())) signals.push(`Contains ${currentYear}`);
  if (html.includes('updated') || html.includes('recent')) signals.push('Update indicators');
  if (html.includes('new') || html.includes('latest')) signals.push('Freshness keywords');
  
  return signals;
}

function extractStatistics(html: string): string[] {
  const stats = [];
  const statRegex = /\b\d+(?:,\d{3})*(?:\.\d+)?(?:%|\+|k|m|billion|million|thousand)\b/g;
  const matches = html.match(statRegex) || [];
  return [...new Set(matches)].slice(0, 10);
}

function extractQuotes(html: string): string[] {
  const quotes = [];
  const quoteRegex = /<(?:blockquote|q)[^>]*>(.*?)<\/(?:blockquote|q)>/gi;
  let match;
  
  while ((match = quoteRegex.exec(html)) !== null && quotes.length < 5) {
    const quote = match[1].replace(/<[^>]*>/g, '').trim();
    if (quote.length > 20) {
      quotes.push(quote);
    }
  }
  
  return quotes;
}

function extractCitations(html: string): string[] {
  const citations = [];
  if (html.includes('source:') || html.includes('according to')) {
    citations.push('Source references found');
  }
  return citations;
}

function extractTestimonials(html: string): string[] {
  const testimonials = [];
  if (html.toLowerCase().includes('testimonial') || html.toLowerCase().includes('review')) {
    testimonials.push('Testimonial content detected');
  }
  return testimonials;
}

function estimateWordCount(html: string): number {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.split(' ').length;
}

function extractOpenGraphTags(html: string): Record<string, string> {
  const ogTags: Record<string, string> = {};
  const ogRegex = /<meta[^>]*property=[\"']og:([^\"']*)[\"'][^>]*content=[\"']([^\"']*)[\"'][^>]*>/gi;
  let match;
  
  while ((match = ogRegex.exec(html)) !== null) {
    ogTags[`og:${match[1]}`] = match[2];
  }
  
  return ogTags;
}

function extractTwitterCardTags(html: string): Record<string, string> {
  const twitterTags: Record<string, string> = {};
  const twitterRegex = /<meta[^>]*name=[\"']twitter:([^\"']*)[\"'][^>]*content=[\"']([^\"']*)[\"'][^>]*>/gi;
  let match;
  
  while ((match = twitterRegex.exec(html)) !== null) {
    twitterTags[`twitter:${match[1]}`] = match[2];
  }
  
  return twitterTags;
}

function extractSemanticElements(html: string): string[] {
  const elements = [];
  const semanticTags = ['article', 'section', 'nav', 'header', 'footer', 'main', 'aside'];
  
  for (const tag of semanticTags) {
    if (html.includes(`<${tag}`)) {
      elements.push(tag);
    }
  }
  
  return elements;
}

function validateHeadingStructure(headings: Record<string, string[]>): boolean {
  // Basic validation: should have H1 and some structure
  return headings.h1.length === 1 && (headings.h2.length > 0 || headings.h3.length > 0);
}
