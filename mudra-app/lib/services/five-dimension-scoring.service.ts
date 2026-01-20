/**
 * Five-Dimension Scoring Service
 * 
 * Computes a comprehensive technical structure score for Answer Engine Optimization (AEO).
 * 
 * Dimensions:
 * 1. Structured Data Compliance (25%) - JSON-LD, Schema.org coverage
 * 2. Semantic HTML Quality (20%) - Proper use of semantic elements
 * 3. Content Citability (25%) - How easily AI can cite this content
 * 4. Technical Accessibility (15%) - Meta tags, canonical, hreflang
 * 5. Answer Engine Readiness (15%) - FAQ, How-To, direct answer formats
 */

import type {
  DOMExtractionResult,
  FiveDimensionScore,
  DimensionScore,
  ScoreBreakdown,
  ScoringIssue,
  ScoringRecommendation,
  DIMENSION_WEIGHTS,
  SCHEMA_IMPORTANCE,
} from '@/lib/types/site-scraping.types';

// Dimension weights (must sum to 1.0)
const WEIGHTS = {
  structuredData: 0.25,
  semanticHtml: 0.20,
  citability: 0.25,
  accessibility: 0.15,
  answerEngine: 0.15,
} as const;

// Schema importance for scoring
const SCHEMA_SCORES: Record<string, { points: number; description: string }> = {
  Organization: { points: 15, description: 'Brand identity and entity recognition' },
  WebSite: { points: 10, description: 'Site search and navigation signals' },
  Product: { points: 12, description: 'E-commerce and product discovery' },
  Service: { points: 12, description: 'Service offerings visibility' },
  Article: { points: 10, description: 'Content attribution and authorship' },
  BlogPosting: { points: 10, description: 'Blog content indexing' },
  FAQPage: { points: 18, description: 'Direct answer engine optimization' },
  BreadcrumbList: { points: 8, description: 'Navigation and site structure' },
  HowTo: { points: 12, description: 'Tutorial and instructional content' },
  SoftwareApplication: { points: 8, description: 'Software product discovery' },
  LocalBusiness: { points: 10, description: 'Local search visibility' },
  Person: { points: 5, description: 'Author and expert attribution' },
};

/**
 * Score Dimension 1: Structured Data Compliance
 */
function scoreStructuredData(extraction: DOMExtractionResult): DimensionScore {
  const { structuredData } = extraction;
  const breakdown: ScoreBreakdown[] = [];
  const issues: ScoringIssue[] = [];
  let totalScore = 0;
  
  // JSON-LD presence (20 points max)
  const validSchemas = structuredData.jsonLd.filter(s => s.isValid);
  const jsonLdScore = Math.min(20, validSchemas.length * 5);
  breakdown.push({
    name: 'JSON-LD Schemas',
    score: jsonLdScore,
    maxScore: 20,
    description: `${validSchemas.length} valid JSON-LD blocks found`,
  });
  totalScore += jsonLdScore;
  
  if (validSchemas.length === 0) {
    issues.push({
      dimension: 'structuredData',
      severity: 'major',
      code: 'NO_JSON_LD',
      title: 'No JSON-LD structured data',
      description: 'Page has no JSON-LD schema markup',
      impact: 'AI systems cannot understand page content structure',
    });
  }
  
  // Schema type coverage (50 points max)
  let schemaScore = 0;
  const foundSchemas: string[] = [];
  
  for (const [schemaType, config] of Object.entries(SCHEMA_SCORES)) {
    const hasSchema = structuredData.schemaTypes.some(t => 
      t.toLowerCase().includes(schemaType.toLowerCase())
    );
    
    if (hasSchema) {
      schemaScore += config.points;
      foundSchemas.push(schemaType);
    }
  }
  
  // Cap at 50 points
  const cappedSchemaScore = Math.min(50, schemaScore);
  breakdown.push({
    name: 'Schema Type Coverage',
    score: cappedSchemaScore,
    maxScore: 50,
    description: `Found: ${foundSchemas.join(', ') || 'None'}`,
  });
  totalScore += cappedSchemaScore;
  
  // Check for critical schemas
  if (!structuredData.hasOrganizationSchema) {
    issues.push({
      dimension: 'structuredData',
      severity: 'major',
      code: 'NO_ORG_SCHEMA',
      title: 'Missing Organization schema',
      description: 'Organization schema establishes brand identity for AI systems',
      impact: 'Reduced brand recognition in AI responses',
    });
  }
  
  // Schema validation (15 points max)
  const invalidSchemas = structuredData.jsonLd.filter(s => !s.isValid);
  const validationScore = invalidSchemas.length === 0 ? 15 : Math.max(0, 15 - invalidSchemas.length * 5);
  breakdown.push({
    name: 'Schema Validity',
    score: validationScore,
    maxScore: 15,
    description: invalidSchemas.length === 0 
      ? 'All schemas are valid' 
      : `${invalidSchemas.length} invalid schemas found`,
  });
  totalScore += validationScore;
  
  for (const invalid of invalidSchemas) {
    issues.push({
      dimension: 'structuredData',
      severity: 'critical',
      code: 'INVALID_SCHEMA',
      title: 'Invalid JSON-LD schema',
      description: `Schema validation failed: ${invalid.validationErrors?.join(', ')}`,
      impact: 'Search engines and AI will ignore invalid schemas',
      element: invalid.raw.substring(0, 100),
    });
  }
  
  // Microdata/RDFa bonus (15 points max)
  const additionalFormats = (structuredData.microdata.length > 0 ? 7 : 0) + 
                            (structuredData.rdfa.length > 0 ? 8 : 0);
  breakdown.push({
    name: 'Additional Formats',
    score: additionalFormats,
    maxScore: 15,
    description: `Microdata: ${structuredData.microdata.length}, RDFa: ${structuredData.rdfa.length}`,
  });
  totalScore += additionalFormats;
  
  return {
    score: Math.min(100, totalScore),
    weight: WEIGHTS.structuredData,
    breakdown,
    issues,
  };
}

