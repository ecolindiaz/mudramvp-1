import OpenAI from 'openai'
import type { EnhancedGEOResult } from '../scrapers/enhanced-geo-scraper'

export interface AIGeneratedTask {
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  estimatedTime: string
  difficulty: 'easy' | 'medium' | 'hard'
  category: string
  impact: 'high' | 'medium' | 'low'
  steps: Array<{
    title: string
    description: string
    estimatedTime: string
  }>
  resources: Array<{
    title: string
    url: string
    type: 'documentation' | 'tool' | 'guide'
  }>
}

export async function generateAITasks(
  geoResults: EnhancedGEOResult,
  companyContext?: string
): Promise<AIGeneratedTask[]> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('OpenAI API key not found, using fallback tasks')
    return fallbackTasks(geoResults)
  }

  const openai = new OpenAI({ 
    apiKey: process.env.OPENAI_API_KEY 
  })

  // Create detailed analysis summary for AI
  const analysisDetails = {
    scores: geoResults.geoScore,
    structuredData: {
      jsonLdCount: geoResults.structuredData.jsonLd.length,
      schemaTypes: geoResults.structuredData.schemaTypes,
      hasOrganizationSchema: !!geoResults.structuredData.organizationSchema,
      hasWebsiteSchema: !!geoResults.structuredData.websiteSchema,
      hasBreadcrumbSchema: !!geoResults.structuredData.breadcrumbSchema,
      hasFAQSchema: geoResults.structuredData.faqSchemas.length > 0,
      microdataCount: geoResults.structuredData.microdata.length
    },
    entities: {
      organizations: geoResults.entityRecognition.organizations,
      people: geoResults.entityRecognition.people,
      technologies: geoResults.entityRecognition.technologies,
      products: geoResults.entityRecognition.products,
      locations: geoResults.entityRecognition.locations
    },
    faq: {
      sectionsFound: geoResults.faqOptimization.faqSections.length,
      questionAnswerPairs: geoResults.faqOptimization.questionAnswerPairs,
      hasStructuredData: geoResults.faqOptimization.faqStructuredData
    },
    contentStructure: {
      headings: geoResults.contentStructure.headingsHierarchy,
      authoritySignals: geoResults.contentStructure.authoritySignals,
      contentQuality: geoResults.contentStructure.contentQuality
    },
    technical: {
      metaTags: geoResults.technicalAccessibility.metaTags,
      technicalElements: geoResults.technicalAccessibility.technicalElements,
      accessibility: geoResults.technicalAccessibility.accessibility
    },
    freshness: geoResults.contentFreshness
  }

  const prompt = `
You are an expert in Generative Engine Optimization (GEO) - optimizing websites to be mentioned by AI models like ChatGPT, Claude, Perplexity, and Gemini.

Analyze this comprehensive website audit and generate exactly 5 highly specific, actionable tasks to improve AI visibility.

WEBSITE: ${geoResults.url}
${companyContext ? `COMPANY CONTEXT: ${companyContext}` : ''}

=== AUDIT SCORES ===
- Overall Score: ${geoResults.geoScore.overall}/100
- Content Authority: ${geoResults.geoScore.contentAuthority}/100  
- Technical Accessibility: ${geoResults.geoScore.technicalAccessibility}/100
- Structured Data: ${geoResults.geoScore.structuredData}/100
- Entity Recognition: ${geoResults.geoScore.entityRecognition}/100
- FAQ Optimization: ${geoResults.geoScore.faqOptimization}/100
- Content Freshness: ${geoResults.geoScore.contentFreshness}/100

=== DETAILED FINDINGS ===

STRUCTURED DATA ANALYSIS:
- JSON-LD Scripts Found: ${analysisDetails.structuredData.jsonLdCount}
- Schema Types: ${analysisDetails.structuredData.schemaTypes.join(', ') || 'None detected'}
- Organization Schema: ${analysisDetails.structuredData.hasOrganizationSchema ? '✅ Present' : '❌ Missing'}
- Website Schema: ${analysisDetails.structuredData.hasWebsiteSchema ? '✅ Present' : '❌ Missing'}
- FAQ Schema: ${analysisDetails.structuredData.hasFAQSchema ? '✅ Present' : '❌ Missing'}
- Breadcrumb Schema: ${analysisDetails.structuredData.hasBreadcrumbSchema ? '✅ Present' : '❌ Missing'}

ENTITY RECOGNITION:
- Organizations: ${analysisDetails.entities.organizations.slice(0, 5).join(', ') || 'None detected'}
- People: ${analysisDetails.entities.people.slice(0, 5).join(', ') || 'None detected'}
- Technologies: ${analysisDetails.entities.technologies.slice(0, 5).join(', ') || 'None detected'}
- Products: ${analysisDetails.entities.products.slice(0, 5).join(', ') || 'None detected'}
- Locations: ${analysisDetails.entities.locations.slice(0, 5).join(', ') || 'None detected'}

FAQ & Q&A OPTIMIZATION:
- FAQ Sections Found: ${analysisDetails.faq.sectionsFound}
- Question-Answer Pairs: ${analysisDetails.faq.questionAnswerPairs}
- FAQ Structured Data: ${analysisDetails.faq.hasStructuredData ? '✅ Implemented' : '❌ Missing'}

CONTENT STRUCTURE:
- H1 Tags: ${analysisDetails.contentStructure.headings.h1?.length || 0} found
- H2 Tags: ${analysisDetails.contentStructure.headings.h2?.length || 0} found
- Statistics Found: ${analysisDetails.contentStructure.authoritySignals?.statistics?.length || 0}
- Expert Quotes: ${analysisDetails.contentStructure.authoritySignals?.expertQuotes?.length || 0}
- Citations: ${analysisDetails.contentStructure.authoritySignals?.citations?.length || 0}
- Word Count: ${analysisDetails.contentStructure.contentQuality?.wordCount || 'Unknown'}

TECHNICAL ACCESSIBILITY:
- Page Title: ${analysisDetails.technical.metaTags?.title ? `"${analysisDetails.technical.metaTags.title.substring(0, 60)}..."` : '❌ Missing'}
- Meta Description: ${analysisDetails.technical.metaTags?.description ? `"${analysisDetails.technical.metaTags.description.substring(0, 80)}..."` : '❌ Missing'}
- HTTPS Status: ${analysisDetails.technical.technicalElements?.httpsStatus ? '✅ Enabled' : '❌ Not Enabled'}
- Response Time: ${analysisDetails.technical.technicalElements?.responseTime ? `${analysisDetails.technical.technicalElements.responseTime}ms` : 'Unknown'}
- Alt Text Count: ${analysisDetails.technical.accessibility?.altTextCount || 0}

CONTENT FRESHNESS:
- Publish Date: ${analysisDetails.freshness?.publishDate || 'Not detected'}
- Last Modified: ${analysisDetails.freshness?.lastModified || 'Not detected'}
- Freshness Signals: ${analysisDetails.freshness?.freshnessSignals?.length || 0} found

=== TASK GENERATION REQUIREMENTS ===

Generate 5 tasks that:
1. Address the SPECIFIC gaps found in the analysis above
2. Focus on the lowest scoring areas first (scores below 70 = high priority)
3. Provide DETAILED, step-by-step implementation instructions
4. Include specific code examples, tools, and exact implementation details
5. Explain WHY each task improves AI model visibility and citation likelihood

For each task, be extremely specific about:
- What exact files to create/modify
- What specific content to add (with examples)
- Which tools to use and how
- How to test the implementation
- Expected impact on AI model recognition

Prioritize tasks based on:
- Critical (scores 0-50): Immediate blockers for AI recognition
- High (scores 51-70): Major improvements needed
- Medium (scores 71-85): Optimization opportunities

[{
  "title": "Specific task title based on actual findings",
  "description": "Clear description of what this task achieves for AI visibility, referencing specific gaps found",
  "priority": "high|medium|low",
  "estimatedTime": "X-Y hours",
  "difficulty": "easy|medium|hard", 
  "category": "Structured Data|Technical SEO|Content Authority|Entity Recognition|FAQ Optimization|Content Freshness",
  "impact": "high|medium|low",
  "steps": [
    {
      "title": "Step name", 
      "description": "VERY detailed implementation instructions with specific examples, code snippets, and exact actions to take. Reference the specific findings from the audit.",
      "estimatedTime": "X hours"
    }
  ],
  "resources": [
    {"title": "Resource name", "url": "https://actual-working-url.com", "type": "documentation|tool|guide"}
  ]
}]

CRITICAL INSTRUCTIONS:
1. Return ONLY the JSON array, no explanations or additional text
2. Do not include any text before or after the JSON array
3. Do not wrap the response in markdown code blocks
4. Start your response immediately with [ and end with ]
5. Base each task on the ACTUAL audit findings above
6. Make each step extremely detailed with specific implementation instructions

RESPONSE FORMAT: Start immediately with the JSON array:
[{...}]
`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2, // Lower temperature for more consistent JSON output
      max_tokens: 6000  // Increased for detailed tasks
    })

    const content = response.choices[0].message.content
    if (!content) {
      throw new Error('No content received from OpenAI')
    }

    console.log('🤖 Raw AI response length:', content.length)
    console.log('🤖 AI response preview:', content.substring(0, 200) + '...')

    // More robust JSON extraction
    let cleanContent = content.trim()
    
    // Remove markdown code blocks
    cleanContent = cleanContent.replace(/```json\s*/g, '').replace(/```\s*/g, '')
    
    // Find JSON array in the response
    const jsonStartIndex = cleanContent.indexOf('[')
    const jsonEndIndex = cleanContent.lastIndexOf(']')
    
    if (jsonStartIndex === -1 || jsonEndIndex === -1) {
      console.log('❌ No JSON array found in response')
      throw new Error('No valid JSON array found in AI response')
    }
    
    const jsonContent = cleanContent.substring(jsonStartIndex, jsonEndIndex + 1)
    console.log('🔍 Extracted JSON preview:', jsonContent.substring(0, 200) + '...')
    
    const tasks = JSON.parse(jsonContent)
    
    // Validate the response has the expected structure
    if (!Array.isArray(tasks) || tasks.length === 0) {
      throw new Error('Invalid response structure from AI')
    }

    // Validate each task has required fields
    const validTasks = tasks.filter(task => {
      return task && 
             typeof task.title === 'string' && 
             typeof task.description === 'string' &&
             Array.isArray(task.steps) &&
             task.steps.length > 0
    })

    if (validTasks.length === 0) {
      throw new Error('No valid tasks found in AI response')
    }

    console.log(`✅ Successfully parsed ${validTasks.length} valid tasks from AI`)
    return validTasks.slice(0, 5) // Ensure max 5 tasks
  } catch (error) {
    console.error('Failed to generate AI tasks:', error)
    console.log('Falling back to rule-based tasks')
    return fallbackTasks(geoResults)
  }
}

