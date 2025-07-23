#!/usr/bin/env node

/**
 * GEO Technical Scraper
 * 
 * Comprehensive technical scraping for GEO (Generative Engine Optimization)
 * Extracts all structured data, content authority signals, and technical accessibility elements
 * 
 * Usage: npx tsx src/geo-technical-scraper.ts <url>
 */

import { createFirecrawlApp } from './config/firecrawl-config.js';

interface GEOTechnicalResult {
  url: string;
  timestamp: string;
  
  // 1. Structured Data & Schema Markup
  structuredData: {
    jsonLd: any[];
    microdata: any[];
    rdfa: any[];
    schemaTypes: string[];
    prioritySchemas: {
      organization?: any;
      article?: any;
      product?: any;
      person?: any;
      faq?: any;
      breadcrumb?: any;
      website?: any;
    };
  };
  
  // 2. Content Structure & Authority Signals
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
      publicationDate?: string;
      lastUpdated?: string;
      citations: string[];
    };
    contentQuality: {
      wordCount?: number;
      paragraphCount?: number;
      listCount?: number;
      tableCount?: number;
      imageCount?: number;
    };
  };
  
  // 3. Technical Accessibility for AI Crawlers
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
    };
    accessibility: {
      altTextCount: number;
      ariaLabels: string[];
      semanticElements: string[];
      skipLinks: boolean;
    };
  };
}

/**
 * Extract comprehensive GEO technical data from a URL
 */
async function extractGEOTechnicalData(url: string): Promise<GEOTechnicalResult> {
  const app = createFirecrawlApp();
  
  console.log(`🔍 Running GEO Technical Analysis on: ${url}`);
  
  // Execute three parallel extractions for comprehensive coverage
  const [structuredDataResult, contentAnalysisResult, technicalResult] = await Promise.all([
    
    // 1. Structured Data & Schema Markup Extraction
    app.scrapeUrl(url, {
      formats: ["extract"],
      extract: {
        prompt: `Extract all structured data and schema markup:
        
        1. Find all JSON-LD scripts (type="application/ld+json")
        2. Extract microdata (itemscope, itemtype, itemprop attributes)
        3. Find RDFa markup (typeof, property, resource attributes)
        4. Identify schema types: Organization, LocalBusiness, Service, Article, BlogPosting, Product, Offer, Review, Person, ContactPoint, FAQPage, HowTo, Recipe, Event, Course, JobPosting, BreadcrumbList, SiteNavigationElement, WebSite, WebPage
        5. Extract structured data for priority schemas
        
        Return as: {
          "jsonLd": [...],
          "microdata": [...], 
          "rdfa": [...],
          "schemaTypes": [...],
          "prioritySchemas": {...}
        }`
      }
    }),
    
    // 2. Content Structure & Authority Signals
    app.scrapeUrl(url, {
      formats: ["extract"],
      extract: {
        prompt: `Extract content structure and authority signals:
        
        1. Headings hierarchy (H1-H6) with text content
        2. Authority signals: statistics, data points, expert quotes, citations
        3. Author information: bylines, credentials, bio
        4. Publication and update dates
        5. External reference links and citations
        6. Content quality metrics: word count, paragraph count, lists, tables, images
        
        Return as: {
          "headingsHierarchy": {"h1": [...], "h2": [...], ...},
          "authoritySignals": {
            "statistics": [...],
            "expertQuotes": [...],
            "authorInfo": {...},
            "citations": [...]
          },
          "contentQuality": {...}
        }`
      }
    }),
    
    // 3. Technical Accessibility for AI Crawlers
    app.scrapeUrl(url, {
      formats: ["extract"],
      extract: {
        prompt: `Extract technical accessibility and SEO elements:
        
        1. All meta tags: title, description, robots, canonical, hreflang
        2. Open Graph and Twitter Card tags
        3. Technical elements: HTTPS status, internal links
        4. Accessibility features: alt text count, ARIA labels, semantic HTML, skip links
        5. Mobile-friendliness indicators
        
        Return as: {
          "metaTags": {...},
          "technicalElements": {...},
          "accessibility": {...}
        }`
      }
    })
  ]);
  
  // Process and combine results
  const structuredData = (structuredDataResult as any).extract || {};
  const contentAnalysis = (contentAnalysisResult as any).extract || {};
  const technical = (technicalResult as any).extract || {};
  const metadata = (structuredDataResult as any).metadata || {};
  
  return {
    url,
    timestamp: new Date().toISOString(),
    
    structuredData: {
      jsonLd: structuredData.jsonLd || [],
      microdata: structuredData.microdata || [],
      rdfa: structuredData.rdfa || [],
      schemaTypes: structuredData.schemaTypes || [],
      prioritySchemas: structuredData.prioritySchemas || {}
    },
    
    contentStructure: {
      headingsHierarchy: contentAnalysis.headingsHierarchy || {
        h1: [], h2: [], h3: [], h4: [], h5: [], h6: []
      },
      authoritySignals: contentAnalysis.authoritySignals || {
        statistics: [],
        expertQuotes: [],
        authorInfo: {},
        citations: []
      },
      contentQuality: contentAnalysis.contentQuality || {}
    },
    
    technicalAccessibility: {
      metaTags: {
        title: metadata.title || technical.metaTags?.title,
        description: metadata.description || technical.metaTags?.description,
        robots: technical.metaTags?.robots,
        canonical: technical.metaTags?.canonical,
        hreflang: technical.metaTags?.hreflang || [],
        openGraph: {
          'og:title': metadata['og:title'] || '',
          'og:description': metadata['og:description'] || '',
          'og:image': metadata['og:image'] || '',
          'og:url': metadata['og:url'] || '',
          ...(technical.metaTags?.openGraph || {})
        },
        twitterCard: {
          'twitter:card': metadata['twitter:card'] || '',
          'twitter:title': metadata['twitter:title'] || '',
          'twitter:description': metadata['twitter:description'] || '',
          'twitter:image': metadata['twitter:image'] || '',
          ...(technical.metaTags?.twitterCard || {})
        }
      },
      technicalElements: {
        httpsStatus: url.startsWith('https://'),
        statusCode: metadata.statusCode || 0,
        contentType: metadata.contentType,
        responseTime: metadata.responseTime,
        mobileFriendly: technical.technicalElements?.mobileFriendly,
        internalLinks: technical.technicalElements?.internalLinks || []
      },
      accessibility: {
        altTextCount: technical.accessibility?.altTextCount || 0,
        ariaLabels: technical.accessibility?.ariaLabels || [],
        semanticElements: technical.accessibility?.semanticElements || [],
        skipLinks: technical.accessibility?.skipLinks || false
      }
    }
  };
}

