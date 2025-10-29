import fs from 'fs'
import path from 'path'

/**
 * Load system prompts from the prompts directory
 * @returns Object containing content quality and structure prompts
 */
export function loadSystemPrompts(): { contentQuality: string; contentStructure: string } {
  try {
    const promptsDir = path.join(process.cwd(), 'lib', 'prompts')
    
    // Load Content Quality prompt
    const contentQualityPath = path.join(promptsDir, 'content-quality.txt')
    const contentQuality = fs.readFileSync(contentQualityPath, 'utf-8')
    
    // Load Content Structure prompt
    const contentStructurePath = path.join(promptsDir, 'content-structure.txt')
    const contentStructure = fs.readFileSync(contentStructurePath, 'utf-8')
    
    return {
      contentQuality,
      contentStructure
    }
  } catch (error) {
    console.error('Error loading system prompts:', error)
    // Return fallback prompts if files can't be loaded
    return {
      contentQuality: 'You are an expert content writer focused on creating high-quality, citable content for AI systems.',
      contentStructure: 'You are an expert content writer focused on creating well-structured, easily quotable content.'
    }
  }
}

/**
 * Get the combined system prompt for content generation
 * @param mode - The generation mode (geo, seo, or general)
 * @param type - The content type (blog, newsletter, case)
 * @param prompt - The user's prompt/query
 * @param icp - The ideal customer profile
 * @param keyword - The target keyword (for SEO)
 * @param title - The content title
 * @returns Combined system prompt string
 */
export function getCombinedSystemPrompt(
  mode: string,
  type: string,
  prompt?: string,
  icp?: string,
  keyword?: string,
  title?: string
): string {
  const { contentQuality, contentStructure } = loadSystemPrompts()
  
  // Base system prompt based on mode
  let basePrompt = ''
  
  if (mode === 'geo') {
    basePrompt = `You are an expert content writer specializing in Generative Engine Optimization (GEO).

Create a ${type} post optimized for AI recommendations and citations.

Target Prompt/Query: ${prompt || "Not specified"}
Target ICP/Audience: ${icp || "General audience"}

Requirements for GEO optimization:
- Clear, authoritative information that AI engines can cite
- Well-structured with clear headings and sections
- Include specific examples, statistics, and actionable steps
- Use natural language that answers common questions
- Add credible sources and references where appropriate
- Write in a confident, helpful tone
- Focus on providing genuine value and expertise

Title: ${title || "Generate an engaging title based on the content"}

Generate comprehensive, citation-worthy content (800-1200 words).`
  } else if (mode === 'seo') {
    basePrompt = `You are an expert SEO content writer.

Create a ${type} post optimized for search engines.

Target Keyword: ${keyword || "Not specified"}
Topic: ${title || "Generate a keyword-rich title"}

Requirements for SEO optimization:
- Natural use of target keyword throughout
- Clear H2 and H3 heading structure
- Include related keywords and semantic variations
- Write for user intent while satisfying search algorithms
- Include meta-worthy introduction (first 160 chars should work as meta description)
- Use bullet points and lists for scannability
- Internal linking opportunities (mention [link] where relevant)
- Include FAQ-style content where appropriate

Generate SEO-optimized, comprehensive content (1000-1500 words).`
  } else {
    basePrompt = `You are an expert content writer.

Create a high-quality ${type} post.

Topic: ${title || "Generate an engaging title"}
${prompt ? `Context: ${prompt}` : ""}
${icp ? `Target Audience: ${icp}` : ""}
${keyword ? `Key Focus: ${keyword}` : ""}

Create well-structured, engaging content with:
- Compelling introduction
- Clear sections with headings
- Actionable insights
- Specific examples
- Strong conclusion

Generate comprehensive content (800-1200 words).`
  }
  
  // Combine base prompt with system prompts
  return `${basePrompt}

${contentQuality}

${contentStructure}

CRITICAL: Follow both the Content Quality and Content Structure guidelines above. These are essential for creating content that AI systems can easily cite and quote.`
}