/**
 * Score Dimension 2: Semantic HTML Quality
 */
function scoreSemanticHtml(extraction: DOMExtractionResult): DimensionScore {
  const { semanticElements, headings } = extraction;
  const breakdown: ScoreBreakdown[] = [];
  const issues: ScoringIssue[] = [];
  let totalScore = 0;
  
  // Semantic elements usage (30 points max)
  let semanticScore = 0;
  if (semanticElements.mainCount >= 1) semanticScore += 8;
  if (semanticElements.headerCount >= 1) semanticScore += 5;
  if (semanticElements.footerCount >= 1) semanticScore += 4;
  if (semanticElements.navCount >= 1) semanticScore += 5;
  if (semanticElements.articleCount >= 1) semanticScore += 8;
  
  breakdown.push({
    name: 'Semantic Elements',
    score: semanticScore,
    maxScore: 30,
    description: `main: ${semanticElements.mainCount}, article: ${semanticElements.articleCount}, nav: ${semanticElements.navCount}`,
  });
  totalScore += semanticScore;
  
  if (semanticElements.mainCount === 0) {
    issues.push({
      dimension: 'semanticHtml',
      severity: 'minor',
      code: 'NO_MAIN',
      title: 'Missing <main> element',
      description: 'The <main> element helps AI identify primary content',
      impact: 'AI may struggle to distinguish main content from navigation/footer',
    });
  }
  
  // Heading hierarchy (30 points max)
  let headingScore = 0;
  
  // H1 presence
  if (headings.h1.length === 1) {
    headingScore += 15;
  } else if (headings.h1.length > 1) {
    headingScore += 8;
    issues.push({
      dimension: 'semanticHtml',
      severity: 'minor',
      code: 'MULTIPLE_H1',
      title: 'Multiple H1 headings',
      description: `Found ${headings.h1.length} H1 tags (recommended: 1)`,
      impact: 'May confuse AI about the main topic of the page',
    });
  } else {
    issues.push({
      dimension: 'semanticHtml',
      severity: 'major',
      code: 'NO_H1',
      title: 'Missing H1 heading',
      description: 'Page has no H1 heading',
      impact: 'AI cannot identify the main topic of the page',
    });
  }
  
  // Logical hierarchy (no skipped levels)
  const hasSkippedLevels = headings.violations.some(v => v.type === 'skipped_level');
  if (!hasSkippedLevels && headings.totalHeadings > 0) {
    headingScore += 10;
  } else if (hasSkippedLevels) {
    issues.push({
      dimension: 'semanticHtml',
      severity: 'minor',
      code: 'SKIPPED_HEADING_LEVEL',
      title: 'Heading levels are skipped',
      description: 'Heading hierarchy jumps levels (e.g., H2 to H4)',
      impact: 'Reduces content structure clarity for AI parsing',
    });
  }
  
  // Good heading coverage
  if (headings.h2.length >= 2) headingScore += 5;
  
  breakdown.push({
    name: 'Heading Hierarchy',
    score: headingScore,
    maxScore: 30,
    description: `H1: ${headings.h1.length}, H2: ${headings.h2.length}, Total: ${headings.totalHeadings}`,
  });
  totalScore += headingScore;
  
  // Landmark roles & ARIA (20 points max)
  let ariaScore = 0;
  if (semanticElements.landmarkRoles.length >= 3) ariaScore += 10;
  else if (semanticElements.landmarkRoles.length >= 1) ariaScore += 5;
  
  if (semanticElements.ariaLabels.length >= 5) ariaScore += 10;
  else if (semanticElements.ariaLabels.length >= 2) ariaScore += 5;
  
  breakdown.push({
    name: 'ARIA & Landmarks',
    score: ariaScore,
    maxScore: 20,
    description: `Landmark roles: ${semanticElements.landmarkRoles.length}, ARIA labels: ${semanticElements.ariaLabels.length}`,
  });
  totalScore += ariaScore;
  
  // Article quality (20 points max)
  let articleScore = 0;
  if (semanticElements.articles.length > 0) {
    const hasAttribution = semanticElements.articles.some(a => a.hasAuthor || a.hasDatetime);
    if (hasAttribution) articleScore += 12;
    
    const avgWordCount = semanticElements.articles.reduce((sum, a) => sum + a.wordCount, 0) / 
                         semanticElements.articles.length;
    if (avgWordCount >= 300) articleScore += 8;
    else if (avgWordCount >= 100) articleScore += 4;
  }
  
  breakdown.push({
    name: 'Article Quality',
    score: articleScore,
    maxScore: 20,
    description: `${semanticElements.articles.length} articles, ${
      semanticElements.articles.filter(a => a.hasAuthor).length
    } with author attribution`,
  });
  totalScore += articleScore;
  
  return {
    score: Math.min(100, totalScore),
    weight: WEIGHTS.semanticHtml,
    breakdown,
    issues,
  };
}