/**
 * Save GEO technical results to output file
 */
async function saveGEOResults(data: GEOTechnicalResult): Promise<string> {
  const fs = await import('fs');
  const path = await import('path');
  
  const outputDir = 'output';
  const domain = new URL(data.url).hostname.replace(/\./g, '-');
  const filename = `geo-technical-${domain}-${Date.now()}.json`;
  const filepath = path.join(outputDir, filename);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  return filepath;
}

/**
 * Display GEO analysis results
 */
function displayGEOResults(data: GEOTechnicalResult): void {
  console.log('\n📊 GEO Technical Analysis Results');
  console.log('=' .repeat(80));
  console.log(`URL: ${data.url}`);
  console.log(`Analysis Time: ${data.timestamp}`);
  
  console.log('\n1️⃣ STRUCTURED DATA & SCHEMA MARKUP');
  console.log('-' .repeat(50));
  console.log(`JSON-LD Scripts Found: ${data.structuredData.jsonLd.length}`);
  console.log(`Microdata Elements: ${data.structuredData.microdata.length}`);
  console.log(`RDFa Elements: ${data.structuredData.rdfa.length}`);
  console.log(`Schema Types Identified: ${data.structuredData.schemaTypes.join(', ') || 'None'}`);
  
  if (data.structuredData.jsonLd.length > 0) {
    console.log('\n🔗 JSON-LD Data:');
    data.structuredData.jsonLd.forEach((jsonLd, index) => {
      console.log(`  ${index + 1}. ${JSON.stringify(jsonLd).substring(0, 100)}...`);
    });
  }
  
  console.log('\n2️⃣ CONTENT STRUCTURE & AUTHORITY SIGNALS');
  console.log('-' .repeat(50));
  const headings = data.contentStructure.headingsHierarchy;
  console.log(`H1 Tags: ${headings.h1.length} | H2 Tags: ${headings.h2.length} | H3 Tags: ${headings.h3.length}`);
  console.log(`Statistics Found: ${data.contentStructure.authoritySignals.statistics.length}`);
  console.log(`Expert Quotes: ${data.contentStructure.authoritySignals.expertQuotes.length}`);
  console.log(`Citations: ${data.contentStructure.authoritySignals.citations.length}`);
  
  if (headings.h1.length > 0) {
    console.log(`\n📝 Main Heading (H1): ${headings.h1[0]}`);
  }
  
  console.log('\n3️⃣ TECHNICAL ACCESSIBILITY FOR AI CRAWLERS');
  console.log('-' .repeat(50));
  const tech = data.technicalAccessibility;
  console.log(`HTTPS Status: ${tech.technicalElements.httpsStatus ? '✅' : '❌'}`);
  console.log(`Status Code: ${tech.technicalElements.statusCode}`);
  console.log(`Content Type: ${tech.technicalElements.contentType || 'Unknown'}`);
  console.log(`Alt Text Elements: ${tech.accessibility.altTextCount}`);
  console.log(`ARIA Labels: ${tech.accessibility.ariaLabels.length}`);
  console.log(`Semantic Elements: ${tech.accessibility.semanticElements.length}`);
  console.log(`Internal Links: ${tech.technicalElements.internalLinks.length}`);
  
  console.log('\n📋 Meta Tags:');
  console.log(`  Title: ${tech.metaTags.title || 'Missing'}`);
  console.log(`  Description: ${tech.metaTags.description ? 'Present' : 'Missing'}`);
  console.log(`  Robots: ${tech.metaTags.robots || 'Default'}`);
  console.log(`  Canonical: ${tech.metaTags.canonical || 'Not Set'}`);
  
  console.log('\n📱 Social Media Tags:');
  console.log(`  Open Graph Title: ${tech.metaTags.openGraph['og:title'] ? 'Present' : 'Missing'}`);
  console.log(`  Open Graph Image: ${tech.metaTags.openGraph['og:image'] ? 'Present' : 'Missing'}`);
  console.log(`  Twitter Card: ${tech.metaTags.twitterCard['twitter:card'] || 'Not Set'}`);
}

