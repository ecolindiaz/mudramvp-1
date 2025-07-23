#!/usr/bin/env node

/**
 * Schema Markup Extractor
 * 
 * Simple tool to extract schema markup and metadata from websites
 * Usage: npx tsx src/schema-extractor.ts <url>
 */

import { createFirecrawlApp } from './config/firecrawl-config.js';

interface SchemaMarkupResult {
  url: string;
  timestamp: string;
  metadata: {
    title?: string;
    description?: string;
    keywords?: string;
    'og:title'?: string;
    'og:description'?: string;
    'og:image'?: string;
    'og:url'?: string;
    'twitter:card'?: string;
    'twitter:title'?: string;
    'twitter:description'?: string;
    'twitter:image'?: string;
    statusCode?: number;
    contentType?: string;
  };
  structuredData: any[];
  jsonLd: any[];
  microdata: any[];
}

/**
 * Extract schema markup from a URL
 */
async function extractSchemaMarkup(url: string): Promise<SchemaMarkupResult> {
  const app = createFirecrawlApp();
  
  console.log(`🔍 Extracting schema markup from: ${url}`);
  
  const result = await app.scrapeUrl(url, {
    formats: ["extract"],
    extract: {
      prompt: "Extract all structured data from this page including JSON-LD scripts, microdata, RDFa, and Schema.org markup. Also extract all metadata, Open Graph tags, and Twitter Card data."
    }
  });
  
  if (!result.success) {
    throw new Error(`Failed to scrape: ${result.error}`);
  }
  
  // Extract metadata and structured data
  const extractedData = result.extract || {};
  const metadata = result.metadata || {};
  
  return {
    url,
    timestamp: new Date().toISOString(),
    metadata: {
      title: metadata.title,
      description: metadata.description,
      keywords: metadata.keywords,
      'og:title': metadata['og:title'],
      'og:description': metadata['og:description'],
      'og:image': metadata['og:image'],
      'og:url': metadata['og:url'],
      'twitter:card': metadata['twitter:card'],
      'twitter:title': metadata['twitter:title'],
      'twitter:description': metadata['twitter:description'],
      'twitter:image': metadata['twitter:image'],
      statusCode: metadata.statusCode,
      contentType: metadata.contentType
    },
    structuredData: extractedData,
    jsonLd: extractedData.jsonLd || [],
    microdata: extractedData.microdata || []
  };
}

/**
 * Save results to output file
 */
async function saveToOutput(data: SchemaMarkupResult): Promise<string> {
  const fs = await import('fs');
  const path = await import('path');
  
  const outputDir = 'output';
  const domain = new URL(data.url).hostname.replace(/\./g, '-');
  const filename = `schema-markup-${domain}-${Date.now()}.json`;
  const filepath = path.join(outputDir, filename);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  return filepath;
}

/**
 * Main execution
 */
async function main() {
  const url = process.argv[2];
  
  if (!url) {
    console.log('❌ Error: URL is required');
    console.log('Usage: npx tsx src/schema-extractor.ts <url>');
    console.log('Example: npx tsx src/schema-extractor.ts https://example.com');
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
    // Extract schema markup
    const schemaData = await extractSchemaMarkup(url);
    
    // Display results
    console.log('\n📊 Schema Markup Extraction Results');
    console.log('=' .repeat(60));
    console.log(`URL: ${schemaData.url}`);
    console.log(`Timestamp: ${schemaData.timestamp}`);
    
    console.log('\n📋 Metadata:');
    console.log('-' .repeat(30));
    Object.entries(schemaData.metadata).forEach(([key, value]) => {
      if (value) {
        console.log(`${key}: ${value}`);
      }
    });
    
    if (schemaData.jsonLd.length > 0) {
      console.log('\n🔗 JSON-LD Structured Data:');
      console.log('-' .repeat(30));
      console.log(JSON.stringify(schemaData.jsonLd, null, 2));
    }
    
    if (schemaData.structuredData.length > 0) {
      console.log('\n📦 Other Structured Data:');
      console.log('-' .repeat(30));
      console.log(JSON.stringify(schemaData.structuredData, null, 2));
    }
    
    if (schemaData.microdata.length > 0) {
      console.log('\n🏷️ Microdata:');
      console.log('-' .repeat(30));
      console.log(JSON.stringify(schemaData.microdata, null, 2));
    }
    
    // Save to file
    const filepath = await saveToOutput(schemaData);
    console.log(`\n💾 Results saved to: ${filepath}`);
    console.log('\n✅ Schema markup extraction completed!');
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Extraction failed:', errorMessage);
    process.exit(1);
  }
}

// Run the main function
main(); 