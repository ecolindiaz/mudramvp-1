/**
 * Count real words in markdown content, stripping syntax, code blocks,
 * URLs, emails, and formatting before counting.
 */
export function countWordsInMarkdown(content: string): number {
  if (!content || content.trim().length === 0) return 0

  // Remove code blocks (```code```)
  let text = content.replace(/```[\s\S]*?```/g, '')

  // Remove inline code (`code`)
  text = text.replace(/`[^`]+`/g, '')

  // Remove markdown links [text](url) but keep the text
  text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')

  // Remove markdown images ![alt](url)
  text = text.replace(/!\[([^\]]*)\]\([^\)]+\)/g, '')

  // Remove markdown headers (# ## ### etc.)
  text = text.replace(/^#{1,6}\s+/gm, '')

  // Remove markdown bold/italic markers
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1')
  text = text.replace(/\*([^*]+)\*/g, '$1')
  text = text.replace(/__([^_]+)__/g, '$1')
  text = text.replace(/_([^_]+)_/g, '$1')

  // Remove markdown list markers
  text = text.replace(/^[\s]*[-*+]\s+/gm, '')
  text = text.replace(/^[\s]*\d+\.\s+/gm, '')

  // Remove markdown blockquotes
  text = text.replace(/^>\s+/gm, '')

  // Remove markdown horizontal rules
  text = text.replace(/^---$/gm, '')
  text = text.replace(/^\*\*\*$/gm, '')

  // Remove HTML tags if any
  text = text.replace(/<[^>]+>/g, '')

  // Remove URLs
  text = text.replace(/https?:\/\/[^\s]+/g, '')

  // Remove email addresses
  text = text.replace(/[^\s]+@[^\s]+/g, '')

  // Remove extra whitespace and normalize
  text = text.replace(/\s+/g, ' ').trim()

  // Split by whitespace and filter out empty strings and pure punctuation
  const words = text.split(/\s+/).filter(word => {
    const cleaned = word.replace(/^[^\w]+|[^\w]+$/g, '')
    return cleaned.length > 0
  })

  return words.length
}
