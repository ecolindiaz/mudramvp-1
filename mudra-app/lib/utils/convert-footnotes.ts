/**
 * Converts footnote-style citations to inline [Source](URL) links.
 * GPT-5.1 sometimes generates footnotes despite instructions to use inline links.
 * Handles both numeric ([^1]) and named ([^aapanel], [^softwarescout]) footnotes.
 * The Lexical editor and marked don't support footnote markdown, so these render as raw text.
 */

interface FootnoteDefinition {
  label: string;
  url: string | null;
}

/**
 * Quick check: returns true only if BOTH [^ref] references AND [^ref]: definitions exist.
 * Supports numeric ([^1]) and named ([^aapanel]) footnotes.
 */
export function hasFootnoteCitations(markdown: string): boolean {
  const hasReference = /\[\^[\w-]+\](?!:)/.test(markdown);
  const hasDefinition = /^\[\^[\w-]+\]:\s*.+$/m.test(markdown);
  return hasReference && hasDefinition;
}

/**
 * Converts footnote citations to inline links.
 *
 * Algorithm:
 * 1. Protect code blocks from false-positive matching
 * 2. Parse [^N]: definitions into a map
 * 3. Replace [^N] references with inline links
 * 4. Remove definition lines and empty section headings
 */
export function convertFootnotesToInlineLinks(
  markdown: string,
  metadataSources?: { title: string; url: string }[]
): string {
  if (!hasFootnoteCitations(markdown)) return markdown;

  // Phase 1: Protect code blocks
  const codeBlocks: string[] = [];
  let text = markdown.replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match);
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });

  // Also protect inline code
  const inlineCode: string[] = [];
  text = text.replace(/`[^`]+`/g, (match) => {
    inlineCode.push(match);
    return `__INLINE_CODE_${inlineCode.length - 1}__`;
  });

  // Phase 2: Parse footnote definitions (numeric or named)
  const definitions = new Map<string, FootnoteDefinition>();
  const definitionRegex = /^\[\^([\w-]+)\]:\s*(.+)$/gm;
  let match: RegExpExecArray | null;

  while ((match = definitionRegex.exec(text)) !== null) {
    const id = match[1];
    const rawText = match[2].trim();
    const def = parseDefinition(rawText, metadataSources);
    definitions.set(id, def);
  }

  // Phase 3: Replace [^ref] references in body (numeric or named)
  text = text.replace(/\[\^([\w-]+)\](?!:)/g, (fullMatch, id: string) => {
    const def = definitions.get(id);
    if (!def) return fullMatch; // No matching definition — leave as-is
    if (def.url) return `[${def.label}](${def.url})`;
    return `(${def.label})`; // No URL — parenthetical attribution
  });

  // Phase 4: Remove footnote definition lines (numeric or named)
  text = text.replace(/^\[\^[\w-]+\]:\s*.+$/gm, "");

  // Remove empty Sources/References headings
  text = text.replace(
    /^#{1,3}\s*(Sources|References|Footnotes|Notes)\s*\n(\s*\n)*/gim,
    ""
  );

  // Clean up excessive blank lines left behind
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.trimEnd() + "\n";

  // Restore code blocks
  text = text.replace(/__CODE_BLOCK_(\d+)__/g, (_, i) => codeBlocks[Number(i)]);
  text = text.replace(/__INLINE_CODE_(\d+)__/g, (_, i) => inlineCode[Number(i)]);

  return text;
}

function parseDefinition(
  rawText: string,
  metadataSources?: { title: string; url: string }[]
): FootnoteDefinition {
  // Check for embedded markdown link: [text](url)
  const mdLinkMatch = rawText.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
  if (mdLinkMatch) {
    return { label: mdLinkMatch[1], url: mdLinkMatch[2] };
  }

  // Check for trailing bare URL
  const bareUrlMatch = rawText.match(/(https?:\/\/\S+)$/);
  if (bareUrlMatch) {
    const url = bareUrlMatch[1];
    // Extract label from text before the URL
    const textBeforeUrl = rawText.slice(0, bareUrlMatch.index).trim();
    const label = extractLabel(textBeforeUrl) || new URL(url).hostname;
    return { label, url };
  }

  // Try fuzzy-match against metadataSources
  if (metadataSources?.length) {
    const matched = fuzzyMatchSource(rawText, metadataSources);
    if (matched) {
      const label = extractLabel(rawText) || matched.title;
      return { label, url: matched.url };
    }
  }

  // No URL found — use text as label
  const label = extractLabel(rawText) || rawText;
  return { label, url: null };
}

/**
 * Extract display label from definition text.
 * Prefers text after the last em-dash separator.
 */
function extractLabel(text: string): string {
  if (!text) return "";

  // Split on em-dash variants and take the last segment
  const parts = text.split(/\s*[—–]\s*|\s*--\s*/);
  const last = parts[parts.length - 1].trim();

  // Remove trailing punctuation
  const cleaned = last.replace(/[.,;:]+$/, "").trim();
  return cleaned || text.trim();
}

/**
 * Fuzzy-match definition text against metadata sources.
 * Requires 2+ significant matching words between definition and source title.
 */
/**
 * Check if markdown has orphan footnote references (references without definitions).
 * These show as raw [^name] text in the editor.
 */
export function hasOrphanFootnoteRefs(markdown: string): boolean {
  const hasReference = /\[\^[\w-]+\](?!:)/.test(markdown);
  const hasDefinition = /^\[\^[\w-]+\]:\s*.+$/m.test(markdown);
  return hasReference && !hasDefinition;
}

/**
 * Clean up orphan footnote references by matching them to metadata sources
 * or removing them if no match is found.
 * Handles [^name] references that have no [^name]: definition lines.
 */
export function cleanOrphanFootnoteRefs(
  markdown: string,
  metadataSources?: { title: string; url: string }[]
): string {
  if (!hasOrphanFootnoteRefs(markdown)) return markdown;

  // Protect code blocks
  const codeBlocks: string[] = [];
  let text = markdown.replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match);
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });
  const inlineCode: string[] = [];
  text = text.replace(/`[^`]+`/g, (match) => {
    inlineCode.push(match);
    return `__INLINE_CODE_${inlineCode.length - 1}__`;
  });

  // Replace orphan [^ref] references
  text = text.replace(/\[\^([\w-]+)\]/g, (fullMatch, id: string) => {
    // Don't touch definitions (won't exist, but safety check)
    if (fullMatch.endsWith(']:')) return fullMatch;

    // Try to match the footnote name to a metadata source
    if (metadataSources?.length) {
      const refName = id.replace(/-/g, ' ');
      const matched = fuzzyMatchSource(refName, metadataSources);
      if (matched) {
        return `[${matched.title}](${matched.url})`;
      }
    }

    // No match — remove the orphan reference cleanly
    return '';
  });

  // Clean up double spaces left by removed refs
  text = text.replace(/  +/g, ' ');
  // Clean up space before punctuation
  text = text.replace(/ ([.,;:!?])/g, '$1');

  // Restore code blocks
  text = text.replace(/__CODE_BLOCK_(\d+)__/g, (_, i) => codeBlocks[Number(i)]);
  text = text.replace(/__INLINE_CODE_(\d+)__/g, (_, i) => inlineCode[Number(i)]);

  return text;
}

function fuzzyMatchSource(
  definitionText: string,
  sources: { title: string; url: string }[]
): { title: string; url: string } | null {
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
    "as", "it", "its", "this", "that", "how", "what", "which", "who",
  ]);

  const getSignificantWords = (text: string): Set<string> => {
    return new Set(
      text
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !stopWords.has(w))
    );
  };

  const defWords = getSignificantWords(definitionText);

  let bestMatch: { title: string; url: string } | null = null;
  let bestCount = 0;

  for (const source of sources) {
    const sourceWords = getSignificantWords(source.title);
    let matchCount = 0;
    Array.from(defWords).forEach((word) => {
      if (sourceWords.has(word)) matchCount++;
    });
    if (matchCount >= 2 && matchCount > bestCount) {
      bestCount = matchCount;
      bestMatch = source;
    }
  }

  return bestMatch;
}