/**
 * Score Dimension 3: Content Citability
 */
function scoreCitability(extraction: DOMExtractionResult): DimensionScore {
  const { metadata, headings, semanticElements, structuredData } = extraction;
  const breakdown: ScoreBreakdown[] = [];
  const issues: ScoringIssue[] = [];
  let totalScore = 0;
  
  // Clear title and description (25 points max)
  let metaScore = 0;
  if (metadata.title && metadata.title.length >= 10 && metadata.title.length <= 70) {
    metaScore += 12;
  } else if (metadata.title) {
    metaScore += 6;
  }
  
  if (metadata.description && metadata.description.length >= 50 && metadata.description.length <= 160) {
    metaScore += 13;
  } else if (metadata.description) {
    metaScore += 6;
  } else {
    issues.push({
      dimension: 'citability',
      severity: 'major',
      code: 'NO_DESCRIPTION',
      title: 'Missing meta description',
      description: 'Meta description helps AI understand and cite page content',
      impact: 'Reduced likelihood of being cited by AI systems',
    });
  }
  
  breakdown.push({
    name: 'Title & Description',
    score: metaScore,
    maxScore: 25,
    description: `Title: ${metadata.title?.length || 0} chars, Description: ${metadata.description?.length || 0} chars`,
  });
  totalScore += metaScore;
  
  // Canonical and unique content signals (15 points max)
  let canonicalScore = 0;
  if (metadata.canonical) canonicalScore += 10;
  else {
    issues.push({
      dimension: 'citability',
      severity: 'minor',
      code: 'NO_CANONICAL',
      title: 'Missing canonical URL',
      description: 'Canonical URL ensures AI cites the correct URL',
      impact: 'May cite incorrect or duplicate URLs',
    });
  }
  
  if (metadata.ogUrl) canonicalScore += 5;
  
  breakdown.push({
    name: 'Canonical Signals',
    score: canonicalScore,
    maxScore: 15,
    description: metadata.canonical ? 'Canonical URL defined' : 'No canonical URL',
  });
  totalScore += canonicalScore;
  
  // Author and source attribution (20 points max)
  let attributionScore = 0;
  
  // Check for author info in articles
  const articlesWithAuthor = semanticElements.articles.filter(a => a.hasAuthor).length;
  if (articlesWithAuthor > 0) attributionScore += 10;
  
  // Check for Person or Author schema
  const hasPersonSchema = structuredData.schemaTypes.some(t => 
    t.toLowerCase().includes('person') || t.toLowerCase().includes('author')
  );
  if (hasPersonSchema) attributionScore += 10;
  
  breakdown.push({
    name: 'Author Attribution',
    score: attributionScore,
    maxScore: 20,
    description: `${articlesWithAuthor} articles with author, Person schema: ${hasPersonSchema ? 'Yes' : 'No'}`,
  });
  totalScore += attributionScore;
  
  // Content structure for excerpts (25 points max)
  let excerptScore = 0;
  
  // Has good heading structure
  if (headings.h1.length === 1 && headings.h2.length >= 2) {
    excerptScore += 10;
  }
  
  // Has article with substantial content
  const substantialArticle = semanticElements.articles.find(a => a.wordCount >= 200);
  if (substantialArticle) excerptScore += 10;
  
  // Has proper paragraph structure
  if (semanticElements.articles.some(a => a.paragraphCount >= 3)) {
    excerptScore += 5;
  }
  
  breakdown.push({
    name: 'Excerpt Structure',
    score: excerptScore,
    maxScore: 25,
    description: 'Content is well-structured for AI excerpts',
  });
  totalScore += excerptScore;
  
  // Organization/brand clarity (15 points max)
  let brandScore = 0;
  if (structuredData.hasOrganizationSchema) brandScore += 10;
  if (metadata.ogSiteName) brandScore += 5;
  
  breakdown.push({
    name: 'Brand Clarity',
    score: brandScore,
    maxScore: 15,
    description: `Organization schema: ${structuredData.hasOrganizationSchema ? 'Yes' : 'No'}`,
  });
  totalScore += brandScore;
  
  return {
    score: Math.min(100, totalScore),
    weight: WEIGHTS.citability,
    breakdown,
    issues,
  };
}

