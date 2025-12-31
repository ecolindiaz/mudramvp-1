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

// Format type labels for prompts
const FORMAT_LABELS: Record<string, string> = {
  blog: "blog post",
  listicle: "listicle",
  howto: "how-to guide",
  guide: "comprehensive guide",
}

/**
 * Get the combined system prompt for content generation
 * @param mode - The generation mode (geo, seo, or general)
 * @param type - The content format (blog, listicle, howto, guide)
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
  
  // Get format label
  const formatLabel = FORMAT_LABELS[type] || "blog post"
  
  // Format-specific instructions
  let formatInstructions = ""
  if (type === "listicle") {
    formatInstructions = "\nFormat Requirements:\n- Use numbered or bulleted lists\n- Each item should be substantial (2-3 sentences minimum)\n- Include engaging subheadings for each list item\n- Start with an introduction explaining why the list matters\n- End with a conclusion that ties everything together"
  } else if (type === "howto") {
    formatInstructions = "\nFormat Requirements:\n- Step-by-step instructions that are easy to follow\n- Clear action items for each step\n- Include prerequisites or materials needed\n- Add troubleshooting tips where relevant\n- Use imperative voice (e.g., 'Click the button', 'Navigate to...')"
  } else if (type === "guide") {
    formatInstructions = "\nFormat Requirements:\n- Comprehensive, in-depth coverage of the topic\n- Multiple sections covering different aspects\n- Include examples, case studies, and real-world applications\n- Provide actionable insights and best practices\n- Use clear hierarchical structure (H2, H3 headings)"
  } else {
    // blog format
    formatInstructions = "\nFormat Requirements:\n- Engaging introduction that hooks the reader\n- Well-structured body with clear sections\n- Mix of narrative, examples, and actionable insights\n- Strong conclusion that summarizes key points"
  }
  
  // Base system prompt based on mode
  let basePrompt = ''
  
  if (mode === 'geo') {
    basePrompt = `You are an expert content writer specializing in Generative Engine Optimization (GEO).

Create a ${formatLabel} optimized for AI recommendations and citations.

Target Prompt/Query: ${prompt || "Not specified"}
Target ICP/Audience: ${icp || "General audience"}

Requirements for GEO optimization:
- Clear, authoritative information that AI engines can cite
- Well-structured with clear headings and sections
- Include specific examples, statistics, and actionable steps
- Use natural language that answers common questions
- Add credible sources and references where appropriate
- Write in a confident, helpful tone
- Focus on providing genuine value and expertise${formatInstructions}

Title: ${title || "Generate an engaging title based on the content"}

Generate comprehensive, citation-worthy content (800-1200 words).`
  } else if (mode === 'seo') {
    basePrompt = `You are an expert content writer specializing in Search Engine Optimization (SEO).

Create a ${formatLabel} optimized for search engines.

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
- Include FAQ-style content where appropriate${formatInstructions}

Generate SEO-optimized, comprehensive content (1000-1500 words).`
  } else {
    basePrompt = `You are an expert content writer.

Create a high-quality ${formatLabel}.

Topic: ${title || "Generate an engaging title"}
${prompt ? `Context: ${prompt}` : ""}
${icp ? `Target Audience: ${icp}` : ""}
${keyword ? `Key Focus: ${keyword}` : ""}${formatInstructions}

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
