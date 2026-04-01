/**
 * Compute a word-level inline diff between original and optimized markdown content.
 * Produces the DiffSection[] format expected by the ContentDiffView component.
 */

export type DiffSpan = { type: "added" | "removed" | "text"; content: string };
export type DiffSection = {
  heading?: string;
  isNew?: boolean;
  paragraphs: DiffSpan[][];
};

interface Section {
  heading: string;
  content: string;
}

/** Split markdown into sections by H2 headings */
function splitIntoSections(markdown: string): Section[] {
  const lines = markdown.split("\n");
  const sections: Section[] = [];
  let currentHeading = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    const h2Match = line.match(/^##\s+(.+)$/);
    if (h2Match) {
      if (currentHeading || currentContent.length > 0) {
        sections.push({ heading: currentHeading, content: currentContent.join("\n").trim() });
      }
      currentHeading = h2Match[1].trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  if (currentHeading || currentContent.length > 0) {
    sections.push({ heading: currentHeading, content: currentContent.join("\n").trim() });
  }

  return sections;
}

/** Normalize heading for fuzzy matching */
function normalizeHeading(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

/** Compute LCS-based word diff between two strings */
function computeWordDiff(original: string, modified: string): DiffSpan[] {
  const origWords = original.split(/(\s+)/);
  const modWords = modified.split(/(\s+)/);

  // Simple LCS for small texts, greedy approach for performance
  const spans: DiffSpan[] = [];
  let i = 0;
  let j = 0;

  while (i < origWords.length && j < modWords.length) {
    if (origWords[i] === modWords[j]) {
      // Accumulate matching text
      let text = origWords[i];
      i++;
      j++;
      while (i < origWords.length && j < modWords.length && origWords[i] === modWords[j]) {
        text += origWords[i];
        i++;
        j++;
      }
      spans.push({ type: "text", content: text });
    } else {
      // Look ahead for a match
      const lookAhead = 30;
      let foundInOrig = -1;
      let foundInMod = -1;

      for (let k = 1; k <= lookAhead && j + k < modWords.length; k++) {
        if (modWords[j + k] === origWords[i]) {
          foundInMod = j + k;
          break;
        }
      }

      for (let k = 1; k <= lookAhead && i + k < origWords.length; k++) {
        if (origWords[i + k] === modWords[j]) {
          foundInOrig = i + k;
          break;
        }
      }

      if (foundInMod > -1 && (foundInOrig === -1 || foundInMod - j <= foundInOrig - i)) {
        // Words were added in modified
        let added = "";
        while (j < foundInMod) {
          added += modWords[j];
          j++;
        }
        spans.push({ type: "added", content: added });
      } else if (foundInOrig > -1) {
        // Words were removed from original
        let removed = "";
        while (i < foundInOrig) {
          removed += origWords[i];
          i++;
        }
        spans.push({ type: "removed", content: removed });
      } else {
        // No match found nearby — treat as remove + add
        spans.push({ type: "removed", content: origWords[i] });
        spans.push({ type: "added", content: modWords[j] });
        i++;
        j++;
      }
    }
  }

  // Remaining original words are removals
  if (i < origWords.length) {
    let removed = "";
    while (i < origWords.length) {
      removed += origWords[i];
      i++;
    }
    spans.push({ type: "removed", content: removed });
  }

  // Remaining modified words are additions
  if (j < modWords.length) {
    let added = "";
    while (j < modWords.length) {
      added += modWords[j];
      j++;
    }
    spans.push({ type: "added", content: added });
  }

  return mergeAdjacentSpans(spans);
}

/** Merge adjacent spans of the same type */
function mergeAdjacentSpans(spans: DiffSpan[]): DiffSpan[] {
  const merged: DiffSpan[] = [];
  for (const span of spans) {
    if (span.content === "") continue;
    const last = merged[merged.length - 1];
    if (last && last.type === span.type) {
      last.content += span.content;
    } else {
      merged.push({ ...span });
    }
  }
  return merged;
}

/** Split section content into paragraphs (by double newline or heading boundaries) */
function splitParagraphs(content: string): string[] {
  return content
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter((p) => p.length > 0);
}

/**
 * Compute content diff between original and optimized markdown.
 * Returns DiffSection[] for the ContentDiffView component.
 */
export function computeContentDiff(originalMarkdown: string, optimizedMarkdown: string): DiffSection[] {
  const origSections = splitIntoSections(originalMarkdown);
  const optSections = splitIntoSections(optimizedMarkdown);

  const usedOriginals = new Set<number>();
  const result: DiffSection[] = [];

  for (const optSection of optSections) {
    const normalizedOpt = normalizeHeading(optSection.heading);

    // Find matching original section
    let matchIdx = -1;
    let bestScore = 0;
    for (let i = 0; i < origSections.length; i++) {
      if (usedOriginals.has(i)) continue;
      const normalizedOrig = normalizeHeading(origSections[i].heading);
      if (normalizedOrig === normalizedOpt) {
        matchIdx = i;
        bestScore = 1;
        break;
      }
      // Partial match — check word overlap
      const origWords = new Set(normalizedOrig.split(" "));
      const optWords = normalizedOpt.split(" ");
      const overlap = optWords.filter((w) => origWords.has(w)).length;
      const score = overlap / Math.max(origWords.size, optWords.length);
      if (score > 0.5 && score > bestScore) {
        bestScore = score;
        matchIdx = i;
      }
    }

    if (matchIdx >= 0) {
      usedOriginals.add(matchIdx);
      const origParas = splitParagraphs(origSections[matchIdx].content);
      const optParas = splitParagraphs(optSection.content);

      const paragraphs: DiffSpan[][] = [];

      // Diff each paragraph pair, handle uneven counts
      const maxLen = Math.max(origParas.length, optParas.length);
      for (let p = 0; p < maxLen; p++) {
        if (p < origParas.length && p < optParas.length) {
          paragraphs.push(computeWordDiff(origParas[p], optParas[p]));
        } else if (p >= origParas.length) {
          paragraphs.push([{ type: "added", content: optParas[p] }]);
        } else {
          paragraphs.push([{ type: "removed", content: origParas[p] }]);
        }
      }

      result.push({ heading: optSection.heading, paragraphs });
    } else {
      // New section — all added
      const optParas = splitParagraphs(optSection.content);
      result.push({
        heading: optSection.heading,
        isNew: true,
        paragraphs: optParas.map((p) => [{ type: "added" as const, content: p }]),
      });
    }
  }

  // Sections removed from original
  for (let i = 0; i < origSections.length; i++) {
    if (usedOriginals.has(i)) continue;
    const origParas = splitParagraphs(origSections[i].content);
    if (origParas.length > 0) {
      result.push({
        heading: origSections[i].heading,
        paragraphs: origParas.map((p) => [{ type: "removed" as const, content: p }]),
      });
    }
  }

  return result;
}

/** Compute summary stats from diff sections */
export function computeDiffStats(sections: DiffSection[]): {
  wordsAdded: number;
  wordsRemoved: number;
  sectionsNew: number;
  sectionsModified: number;
} {
  let wordsAdded = 0;
  let wordsRemoved = 0;
  let sectionsNew = 0;
  let sectionsModified = 0;

  for (const section of sections) {
    if (section.isNew) {
      sectionsNew++;
    }
    let hasChanges = false;
    for (const para of section.paragraphs) {
      for (const span of para) {
        if (span.type === "added") {
          wordsAdded += span.content.split(/\s+/).filter(Boolean).length;
          hasChanges = true;
        }
        if (span.type === "removed") {
          wordsRemoved += span.content.split(/\s+/).filter(Boolean).length;
          hasChanges = true;
        }
      }
    }
    if (hasChanges && !section.isNew) sectionsModified++;
  }

  return { wordsAdded, wordsRemoved, sectionsNew, sectionsModified };
}