/**
 * Score Dimension 4: Technical Accessibility
 */
function scoreAccessibility(extraction: DOMExtractionResult): DimensionScore {
  const { metadata, structuredData, semanticElements } = extraction;
  const breakdown: ScoreBreakdown[] = [];
  const issues: ScoringIssue[] = [];
  let totalScore = 0;
  
  // Meta tags completeness (30 points max)
  let metaScore = 0;
  if (metadata.title) metaScore += 8;
  if (metadata.description) metaScore += 8;
  if (metadata.viewport) metaScore += 5;
  if (metadata.charset) metaScore += 5;
  if (metadata.robots) metaScore += 4;
  
  breakdown.push({
    name: 'Meta Tags',
    score: metaScore,
    maxScore: 30,
    description: `Title, description, viewport, charset presence`,
  });
  totalScore += metaScore;
  
  // Open Graph completeness (20 points max)
  let ogScore = 0;
  if (metadata.ogTitle) ogScore += 5;
  if (metadata.ogDescription) ogScore += 5;
  if (metadata.ogImage) ogScore += 5;
  if (metadata.ogType) ogScore += 3;
  if (metadata.ogUrl) ogScore += 2;
  
  breakdown.push({
    name: 'Open Graph',
    score: ogScore,
    maxScore: 20,
    description: `OG tags: title=${!!metadata.ogTitle}, desc=${!!metadata.ogDescription}, image=${!!metadata.ogImage}`,
  });
  totalScore += ogScore;
  
  if (ogScore < 10) {
    issues.push({
      dimension: 'accessibility',
      severity: 'minor',
      code: 'INCOMPLETE_OG',
      title: 'Incomplete Open Graph tags',
      description: 'Missing key Open Graph tags for social sharing',
      impact: 'Poor appearance when shared on social platforms',
    });
  }
  
  // Twitter Card (15 points max)
  let twitterScore = 0;
  if (metadata.twitterCard) twitterScore += 5;
  if (metadata.twitterTitle) twitterScore += 4;
  if (metadata.twitterDescription) twitterScore += 3;
  if (metadata.twitterImage) twitterScore += 3;
  
  breakdown.push({
    name: 'Twitter Card',
    score: twitterScore,
    maxScore: 15,
    description: `Twitter card: ${metadata.twitterCard || 'not set'}`,
  });
  totalScore += twitterScore;
  
  // Internationalization (15 points max)
  let i18nScore = 0;
  if (metadata.hreflang && metadata.hreflang.length > 0) {
    i18nScore += 10;
    if (metadata.hreflang.includes('x-default')) i18nScore += 5;
  }
  
  breakdown.push({
    name: 'Internationalization',
    score: i18nScore,
    maxScore: 15,
    description: `Hreflang: ${metadata.hreflang?.length || 0} languages`,
  });
  totalScore += i18nScore;
  
  // Navigation schema (20 points max)
  let navScore = 0;
  if (structuredData.hasBreadcrumbSchema) navScore += 12;
  if (structuredData.hasWebSiteSchema) navScore += 8;
  
  breakdown.push({
    name: 'Navigation Schema',
    score: navScore,
    maxScore: 20,
    description: `Breadcrumb: ${structuredData.hasBreadcrumbSchema ? 'Yes' : 'No'}, WebSite: ${structuredData.hasWebSiteSchema ? 'Yes' : 'No'}`,
  });
  totalScore += navScore;
  
  return {
    score: Math.min(100, totalScore),
    weight: WEIGHTS.accessibility,
    breakdown,
    issues,
  };
}

