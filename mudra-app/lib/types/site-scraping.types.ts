/**
 * Site-Wide Scraping & Scoring Types
 * 
 * Types for the comprehensive technical structure analysis system
 * that scrapes all pages, parses DOM, and computes four-dimension scores.
 */

// ============================================
// Policy File Detection Types
// ============================================

export interface PolicyFileResult {
  domain: string;
  robots: {
    exists: boolean;
    url: string;
    content?: string;
    sitemapUrls?: string[];
    crawlDirectives?: CrawlDirective[];
  };
  sitemap: {
    exists: boolean;
    url: string;
    pageCount?: number;
  };
  llmsTxt: {
    exists: boolean;
    url: string;
    content?: string;
  };
  llmsFullTxt: {
    exists: boolean;
    url: string;
    content?: string;
  };
  checkedAt: Date;
}

export interface CrawlDirective {
  userAgent: string;
  allow: string[];
  disallow: string[];
}

// ============================================
// Sitemap Discovery Types
// ============================================

export interface HreflangAlternate {
  hreflang: string;         // e.g. "en", "es", "x-default"
  href: string;             // Full URL of the alternate
}

export interface SitemapEntry {
  loc: string;              // Page URL
  lastmod?: string;         // Last modification date
  changefreq?: string;      // Change frequency
  priority?: number;        // Priority (0.0-1.0)
  alternates?: HreflangAlternate[]; // xhtml:link hreflang alternates
}

export interface SitemapDiscoveryResult {
  domain: string;
  sitemapUrl: string;
  entries: SitemapEntry[];
  totalPages: number;
  pageTypes: Record<PageType, number>;
  discoveredAt: Date;
}

export type PageType = 
  | 'main'
  | 'features'
  | 'product'
  | 'service'
  | 'solutions'
  | 'blog'
  | 'pricing'
  | 'use-cases'
  | 'docs'
  | 'about'
  | 'contact'
  | 'other';

// ============================================
// DOM Extraction Types
// ============================================

export interface DOMExtractionResult {
  // Meta tags
  metadata: MetadataExtraction;
  
  // Heading hierarchy
  headings: HeadingHierarchy;
  
  // Semantic HTML elements
  semanticElements: SemanticElementsExtraction;
  
  // Structured data (JSON-LD, Microdata, RDFa)
  structuredData: StructuredDataExtraction;
  
  // FAQ content
  faqContent: FAQExtraction;
  
  // Validation results
  validation: ValidationResult[];
}

export interface MetadataExtraction {
  title?: string;
  description?: string;
  robots?: string;
  canonical?: string;
  hreflang?: string[];
  viewport?: string;
  charset?: string;
  
  // Open Graph
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogUrl?: string;
  ogType?: string;
  ogSiteName?: string;
  
  // Twitter Card
  twitterCard?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  twitterSite?: string;
  
  // Link relations
  linkCanonical?: string;
  linkAlternates?: Array<{ href: string; hreflang?: string; type?: string }>;
}

export interface HeadingHierarchy {
  h1: HeadingInfo[];
  h2: HeadingInfo[];
  h3: HeadingInfo[];
  h4: HeadingInfo[];
  h5: HeadingInfo[];
  h6: HeadingInfo[];
  totalHeadings: number;
  violations: HeadingViolation[];
}

export interface HeadingInfo {
  text: string;
  position: number;       // DOM position order
  id?: string;            // Element ID if present
  className?: string;     // Classes for context
}

export interface HeadingViolation {
  type: 'multiple_h1' | 'skipped_level' | 'empty_heading' | 'too_long';
  message: string;
  position?: number;
  level?: number;
}

export interface SemanticElementsExtraction {
  // Semantic section counts
  articleCount: number;
  sectionCount: number;
  navCount: number;
  asideCount: number;
  headerCount: number;
  footerCount: number;
  mainCount: number;
  
  // Article content (primary citation candidates)
  articles: ArticleContent[];
  
  // Landmark roles
  landmarkRoles: string[];
  
  // ARIA labels
  ariaLabels: string[];
  