/**
 * Generate GEO recommendations based on analysis
 */
function generateGEORecommendations(data: GEOTechnicalResult): void {
  console.log('\n🎯 GEO OPTIMIZATION RECOMMENDATIONS');
  console.log('=' .repeat(80));
  
  const recommendations: string[] = [];
  
  // Structured Data Recommendations
  if (data.structuredData.jsonLd.length === 0) {
    recommendations.push('❗ CRITICAL: Add JSON-LD structured data for better AI understanding');
  }
  if (data.structuredData.schemaTypes.length === 0) {
    recommendations.push('❗ HIGH: Implement Schema.org markup (Organization, Article, etc.)');
  }
  
  // Content Authority Recommendations
  if (data.contentStructure.authoritySignals.statistics.length === 0) {
    recommendations.push('📊 Add statistics and data points to increase authority');
  }
  if (data.contentStructure.authoritySignals.citations.length === 0) {
    recommendations.push('📚 Include external citations and reference links');
  }
  
  // Technical Recommendations
  if (!data.technicalAccessibility.technicalElements.httpsStatus) {
    recommendations.push('🔒 CRITICAL: Enable HTTPS for security and trust signals');
  }
  if (!data.technicalAccessibility.metaTags.description) {
    recommendations.push('📝 CRITICAL: Add meta description for better AI summarization');
  }
  if (data.technicalAccessibility.accessibility.altTextCount === 0) {
    recommendations.push('🖼️ Add alt text to images for accessibility and AI understanding');
  }
  
  // Open Graph Recommendations
  if (!data.technicalAccessibility.metaTags.openGraph['og:image']) {
    recommendations.push('📷 Add Open Graph image for better social sharing');
  }
  
  if (recommendations.length === 0) {
    console.log('✅ Excellent! No critical GEO issues found.');
  } else {
    recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });
  }
}

/**
 * Main execution
 */
async function main() {
  const url = process.argv[2];
  
  if (!url) {
    console.log('❌ Error: URL is required');
    console.log('Usage: npx tsx src/geo-technical-scraper.ts <url>');
    console.log('Example: npx tsx src/geo-technical-scraper.ts https://firecrawl.dev');
    process.exit(1);
  }
  
  // Validate URL
  try {
    new URL(url);
  } catch (error) {
    console.log('❌ Error: Invalid URL format');
    console.log('Please provide a valid URL including http:// or https://');
    process.exit(1);
  }
  
  // Check API key
  if (!process.env.FIRECRAWL_API_KEY) {
    console.log('❌ Error: FIRECRAWL_API_KEY environment variable is required');
    console.log('💡 Set it with: export FIRECRAWL_API_KEY=fc-your-api-key');
    process.exit(1);
  }
  
  try {
    // Extract comprehensive GEO technical data
    const geoData = await extractGEOTechnicalData(url);
    
    // Display results
    displayGEOResults(geoData);
    
    // Generate recommendations
    generateGEORecommendations(geoData);
    
    // Save to file
    const filepath = await saveGEOResults(geoData);
    console.log(`\n💾 Complete GEO analysis saved to: ${filepath}`);
    console.log('\n✅ GEO Technical Analysis completed!');
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ GEO Analysis failed:', errorMessage);
    process.exit(1);
  }
}

// Run the GEO technical scraper
main(); 