/**
 * Score Dimension 5: Answer Engine Readiness
 */
function scoreAnswerEngine(extraction: DOMExtractionResult): DimensionScore {
  const { faqContent, structuredData, headings, metadata } = extraction;
  const breakdown: ScoreBreakdown[] = [];
  const issues: ScoringIssue[] = [];
  let totalScore = 0;
  
  // FAQ content and schema (35 points max)
  let faqScore = 0;
  
  if (faqContent.hasSchemaFAQ) {
    faqScore += 20;
  }
  
  if (faqContent.merged.length > 0) {
    faqScore += Math.min(10, faqContent.merged.length * 2);
    
    if (faqContent.hasHTMLFAQ && !faqContent.hasSchemaFAQ) {
      issues.push({
        dimension: 'answerEngine',
        severity: 'major',
        code: 'FAQ_NO_SCHEMA',
        title: 'FAQ content without schema',
        description: `Found ${faqContent.merged.length} FAQ items but no FAQPage schema`,
        impact: 'FAQ content won\'t appear in rich results or AI answers',
      });
    }
  }
  
  // Bonus for comprehensive FAQs
  if (faqContent.merged.length >= 5) faqScore += 5;
  
  breakdown.push({
    name: 'FAQ Optimization',
    score: Math.min(35, faqScore),
    maxScore: 35,
    description: `${faqContent.merged.length} FAQs, Schema: ${faqContent.hasSchemaFAQ ? 'Yes' : 'No'}`,
  });
  totalScore += Math.min(35, faqScore);
  
  // HowTo schema (15 points max)
  let howToScore = 0;
  if (structuredData.hasHowToSchema) {
    howToScore += 15;
  }
  
  breakdown.push({
    name: 'HowTo Schema',
    score: howToScore,
    maxScore: 15,
    description: structuredData.hasHowToSchema ? 'HowTo schema present' : 'No HowTo schema',
  });
  totalScore += howToScore;
  
  // Direct answer formatting (25 points max)
  let answerScore = 0;
  
  // Questions in headings (indicates Q&A format)
  const questionHeadings = [...headings.h2, ...headings.h3].filter(
    h => h.text.includes('?') || /^(how|what|why|when|where|who|which|can|is|are)/i.test(h.text)
  );
  if (questionHeadings.length >= 3) answerScore += 10;
  else if (questionHeadings.length >= 1) answerScore += 5;
  
  // Clear definition-style content
  const hasDefinition = metadata.description && 
    /^[A-Z][\w\s]+\s(is|are|refers to|means)\s/i.test(metadata.description);
  if (hasDefinition) answerScore += 10;
  
  // Lists and structured content
  if (headings.h2.length >= 3 && headings.h3.length >= 5) {
    answerScore += 5;
  }
  
  breakdown.push({
    name: 'Direct Answer Format',
    score: answerScore,
    maxScore: 25,
    description: `${questionHeadings.length} question headings`,
  });
  totalScore += answerScore;
  
  // SpeakableSpecification and SearchAction (15 points max)
  let advancedScore = 0;
  
  const hasSearchAction = structuredData.jsonLd.some(s => {
    const str = JSON.stringify(s.parsed);
    return str.includes('SearchAction') || str.includes('potentialAction');
  });
  if (hasSearchAction) advancedScore += 8;
  
  const hasSpeakable = structuredData.jsonLd.some(s => {
    const str = JSON.stringify(s.parsed);
    return str.includes('speakable') || str.includes('SpeakableSpecification');
  });
  if (hasSpeakable) advancedScore += 7;
  
  breakdown.push({
    name: 'Advanced Features',
    score: advancedScore,
    maxScore: 15,
    description: `SearchAction: ${hasSearchAction ? 'Yes' : 'No'}, Speakable: ${hasSpeakable ? 'Yes' : 'No'}`,
  });
  totalScore += advancedScore;
  
  // Article/BlogPosting for content pages (10 points max)
  let contentScore = 0;
  if (structuredData.hasArticleSchema || structuredData.hasBlogPostingSchema) {
    contentScore += 10;
  }
  
  breakdown.push({
    name: 'Content Schema',
    score: contentScore,
    maxScore: 10,
    description: `Article: ${structuredData.hasArticleSchema}, BlogPosting: ${structuredData.hasBlogPostingSchema}`,
  });
  totalScore += contentScore;
  
  return {
    score: Math.min(100, totalScore),
    weight: WEIGHTS.answerEngine,
    breakdown,
    issues,
  };
}