  // Semantic score components
  hasProperStructure: boolean;
  semanticScore: number;
}

export interface ArticleContent {
  position: number;
  headings: string[];
  paragraphCount: number;
  wordCount: number;
  hasDatetime?: boolean;
  hasAuthor?: boolean;
}

export interface StructuredDataExtraction {
  jsonLd: JSONLDSchema[];
  microdata: MicrodataItem[];
  rdfa: RDFaItem[];
  
  // Schema summary
  schemaTypes: string[];
  schemaValidation: SchemaValidationResult[];
  
  // Specific schema presence
  hasOrganizationSchema: boolean;
  hasWebSiteSchema: boolean;
  hasProductSchema: boolean;
  hasServiceSchema: boolean;
  hasArticleSchema: boolean;
  hasBlogPostingSchema: boolean;
  hasFAQPageSchema: boolean;
  hasBreadcrumbSchema: boolean;
  hasHowToSchema: boolean;
  hasSoftwareApplicationSchema: boolean;
}

export interface JSONLDSchema {
  type: string | string[];
  graph?: JSONLDSchema[];
  raw: string;
  parsed: any;
  isValid: boolean;
  validationErrors?: string[];
}

export interface MicrodataItem {
  type: string;
  properties: string[];
  position: number;
}

export interface RDFaItem {
  typeof: string;
  property?: string;
  content?: string;
}

export interface SchemaValidationResult {
  schemaType: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface FAQExtraction {
  // FAQ sources
  fromSchema: FAQItem[];      // From JSON-LD FAQPage schema
  fromDetails: FAQItem[];     // From <details>/<summary> elements
  fromPatterns: FAQItem[];    // From Q:/A: text patterns
  
  // Merged & deduplicated
  merged: FAQItem[];
  
  // Summary
  totalUnique: number;
  hasSchemaFAQ: boolean;
  hasHTMLFAQ: boolean;
}

export interface FAQItem {
  question: string;
  answer: string;
  source: 'json-ld' | 'details-summary' | 'pattern' | 'heading-pattern';
  questionLength: number;
  answerLength: number;
}

export interface ValidationResult {
  category: 'metadata' | 'headings' | 'schema' | 'semantic' | 'faq';
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  element?: string;
  suggestion?: string;
}

// ============================================
// Four-Dimension Scoring Types
// ============================================

export interface FourDimensionScore {
  overall: number;          // 0-100
  
  // Dimension 1: Structured Data Compliance
  structuredData: DimensionScore;
  
  // Dimension 2: Semantic HTML Quality
  semanticHtml: DimensionScore;
  
  // Dimension 3: Content Citability
  citability: DimensionScore;
  
  // Dimension 4: Technical Accessibility
  accessibility: DimensionScore;
  
  // Dimension 5: Answer Engine Readiness
  answerEngine: DimensionScore;
  
  // Aggregate issues and recommendations
  issues: ScoringIssue[];
  recommendations: ScoringRecommendation[];
}

export interface DimensionScore {
  score: number;            // 0-100
  weight: number;           // Weight in overall score (0-1, sum = 1)
  breakdown: ScoreBreakdown[];
  issues: ScoringIssue[];
}

export interface ScoreBreakdown {
  name: string;
  score: number;
  maxScore: number;
  description: string;
}

export interface ScoringIssue {
  dimension: string;
  severity: 'critical' | 'major' | 'minor' | 'info';
  code: string;
  title: string;
  description: string;
  impact: string;
  element?: string;
}

export interface ScoringRecommendation {
  dimension: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  implementation: string;
  estimatedImpact: number;  // Score improvement estimate
  difficulty: 'easy' | 'medium' | 'hard';
}

// ============================================
// Scoring Weights & Configuration
// ============================================

export const DIMENSION_WEIGHTS = {
  structuredData: 0.25,     // 25%
  semanticHtml: 0.20,       // 20%
  citability: 0.25,         // 25%
  accessibility: 0.15,      // 15%
  answerEngine: 0.15,       // 15%
} as const;

export const SCHEMA_IMPORTANCE = {
  Organization: { weight: 15, description: 'Brand identity and entity recognition' },
  WebSite: { weight: 10, description: 'Site search and navigation signals' },
  Product: { weight: 12, description: 'E-commerce and product discovery' },
  Service: { weight: 12, description: 'Service offerings and local SEO' },
  Article: { weight: 8, description: 'Content attribution and authorship' },
  BlogPosting: { weight: 8, description: 'Blog content and freshness' },
  FAQPage: { weight: 15, description: 'Direct answer engine optimization' },
  BreadcrumbList: { weight: 10, description: 'Navigation and site structure' },
  HowTo: { weight: 5, description: 'Tutorial and instructional content' },
  SoftwareApplication: { weight: 5, description: 'Software product discovery' },
} as const;

// ============================================
// Site-Wide Aggregation Types
// ============================================

export interface SiteWideScore {
  domain: string;
  overall: number;
  
