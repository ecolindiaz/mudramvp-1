import * as dotenv from 'dotenv';
import FirecrawlApp from '@mendable/firecrawl-js';

// Load environment variables
dotenv.config();

/**
 * Firecrawl configuration interface
 */
export interface FirecrawlConfig {
  apiKey: string;
  apiUrl?: string;
}

/**
 * Valid Firecrawl formats
 */
export type FirecrawlFormat = 
  | "markdown" 
  | "html" 
  | "rawHtml" 
  | "content" 
  | "links" 
  | "screenshot" 
  | "screenshot@fullPage" 
  | "extract" 
  | "json" 
  | "compare";

/**
 * Scraping options interface
 */
export interface ScrapeOptions {
  formats?: FirecrawlFormat[];
  onlyMainContent?: boolean;
  timeout?: number;
  waitFor?: number;
  jsonOptions?: {
    schema?: any;
    prompt?: string;
    systemPrompt?: string;
  };
}

/**
 * Scrape result interface
 */
export interface ScrapeResult {
  success: boolean;
  data?: {
    json?: any;
    metadata?: {
      title?: string;
      description?: string;
      sourceURL?: string;
    };
  };
  error?: string;
}

/**
 * Initialize Firecrawl App with API key from environment
 */
export function createFirecrawlApp(): FirecrawlApp {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  
  if (!apiKey) {
    throw new Error(
      'FIRECRAWL_API_KEY is required. Please set it in your .env file or environment variables.'
    );
  }

  const config: FirecrawlConfig = {
    apiKey: apiKey,
    // Optional: Custom API URL if using self-hosted Firecrawl
    ...(process.env.FIRECRAWL_API_URL && { apiUrl: process.env.FIRECRAWL_API_URL })
  };

  return new FirecrawlApp(config);
}

/**
 * Default scraping options
 */
export const defaultScrapeOptions: ScrapeOptions = {
  formats: ["json" as FirecrawlFormat],
  onlyMainContent: false,
  timeout: 120000
};

/**
 * Common error handler for Firecrawl operations
 */
export function handleFirecrawlError(error: Error, operation: string = 'scrape'): never {
  console.error(`❌ Firecrawl ${operation} failed:`, error.message);
  
  if (error.message.includes('API key')) {
    console.error('💡 Make sure your FIRECRAWL_API_KEY is set correctly in your .env file');
  } else if (error.message.includes('timeout')) {
    console.error('💡 Try increasing the timeout value or check if the URL is accessible');
  } else if (error.message.includes('rate limit')) {
    console.error('💡 You have hit the rate limit. Please wait before making more requests');
  }
  
  throw error;
} 