function fallbackTasks(geoResults: EnhancedGEOResult): AIGeneratedTask[] {
  const tasks: AIGeneratedTask[] = []
  
  // Analyze actual audit findings for detailed recommendations
  const analysisData = {
    hasOrgSchema: !!geoResults.structuredData.organizationSchema,
    hasWebsiteSchema: !!geoResults.structuredData.websiteSchema,
    hasFAQSchema: geoResults.structuredData.faqSchemas.length > 0,
    jsonLdCount: geoResults.structuredData.jsonLd.length,
    schemaTypes: geoResults.structuredData.schemaTypes,
    faqSections: geoResults.faqOptimization.faqSections.length,
    questionAnswerPairs: geoResults.faqOptimization.questionAnswerPairs,
    hasTitle: !!geoResults.technicalAccessibility.metaTags?.title,
    hasDescription: !!geoResults.technicalAccessibility.metaTags?.description,
    hasHTTPS: geoResults.technicalAccessibility.technicalElements?.httpsStatus,
    responseTime: geoResults.technicalAccessibility.technicalElements?.responseTime,
    altTextCount: geoResults.technicalAccessibility.accessibility?.altTextCount || 0,
    statsCount: geoResults.contentStructure.authoritySignals?.statistics?.length || 0,
    citationsCount: geoResults.contentStructure.authoritySignals?.citations?.length || 0,
    organizationsFound: geoResults.entityRecognition.organizations,
    technologiesFound: geoResults.entityRecognition.technologies,
    h1Count: geoResults.contentStructure.headingsHierarchy?.h1?.length || 0,
    wordCount: geoResults.contentStructure.contentQuality?.wordCount
  }

  // Get the lowest scoring areas to prioritize
  const scores = [
    { name: 'Structured Data', score: geoResults.geoScore.structuredData, data: analysisData },
    { name: 'Technical Accessibility', score: geoResults.geoScore.technicalAccessibility, data: analysisData },
    { name: 'Content Authority', score: geoResults.geoScore.contentAuthority, data: analysisData },
    { name: 'Entity Recognition', score: geoResults.geoScore.entityRecognition, data: analysisData },
    { name: 'FAQ Optimization', score: geoResults.geoScore.faqOptimization, data: analysisData },
    { name: 'Content Freshness', score: geoResults.geoScore.contentFreshness, data: analysisData }
  ].sort((a, b) => a.score - b.score)

  // Generate detailed tasks based on specific findings
  for (let i = 0; i < Math.min(5, scores.length); i++) {
    const area = scores[i]
    
    if (area.name === 'Structured Data' && area.score < 70) {
      // Determine specific schema gaps
      const missingSchemas = []
      if (!analysisData.hasOrgSchema) missingSchemas.push('Organization')
      if (!analysisData.hasWebsiteSchema) missingSchemas.push('Website')
      if (!analysisData.hasFAQSchema && analysisData.faqSections > 0) missingSchemas.push('FAQ')
      
      tasks.push({
        title: `Implement ${missingSchemas.length > 0 ? missingSchemas.join(' & ') + ' Schema' : 'Enhanced Schema'} Markup`,
        description: `Your site has ${analysisData.jsonLdCount} JSON-LD scripts but is missing critical ${missingSchemas.join(', ')} schema markup. Adding these will help AI models like ChatGPT and Perplexity better understand and cite your business.`,
        priority: area.score < 50 ? 'high' : 'medium',
        estimatedTime: `${3 + missingSchemas.length}–${5 + missingSchemas.length} hours`,
        difficulty: 'medium',
        category: 'Structured Data',
        impact: 'high',
        steps: [
          ...(!analysisData.hasOrgSchema ? [{ 
            title: 'Add Organization Schema to Homepage', 
            description: `Create a JSON-LD script in your <head> section with Organization schema. Include: company name, logo URL, contact info, social media profiles, and business type. Example code:
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Your Company Name",
  "url": "${geoResults.url}",
  "logo": "${geoResults.url}/logo.png",
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+1-XXX-XXX-XXXX",
    "contactType": "customer service"
  }
}
</script>
This helps AI models understand your business identity and increases citation likelihood by 40%.`, 
            estimatedTime: '2 hours' 
          }] : []),
          ...(!analysisData.hasWebsiteSchema ? [{ 
            title: 'Implement Website Schema with Search Action', 
            description: `Add WebSite schema to enable AI models to understand your site structure and search functionality. Place this JSON-LD in your homepage <head>:
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Your Site Name",
  "url": "${geoResults.url}",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "${geoResults.url}/search?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}
</script>
This improves AI model navigation understanding by 35%.`, 
            estimatedTime: '1.5 hours' 
          }] : []),
          ...(!analysisData.hasFAQSchema && analysisData.faqSections > 0 ? [{ 
            title: 'Add FAQ Schema to Existing FAQ Content', 
            description: `Your site has ${analysisData.faqSections} FAQ section(s) but lacks structured data. Add FAQPage schema to make this content discoverable by AI. For each FAQ section, wrap with:
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "Your question text",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Your detailed answer"
    }
  }]
}
</script>
This makes your FAQ content 60% more likely to be cited by AI chatbots.`, 
            estimatedTime: '2 hours' 
          }] : []),
          { 
            title: 'Validate and Test Schema Implementation', 
            description: `Use Google's Rich Results Test (search.google.com/test/rich-results) and Schema Markup Validator (validator.schema.org) to verify all schemas are properly implemented. Test each page with schema markup and fix any validation errors. Also test with the Perplexity.ai search to see if your content appears more prominently.`, 
            estimatedTime: '1 hour' 
          }
        ],
        resources: [
          { title: 'Schema.org Organization Documentation', url: 'https://schema.org/Organization', type: 'documentation' },
          { title: 'Google Rich Results Test', url: 'https://search.google.com/test/rich-results', type: 'tool' },
          { title: 'Schema Markup Validator', url: 'https://validator.schema.org', type: 'tool' }
        ]
      })
    }
    
    if (area.name === 'FAQ Optimization' && area.score < 70) {
      const needsSchema = analysisData.faqSections > 0 && !analysisData.hasFAQSchema
      const needsContent = analysisData.faqSections === 0
      
      tasks.push({
        title: needsContent ? 'Create Comprehensive AI-Optimized FAQ Section' : 'Add FAQ Schema to Existing Content',
        description: needsContent 
          ? `Your site has no FAQ sections detected. AI models like ChatGPT and Claude heavily favor sites with comprehensive Q&A content. Creating detailed FAQs increases AI citation probability by 65%.`
          : `Found ${analysisData.faqSections} FAQ section(s) with ${analysisData.questionAnswerPairs} Q&A pairs, but missing structured data markup. Adding FAQ schema will make this content 60% more discoverable by AI.`,
        priority: area.score < 50 ? 'high' : 'medium',
        estimatedTime: needsContent ? '6-8 hours' : '3-4 hours',
        difficulty: 'easy',
        category: 'FAQ Optimization',
        impact: 'high',
        steps: needsContent ? [
          { 
            title: 'Research Industry-Specific Questions', 
            description: `Use AnswerThePublic.com, AlsoAsked.com, and Google's "People also ask" for your industry keywords. Target questions that mention your detected technologies: ${analysisData.technologiesFound.slice(0, 3).join(', ')}. Create a list of 15-20 frequently asked questions. Focus on "how", "what", "why", and "when" questions as these are most queried by AI users.`, 
            estimatedTime: '2 hours' 
          },
          { 
            title: 'Write Comprehensive, Citation-Worthy Answers', 
            description: `Create detailed answers (200-400 words each) that directly address each question. Include specific data, examples, and step-by-step instructions. Use natural language that matches how people ask AI assistants. Reference your organization (${analysisData.organizationsFound.slice(0, 1).join('')}) where relevant to build entity association.`, 
            estimatedTime: '3 hours' 
          },
          { 
            title: 'Implement FAQ Schema Markup', 
            description: `Add FAQPage structured data to make content discoverable by AI. Use this format for each Q&A pair and place in your page <head> or before closing </body> tag. This structured data increases AI model citation likelihood by 60%.`, 
            estimatedTime: '1.5 hours' 
          }
        ] : [
          { 
            title: 'Audit Existing FAQ Content Quality', 
            description: `Review your ${analysisData.faqSections} FAQ section(s) for completeness and AI-friendly formatting. Ensure answers are detailed (200+ words), use natural language, and include specific examples. Update any outdated information and add relevant keywords that AI models associate with your industry.`, 
            estimatedTime: '1.5 hours' 
          },
          { 
            title: 'Implement FAQ Schema for All Q&A Content', 
            description: `Add FAQPage structured data to each page with FAQ content. Use this JSON-LD format in your <head> section or before </body>. This makes your existing FAQ content 60% more likely to be cited by AI chatbots and appear in Perplexity search results.`, 
            estimatedTime: '2 hours' 
          }
        ],
        resources: [
          { title: 'FAQ Schema Implementation Guide', url: 'https://developers.google.com/search/docs/appearance/structured-data/faqpage', type: 'guide' },
          { title: 'AnswerThePublic Question Research', url: 'https://answerthepublic.com', type: 'tool' },
          { title: 'AlsoAsked Question Finder', url: 'https://alsoasked.com', type: 'tool' }
        ]
      })
    }
    
    if (area.name === 'Technical Accessibility' && area.score < 70) {
      const issues = []
      if (!analysisData.hasTitle) issues.push('missing title tag')
      if (!analysisData.hasDescription) issues.push('missing meta description')
      if (!analysisData.hasHTTPS) issues.push('no HTTPS')
      if (analysisData.responseTime && analysisData.responseTime > 2000) issues.push(`slow loading (${analysisData.responseTime}ms)`)
      if (analysisData.altTextCount === 0) issues.push('no alt text on images')
      
      tasks.push({
        title: 'Fix Critical Technical Issues Blocking AI Crawlers',
        description: `Detected ${issues.length} critical technical issues: ${issues.join(', ')}. These prevent AI crawlers from properly accessing and indexing your content, reducing citation probability by up to 70%.`,
        priority: area.score < 50 ? 'high' : 'medium',
        estimatedTime: '3-5 hours',
        difficulty: 'medium',
        category: 'Technical SEO',
        impact: 'high',
        steps: [
          ...(!analysisData.hasTitle ? [{ 
            title: 'Add Optimized Page Title Tag', 
            description: `Your page is missing a title tag, which is critical for AI understanding. Add a descriptive 50-60 character title to your <head> section: <title>Your Company - Brief Description | Industry</title>. This single change can improve AI citation likelihood by 45%.`, 
            estimatedTime: '30 minutes' 
          }] : []),
          ...(!analysisData.hasDescription ? [{ 
            title: 'Create Compelling Meta Description', 
            description: `Add a 150-160 character meta description that summarizes your page content: <meta name="description" content="Brief summary of what your company does and key benefits">. AI models use this to understand page context and determine citation relevance.`, 
            estimatedTime: '30 minutes' 
          }] : []),
          ...(!analysisData.hasHTTPS ? [{ 
            title: 'Enable HTTPS Security', 
            description: `Your site is not using HTTPS, which many AI crawlers require for security. Contact your hosting provider to install an SSL certificate and redirect all HTTP traffic to HTTPS. This is mandatory for AI crawler access.`, 
            estimatedTime: '2 hours' 
          }] : []),
          ...(analysisData.responseTime && analysisData.responseTime > 2000 ? [{ 
            title: 'Optimize Page Loading Speed', 
            description: `Your page loads in ${analysisData.responseTime}ms (target: <2000ms). Optimize images using WebP format, minify CSS/JS files, and enable gzip compression. Use PageSpeed Insights to identify specific issues. Faster sites are 40% more likely to be crawled by AI.`, 
            estimatedTime: '2-3 hours' 
          }] : []),
          ...(analysisData.altTextCount === 0 ? [{ 
            title: 'Add Alt Text to All Images', 
            description: `Found ${analysisData.altTextCount} images with alt text. Add descriptive alt attributes to all images to help AI understand visual content: <img src="image.jpg" alt="Descriptive text about image content">. This improves content understanding by 25%.`, 
            estimatedTime: '1 hour' 
          }] : [])
        ],
        resources: [
          { title: 'Google Search Console', url: 'https://search.google.com/search-console', type: 'tool' },
          { title: 'PageSpeed Insights', url: 'https://pagespeed.web.dev', type: 'tool' },
          { title: 'SSL Certificate Guide', url: 'https://developers.google.com/search/docs/crawling-indexing/https', type: 'guide' }
        ]
      })
    }
    
    if (area.name === 'Content Authority' && area.score < 70) {
      tasks.push({
        title: 'Build Content Authority Signals for AI Trust',
        description: `Your content has ${analysisData.statsCount} statistics and ${analysisData.citationsCount} citations. AI models heavily weight authoritative signals when deciding what to cite. Adding credibility indicators can increase citation likelihood by 55%.`,
        priority: area.score < 50 ? 'high' : 'medium',
        estimatedTime: '4-6 hours',
        difficulty: 'medium',
        category: 'Content Authority',
        impact: 'medium',
        steps: [
          { 
            title: 'Add Industry Statistics and Data Points', 
            description: `Research and add 5-10 relevant industry statistics to your content. Cite reputable sources like research firms, government data, or industry reports. Format as: "According to [Source], [statistic]." Include publication dates and link to original sources. AI models prefer content with recent, verifiable data.`, 
            estimatedTime: '2 hours' 
          },
          { 
            title: 'Include Expert Quotes and Testimonials', 
            description: `Add quotes from industry experts, customer testimonials, or case study results. Include the person's title, company, and credentials. Example: "John Smith, CTO at TechCorp, says..." This builds E-A-T (Expertise, Authoritativeness, Trustworthiness) that AI models prioritize.`, 
            estimatedTime: '1.5 hours' 
          },
          { 
            title: 'Create Author Bio with Credentials', 
            description: `Add a detailed author section with credentials, experience, and contact information. Include: education, years of experience, relevant certifications, and social media profiles. Link to the author's LinkedIn or professional profile. This builds personal authority that AI models recognize.`, 
            estimatedTime: '1 hour' 
          },
          { 
            title: 'Link to Authoritative External Sources', 
            description: `Add 3-5 outbound links to authoritative sources in your industry (research papers, government sites, well-known industry publications). This shows AI models that you're connected to the broader knowledge ecosystem and increases your content's trustworthiness score.`, 
            estimatedTime: '1 hour' 
          }
        ],
        resources: [
          { title: 'Google E-E-A-T Guidelines', url: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content', type: 'guide' },
          { title: 'Schema.org Person Markup', url: 'https://schema.org/Person', type: 'documentation' },
          { title: 'Industry Statistics Sources', url: 'https://www.statista.com', type: 'tool' }
        ]
      })
    }
    
    if (area.name === 'Entity Recognition' && area.score < 70) {
      tasks.push({
        title: 'Improve AI Entity Recognition and Knowledge Graph Signals',
        description: `Found ${analysisData.organizationsFound.length} organization mentions and ${analysisData.technologiesFound.length} technology references. Strengthening entity recognition helps AI models understand your business context and increases citation accuracy by 40%.`,
        priority: area.score < 50 ? 'high' : 'low',
        estimatedTime: '3-4 hours',
        difficulty: 'easy',
        category: 'Entity Recognition',
        impact: 'medium',
        steps: [
          { 
            title: 'Optimize Brand Name Consistency', 
            description: `Ensure your company name appears consistently throughout the site. Use the exact same formatting each time: "${analysisData.organizationsFound[0] || 'Your Company Name'}". Add it to page titles, headings, and key content sections. Consistent entity mentions improve AI model recognition by 30%.`, 
            estimatedTime: '1 hour' 
          },
          { 
            title: 'Add Clear Business Category and Location Information', 
            description: `Add specific industry categorization and location details to your content. Include phrases like "based in [City, State]" and "specializing in [specific industry]". This helps AI models understand your business context and improves local citation accuracy.`, 
            estimatedTime: '1.5 hours' 
          },
          { 
            title: 'Reference Industry Technologies and Partnerships', 
            description: `Clearly mention the technologies you use: ${analysisData.technologiesFound.slice(0, 3).join(', ')}. Add a "Technology Stack" or "Partners" section. Reference well-known companies or technologies you work with. This builds entity relationships that AI models use for context.`, 
            estimatedTime: '1 hour' 
          },
          { 
            title: 'Link to Authority Profiles and Mentions', 
            description: `Add links to your company profiles on LinkedIn, Crunchbase, or industry directories. Include links to press mentions or news articles about your company. This creates entity validation signals that AI models use to verify business legitimacy.`, 
            estimatedTime: '30 minutes' 
          }
        ],
        resources: [
          { title: 'Google Knowledge Graph Search', url: 'https://developers.google.com/knowledge-graph', type: 'documentation' },
          { title: 'Wikidata Entity Database', url: 'https://www.wikidata.org', type: 'tool' },
          { title: 'LinkedIn Company Pages', url: 'https://business.linkedin.com/marketing-solutions/company-pages', type: 'guide' }
        ]
      })
    }
  }
  
  return tasks.slice(0, 5)
}