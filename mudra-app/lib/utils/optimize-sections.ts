import { countWordsInMarkdown } from "./count-words";

/** Split markdown by H2 headings, handling content that starts with ## (no leading newline) */
export function splitByH2(md: string): string[] {
  const normalized = md.startsWith('## ') ? '\n' + md : md;
  return normalized.split(/(?=\n## )/);
}

/** Check if heading is an FAQ-type section (case-insensitive) */
export function isFaqHeading(h: string): boolean {
  const l = h.toLowerCase();
  return l.includes('faq') || l.includes('frequently asked');
}

/** Check if heading is a Bottom Line / Conclusion section (case-insensitive) */
export function isClosingHeading(h: string): boolean {
  const l = h.toLowerCase();
  return l.includes('bottom line') || l.includes('conclusion');
}

/**
 * Trim sections from optimized content to fit within a word ceiling.
 * Removes non-essential H2 sections from the end, preserving original order.
 * Protected sections: FAQ, Bottom Line/Conclusion, preamble, and first 3 body sections.
 */
export function trimSections(content: string, ceiling: number): { content: string; trimmedSections: string[] } {
  const h2Parts = splitByH2(content);
  const removedIndices = new Set<number>();
  const trimmableIndices: number[] = [];
  const trimmedSections: string[] = [];

  for (let i = 0; i < h2Parts.length; i++) {
    const heading = h2Parts[i].match(/^## (.+)/m)?.[1]?.toLowerCase() || '';
    const isProtected = isFaqHeading(heading) || isClosingHeading(heading) ||
      !heading || (i - trimmableIndices.length) < 3;
    if (!isProtected) {
      trimmableIndices.push(i);
    }
  }

  const computeContent = () => h2Parts.filter((_, i) => !removedIndices.has(i)).join('');
  let result = computeContent();
  while (trimmableIndices.length > 0 && countWordsInMarkdown(result) > ceiling) {
    const removedIdx = trimmableIndices.pop()!;
    removedIndices.add(removedIdx);
    trimmedSections.push(h2Parts[removedIdx]?.match(/^## (.+)/m)?.[1] || 'unknown');
    result = computeContent();
  }

  return { content: result, trimmedSections };
}

/**
 * Enforce content structure: Bottom Line immediately before FAQ, FAQ is last section.
 * Moves any body sections that ended up after FAQ/Bottom Line back before them.
 */
export function enforceOrder(content: string): { content: string; reordered: boolean } {
  const sections = splitByH2(content);
  const preamble: string[] = [];
  const body: string[] = [];
  let bottomLine: string | null = null;
  let faq: string | null = null;

  for (const section of sections) {
    const heading = section.match(/^## (.+)/m)?.[1]?.toLowerCase() || '';
    if (!heading) {
      preamble.push(section);
    } else if (isFaqHeading(heading)) {
      if (faq) body.push(faq);
      faq = section;
    } else if (isClosingHeading(heading)) {
      if (bottomLine) body.push(bottomLine);
      bottomLine = section;
    } else {
      body.push(section);
    }
  }

  const reordered = [...preamble, ...body, ...(bottomLine ? [bottomLine] : []), ...(faq ? [faq] : [])].join('');
  return { content: reordered, reordered: reordered !== content };
}