/**
 * Generate recommendations based on scores and issues
 */
function generateRecommendations(
  structuredData: DimensionScore,
  semanticHtml: DimensionScore,
  citability: DimensionScore,
  accessibility: DimensionScore,
  answerEngine: DimensionScore
): ScoringRecommendation[] {
  const recommendations: ScoringRecommendation[] = [];
  
  // Structured data recommendations
  if (structuredData.score < 50) {
    recommendations.push({
      dimension: 'structuredData',
      priority: 'high',
      title: 'Add JSON-LD structured data',
      description: 'Implement JSON-LD schema markup to help AI systems understand your content',
      implementation: 'Add Organization, WebSite, and page-specific schemas (Article, Product, FAQ, etc.)',
      estimatedImpact: 30,
      difficulty: 'medium',
    });
  }
  
  if (structuredData.issues.some(i => i.code === 'NO_ORG_SCHEMA')) {
    recommendations.push({
      dimension: 'structuredData',
      priority: 'high',
      title: 'Add Organization schema',
      description: 'Organization schema establishes your brand identity for AI systems',
      implementation: 'Add a JSON-LD block with @type: "Organization" including name, url, logo, and sameAs links',
      estimatedImpact: 15,
      difficulty: 'easy',
    });
  }
  
  // Semantic HTML recommendations
  if (semanticHtml.issues.some(i => i.code === 'NO_H1')) {
    recommendations.push({
      dimension: 'semanticHtml',
      priority: 'high',
      title: 'Add an H1 heading',
      description: 'Every page should have exactly one H1 that describes the main topic',
      implementation: 'Add a clear, descriptive H1 heading at the top of your main content',
      estimatedImpact: 10,
      difficulty: 'easy',
    });
  }
  
  if (semanticHtml.score < 60) {
    recommendations.push({
      dimension: 'semanticHtml',
      priority: 'medium',
      title: 'Improve semantic HTML structure',
      description: 'Use semantic HTML5 elements to improve content structure',
      implementation: 'Wrap content in <main>, use <article> for standalone content, <nav> for navigation',
      estimatedImpact: 15,
      difficulty: 'medium',
    });
  }
  
  // Citability recommendations
  if (citability.issues.some(i => i.code === 'NO_DESCRIPTION')) {
    recommendations.push({
      dimension: 'citability',
      priority: 'high',
      title: 'Add meta description',
      description: 'Meta descriptions help AI systems understand and cite your content',
      implementation: 'Add a 120-160 character meta description summarizing the page content',
      estimatedImpact: 12,
      difficulty: 'easy',
    });
  }
  
  if (citability.issues.some(i => i.code === 'NO_CANONICAL')) {
    recommendations.push({
      dimension: 'citability',
      priority: 'medium',
      title: 'Add canonical URL',
      description: 'Canonical URLs ensure AI systems cite the correct URL',
      implementation: 'Add <link rel="canonical" href="..."> pointing to the preferred URL',
      estimatedImpact: 5,
      difficulty: 'easy',
    });
  }
  
  // Accessibility recommendations
  if (accessibility.score < 50) {
    recommendations.push({
      dimension: 'accessibility',
      priority: 'medium',
      title: 'Complete Open Graph tags',
      description: 'Open Graph tags improve how your content appears when shared',
      implementation: 'Add og:title, og:description, og:image, and og:url meta tags',
      estimatedImpact: 8,
      difficulty: 'easy',
    });
  }
  
  // Answer engine recommendations
  if (answerEngine.issues.some(i => i.code === 'FAQ_NO_SCHEMA')) {
    recommendations.push({
      dimension: 'answerEngine',
      priority: 'high',
      title: 'Add FAQPage schema',
      description: 'You have FAQ content that should be marked up with FAQPage schema',
      implementation: 'Add JSON-LD FAQPage schema wrapping your existing FAQ questions and answers',
      estimatedImpact: 18,
      difficulty: 'easy',
    });
  }
  
  if (answerEngine.score < 40) {
    recommendations.push({
      dimension: 'answerEngine',
      priority: 'medium',
      title: 'Add FAQ content',
      description: 'FAQ content is highly valued by answer engines',
      implementation: 'Add a FAQ section with common questions about your product/service, marked up with FAQPage schema',
      estimatedImpact: 20,
      difficulty: 'medium',
    });
  }
  
  // Sort by estimated impact descending
  recommendations.sort((a, b) => b.estimatedImpact - a.estimatedImpact);
  
  return recommendations;
}

