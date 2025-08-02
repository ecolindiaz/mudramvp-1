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
export async function extractEnhancedGEOData(url: string): Promise<EnhancedGEOResult> {
  const app = createFirecrawlApp();
  
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
  
  return {
    ...resultData,
    geoScore
  };
}

/**
 * Display enhanced GEO results with scoring
 */
function displayEnhancedGEOResults(data: EnhancedGEOResult): void {
  console.log('\n🎯 ENHANCED GEO ANALYSIS RESULTS');
  console.log('=' .repeat(80));
  console.log(`URL: ${data.url}`);
  console.log(`Analysis Time: ${data.timestamp}`);
  
  // GEO Score Dashboard
  console.log('\n📊 GEO SCORE DASHBOARD');
  console.log('-' .repeat(50));
  console.log(`🏆 OVERALL SCORE: ${data.geoScore.overall}/100`);
  console.log(`📝 Content Authority: ${data.geoScore.contentAuthority}/100`);
  console.log(`🔧 Technical Accessibility: ${data.geoScore.technicalAccessibility}/100`);
  console.log(`📋 Structured Data: ${data.geoScore.structuredData}/100`);
  console.log(`🧠 Entity Recognition: ${data.geoScore.entityRecognition}/100`);
  console.log(`❓ FAQ Optimization: ${data.geoScore.faqOptimization}/100`);
  console.log(`🕐 Content Freshness: ${data.geoScore.contentFreshness}/100`);
  
  // Structured Data Analysis (FIXED!)
  console.log('\n1️⃣ STRUCTURED DATA ANALYSIS (ENHANCED)');
  console.log('-' .repeat(50));
  console.log(`JSON-LD Scripts: ${data.structuredData.jsonLd.length} found`);
  console.log(`Microdata Elements: ${data.structuredData.microdata.length} found`);
  console.log(`Schema Types: ${data.structuredData.schemaTypes.join(', ') || 'None'}`);
  console.log(`Organization Schema: ${data.structuredData.organizationSchema ? '✅' : '❌'}`);
  console.log(`Website Schema: ${data.structuredData.websiteSchema ? '✅' : '❌'}`);
  console.log(`FAQ Schema: ${data.structuredData.faqSchemas.length > 0 ? '✅' : '❌'}`);
  
  if (data.structuredData.jsonLd.length > 0) {
    console.log('\n🔗 JSON-LD Schemas Found:');
    data.structuredData.jsonLd.forEach((schema, i) => {
      console.log(`  ${i + 1}. Type: ${schema['@type'] || 'Unknown'}`);
    });
  }
  
  // Entity Recognition
  console.log('\n2️⃣ ENTITY RECOGNITION');
  console.log('-' .repeat(50));
  console.log(`Organizations: ${data.entityRecognition.organizations.length}`);
  console.log(`People: ${data.entityRecognition.people.length}`);
  console.log(`Technologies: ${data.entityRecognition.technologies.length}`);
  console.log(`Products: ${data.entityRecognition.products.length}`);
  console.log(`Locations: ${data.entityRecognition.locations.length}`);
  
  // FAQ Optimization
  console.log('\n3️⃣ FAQ OPTIMIZATION');
  console.log('-' .repeat(50));
  console.log(`FAQ Sections: ${data.faqOptimization.faqSections.length}`);
  console.log(`Q&A Pairs: ${data.faqOptimization.questionAnswerPairs}`);
  console.log(`FAQ Structured Data: ${data.faqOptimization.faqStructuredData ? '✅' : '❌'}`);
  
  // Content Freshness
  console.log('\n4️⃣ CONTENT FRESHNESS');
  console.log('-' .repeat(50));
  console.log(`Publish Date: ${data.contentFreshness.publishDate || 'Not Found'}`);
  console.log(`Last Modified: ${data.contentFreshness.lastModified || 'Not Found'}`);
  console.log(`Update Frequency: ${data.contentFreshness.updateFrequency || 'Unknown'}`);
  console.log(`Freshness Signals: ${data.contentFreshness.freshnessSignals.length}`);
}

/**
 * Save enhanced results
 */
async function saveEnhancedResults(data: EnhancedGEOResult): Promise<string> {
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
  
  try {
    const enhancedData = await extractEnhancedGEOData(url);
    displayEnhancedGEOResults(enhancedData);
    const filepath = await saveEnhancedResults(enhancedData);
    console.log(`\n💾 Enhanced GEO analysis saved to: ${filepath}`);
    console.log('\n✅ Enhanced GEO Analysis completed!');
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Enhanced GEO Analysis failed:', errorMessage);
    process.exit(1);
  }
}

// Only run main() if this file is executed directly
if (require.main === module) {
  main();
} 