  // Dimension averages across all pages
  dimensions: {
    structuredData: number;
    semanticHtml: number;
    citability: number;
    accessibility: number;
    answerEngine: number;
  };
  
  // Page statistics
  stats: {
    totalPages: number;
    pagesScraped: number;
    pagesScored: number;
    pagesWithIssues: number;
  };
  
  // Schema coverage across site
  schemaCoverage: SchemaCoverage;
  
  // Top issues site-wide
  topIssues: AggregatedIssue[];
  
  // Score by page type
  scoreByPageType: Record<PageType, PageTypeScore>;
  
  // Historical comparison
  previousScore?: number;
  scoreChange?: number;
  
  computedAt: Date;
}

export interface SchemaCoverage {
  // Percentage of pages with each schema type
  Organization: number;
  WebSite: number;
  Product: number;
  Service: number;
  Article: number;
  BlogPosting: number;
  FAQPage: number;
  BreadcrumbList: number;
  HowTo: number;
  SoftwareApplication: number;
  
  // Coverage summary
  averageSchemasPerPage: number;
  pagesWithNoSchema: number;
  pagesWithSchema: number;
}

export interface AggregatedIssue {
  code: string;
  title: string;
  dimension: string;
  severity: 'critical' | 'major' | 'minor' | 'info';
  affectedPages: number;
  percentage: number;
  exampleUrls: string[];
}

export interface PageTypeScore {
  pageType: PageType;
  pageCount: number;
  averageScore: number;
  structuredDataScore: number;
  semanticHtmlScore: number;
  citabilityScore: number;
  accessibilityScore: number;
  answerEngineScore: number;
}

// ============================================
// Scrape Job Types
// ============================================

export interface ScrapeJobConfig {
  maxPages?: number;
  includePatterns?: string[];
  excludePatterns?: string[];
  respectRobotsTxt?: boolean;
  concurrency?: number;
  delayMs?: number;
  timeout?: number;
}

export interface ScrapeJobProgress {
  jobId: string;
  status: ScrapeJobStatus;
  totalPages: number;
  pagesScraped: number;
  pagesScored: number;
  pagesFailed: number;
  currentPage?: string;
  estimatedTimeRemaining?: number;
  errors: ScrapeError[];
}

export type ScrapeJobStatus = 
  | 'pending'
  | 'policy_check'
  | 'sitemap_discovery'
  | 'scraping'
  | 'scoring'
  | 'completed'
  | 'failed';

export interface ScrapeError {
  pageUrl: string;
  error: string;
  code?: string;
  timestamp: Date;
}

// ============================================
// Page Snapshot Types
// ============================================

export interface PageSnapshotInput {
  brandProfileId: number;
  sitemapPageId: string;
  pageUrl: string;
  htmlContent: string;
  httpStatusCode?: number;
  contentType?: string;
  scrapeDurationMs?: number;
}

export interface PageSnapshotOutput {
  id: string;
  version: number;
  pageUrl: string;
  extraction: DOMExtractionResult;
  score: FourDimensionScore;
  scrapedAt: Date;
}