/**
 * Main function to compute five-dimension score
 */
export function computeFiveDimensionScore(extraction: DOMExtractionResult): FiveDimensionScore {
  // Score each dimension
  const structuredData = scoreStructuredData(extraction);
  const semanticHtml = scoreSemanticHtml(extraction);
  const citability = scoreCitability(extraction);
  const accessibility = scoreAccessibility(extraction);
  const answerEngine = scoreAnswerEngine(extraction);
  
  // Calculate weighted overall score
  const overall = 
    structuredData.score * WEIGHTS.structuredData +
    semanticHtml.score * WEIGHTS.semanticHtml +
    citability.score * WEIGHTS.citability +
    accessibility.score * WEIGHTS.accessibility +
    answerEngine.score * WEIGHTS.answerEngine;
  
  // Collect all issues
  const issues = [
    ...structuredData.issues,
    ...semanticHtml.issues,
    ...citability.issues,
    ...accessibility.issues,
    ...answerEngine.issues,
  ];
  
  // Generate recommendations
  const recommendations = generateRecommendations(
    structuredData,
    semanticHtml,
    citability,
    accessibility,
    answerEngine
  );
  
  return {
    overall: Math.round(overall * 10) / 10,
    structuredData,
    semanticHtml,
    citability,
    accessibility,
    answerEngine,
    issues,
    recommendations,
  };
}

/**
 * Get score grade based on overall score
 */
export function getScoreGrade(score: number): {
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  label: string;
  color: string;
} {
  if (score >= 90) return { grade: 'A', label: 'Excellent', color: 'green' };
  if (score >= 75) return { grade: 'B', label: 'Good', color: 'lime' };
  if (score >= 60) return { grade: 'C', label: 'Average', color: 'yellow' };
  if (score >= 40) return { grade: 'D', label: 'Needs Work', color: 'orange' };
  return { grade: 'F', label: 'Poor', color: 'red' };
}

/**
 * Get dimension name for display
 */
export function getDimensionDisplayName(dimension: string): string {
  const names: Record<string, string> = {
    structuredData: 'Structured Data',
    semanticHtml: 'Semantic HTML',
    citability: 'Content Citability',
    accessibility: 'Technical Accessibility',
    answerEngine: 'Answer Engine Readiness',
  };
  return names[dimension] || dimension;
}
