/**
 * Content Lab Enrichment Quality Test
 *
 * Tests the full 5-step AI content workflow end-to-end.
 * Phase 1: Verify configuration values (no API calls)
 * Phase 2: Verify prompt files load with expected rules
 * Phase 3: Run full workflow and measure article quality
 *
 * Usage:  cd mudra-app && npx tsx scripts/test-content-enrichment.ts
 * Requires: OPENAI_API_KEY + FIRECRAWL_API_KEY in .env.local
 * Runtime: ~3-5 minutes
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Load .env.local before any other imports that read env
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

// ── Helpers ─────────────────────────────────────────────────────────────

let totalChecks = 0;
let passedChecks = 0;
let failedChecks: string[] = [];

function check(label: string, pass: boolean, detail?: string) {
  totalChecks++;
  if (pass) {
    passedChecks++;
    console.log(`  [PASS] ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failedChecks.push(label);
    console.log(`  [FAIL] ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function heading(title: string) {
  console.log();
  console.log("=".repeat(64));
  console.log(`  ${title}`);
  console.log("=".repeat(64));
}

function subheading(title: string) {
  console.log();
  console.log(`--- ${title} ---`);
}

// ── Phase 1: Configuration Verification ─────────────────────────────────

async function verifyConfigurations() {
  heading("Phase 1: Configuration Verification");

  // Read source files to verify the values we changed
  const firecrawlSrc = fs.readFileSync(
    path.resolve(__dirname, "../mastra/tools/firecrawl-search.ts"),
    "utf-8"
  );
  const gapSrc = fs.readFileSync(
    path.resolve(__dirname, "../mastra/workflows/steps/analyze-gaps-step.ts"),
    "utf-8"
  );
  const researchSrc = fs.readFileSync(
    path.resolve(__dirname, "../mastra/workflows/steps/enrich-research-step.ts"),
    "utf-8"
  );
  const generateSrc = fs.readFileSync(
    path.resolve(__dirname, "../mastra/workflows/steps/generate-content-step.ts"),
    "utf-8"
  );
  const loadPromptsSrc = fs.readFileSync(
    path.resolve(__dirname, "../lib/prompts/load-prompts.ts"),
    "utf-8"
  );

  subheading("1. Firecrawl Search (firecrawl-search.ts)");
  check(
    "No Math.min(limit, 3) cap",
    !firecrawlSrc.includes("Math.min(limit, 3)"),
    firecrawlSrc.includes("Math.min(limit, 3)")
      ? "STILL CAPPED at 3"
      : "limit passed through directly"
  );
  check(
    "Markdown truncation >= 2000 chars",
    firecrawlSrc.includes("slice(0, 2000)"),
    firecrawlSrc.includes("slice(0, 500)") ? "still 500" : "set to 2000"
  );

  subheading("2. Gap Analysis (analyze-gaps-step.ts)");
  check(
    "Timeout >= 75s",
    gapSrc.includes("75000"),
    gapSrc.match(/GAP_ANALYSIS_TIMEOUT_MS\s*=\s*(\d+)/)?.[1] || "?"
  );
  check(
    "Per-source truncation >= 3000 chars",
    gapSrc.includes("slice(0, 3000)"),
    gapSrc.includes("slice(0, 1500)") ? "still 1500" : "set to 3000"
  );
  check(
    "Prompt asks for up to 5 queries",
    gapSrc.includes("up to 5 search queries"),
    gapSrc.includes("up to 3") ? "still 3" : "set to 5"
  );
  check(
    "Timeout fallback generates queries",
    gapSrc.includes("fallbackQuery1") && gapSrc.includes("fallbackQuery2"),
    gapSrc.includes("recommendedSearchQueries: []")
      ? "still empty array"
      : "generates 2 fallback queries"
  );

  subheading("3. Research Step (enrich-research-step.ts)");
  check(
    "Timeout >= 150s",
    researchSrc.includes("150000"),
    researchSrc.match(/RESEARCH_STEP_TIMEOUT_MS\s*=\s*(\d+)/)?.[1] || "?"
  );
  check(
    "Prompt says max 5 queries",
    researchSrc.includes("run max 5") && researchSrc.includes("MAXIMUM of 5"),
    researchSrc.includes("run max 3") ? "still 3" : "set to 5"
  );
  check(
    "No .slice(0, 3) on queries",
    !researchSrc.includes(".slice(0, 3)"),
    researchSrc.includes(".slice(0, 3)") ? "still sliced" : "all queries passed"
  );
  check(
    "maxSteps >= 10",
    researchSrc.includes("maxSteps: 10"),
    researchSrc.match(/maxSteps:\s*(\d+)/)?.[1] || "?"
  );
  check(
    "searchQueriesRun not capped at 3",
    !researchSrc.includes("Math.min("),
    researchSrc.includes("Math.min(") ? "still using Math.min" : "uses actual count"
  );

  subheading("4. Content Generation (generate-content-step.ts)");
  check(
    "Source content >= 1500 chars",
    generateSrc.includes("slice(0, 1500)"),
    generateSrc.includes("slice(0, 500)") && !generateSrc.includes("slice(0, 1500)")
      ? "still 500"
      : "set to 1500"
  );

  subheading("5. Prompt Loading (load-prompts.ts)");
  check(
    "Default dir is lib/prompts",
    loadPromptsSrc.includes('"lib", "prompts"'),
    loadPromptsSrc.includes('"Mudra Prompts"') &&
      !loadPromptsSrc.includes('"lib", "prompts"')
      ? 'still "Mudra Prompts"'
      : "set to lib/prompts"
  );
  check(
    "Quality prompt file is content-quality.txt",
    loadPromptsSrc.includes('"content-quality.txt"'),
    "filename in source"
  );
  check(
    "Structure prompt file is content-structure.txt",
    loadPromptsSrc.includes('"content-structure.txt"'),
    "filename in source"
  );
}

// ── Phase 2: Prompt Quality Verification ────────────────────────────────

function verifyPrompts() {
  heading("Phase 2: Prompt Content Verification");

  const qualityPath = path.resolve(__dirname, "../lib/prompts/content-quality.txt");
  const structurePath = path.resolve(__dirname, "../lib/prompts/content-structure.txt");

  subheading("content-quality.txt");
  check("File exists", fs.existsSync(qualityPath));

  if (fs.existsSync(qualityPath)) {
    const quality = fs.readFileSync(qualityPath, "utf-8");
    const sizeKB = (Buffer.byteLength(quality) / 1024).toFixed(1);
    check("File size > 4KB", Buffer.byteLength(quality) > 4000, `${sizeKB} KB`);
    check(
      "Has Statistics and Citations rules",
      quality.includes("STATISTICS") && quality.includes("CITATIONS"),
      "section found"
    );
    check(
      "Has Examples / Mini-Case-Study rules",
      quality.includes("EXAMPLES") || quality.includes("Mini case study"),
      "section found"
    );
    check(
      "Has E-E-A-T rules",
      quality.includes("E-E-A-T") || quality.includes("Experience, Expertise"),
      "section found"
    );
    check(
      "Has Quality Checklist",
      quality.includes("QUALITY CHECKLIST") || quality.includes("checklist"),
      "section found"
    );
  }

  subheading("content-structure.txt");
  check("File exists", fs.existsSync(structurePath));

  if (fs.existsSync(structurePath)) {
    const structure = fs.readFileSync(structurePath, "utf-8");
    const sizeKB = (Buffer.byteLength(structure) / 1024).toFixed(1);
    check("File size > 4KB", Buffer.byteLength(structure) > 4000, `${sizeKB} KB`);
    check(
      "Has heading hierarchy rules",
      structure.includes("HEADING") || structure.includes("H1") || structure.includes("H2"),
      "section found"
    );
    check(
      "Has FAQ rules",
      structure.includes("FAQ"),
      "section found"
    );
  }

  subheading("Prompt loads at runtime");
  try {
    const { getContentQualityPrompt, getContentStructurePrompt } =
      require("../lib/prompts/load-prompts");
    const qp = getContentQualityPrompt();
    const sp = getContentStructurePrompt();
    check("getContentQualityPrompt() loads", qp.length > 100, `${qp.length} chars`);
    check("getContentStructurePrompt() loads", sp.length > 100, `${sp.length} chars`);
  } catch (err: any) {
    check("Prompts load at runtime", false, err.message);
  }
}

// ── Phase 3: End-to-End Workflow ────────────────────────────────────────

const testInput = {
  trackedPrompt: "Best cloud platforms similar to Netlify",
  sources: [
    {
      url: "https://www.netlify.com/guides/netlify-vs-vercel/",
      title: "Netlify vs Vercel",
    },
    {
      url: "https://www.digitalapplied.com/blog/vercel-vs-netlify-vs-cloudflare-pages-comparison",
      title: "Vercel vs Netlify vs Cloudflare",
    },
    {
      url: "https://crystallize.com/blog/static-hosting",
      title: "Static Hosting Comparison",
    },
  ],
  brandContext: {
    brandName: "Vercel",
    brandDescription: "Frontend cloud platform for modern web apps",
    targetICP: "Frontend developers and SaaS teams",
    uniqueValueProp: "Best-in-class Next.js deployment with AI-native DX",
    userName: "Emi",
    userRole: "CoFounder",
  },
};

const THRESHOLDS = {
  uniqueSources: 8,
  inlineCitations: 5,
  statsWithAttribution: 3,
  expertQuotes: 1,
  wordCountMin: 1200,
  wordCountMax: 2500,
  hasSourcesSection: true,
};

function analyzeArticle(content: string) {
  // Unique source domains from inline markdown links [text](url)
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
  const uniqueDomains = new Set<string>();
  const allLinks: { text: string; url: string }[] = [];
  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    try {
      uniqueDomains.add(new URL(match[2]).hostname);
    } catch {
      // skip malformed URLs
    }
    allLinks.push({ text: match[1], url: match[2] });
  }

  // Statistics with source attribution
  // A paragraph line counts as "stat with attribution" if it contains BOTH:
  //   1. A numeric data point (%, ms, GB, billion, million, $)
  //   2. A markdown citation link
  const statNumPattern = /\d[\d,.]*\s*(%|ms|GB|billion|million|seconds|x\b)|\$[\d,.]+/i;
  const statLinkPattern = /\[[^\]]+\]\(https?:\/\/[^\)]+\)/;
  const statsSet = new Set<string>();
  const paragraphs = content.split('\n').filter((l) => l.length > 40);
  for (const para of paragraphs) {
    const numMatch = para.match(statNumPattern);
    if (numMatch && statLinkPattern.test(para)) {
      statsSet.add(numMatch[0] + ' ... ' + para.slice(0, 80));
    }
  }

  // Expert quotes: "....." — Speaker (match regular, smart/curly, and Unicode quotes)
  // U+201C = left double quote, U+201D = right double quote, U+2014 = em-dash
  const quoteRegex = new RegExp(
    '[\u201C\u201D""]([^\u201C\u201D""\\n]{15,})[\u201C\u201D""]\\s*[\u2014\u2013\\-]+\\s*([A-Z][^\\n]{2,})',
    'g'
  );
  const quotes: { snippet: string; speaker: string }[] = [];
  let qm;
  while ((qm = quoteRegex.exec(content)) !== null) {
    quotes.push({ snippet: qm[1].slice(0, 60), speaker: qm[2].trim().slice(0, 60) });
  }

  // Word count (strip markdown syntax to approximate visible text)
  const plainText = content
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1") // links -> text only
    .replace(/#{1,6}\s+/g, "") // headings
    .replace(/[*_`~]/g, "") // formatting
    .replace(/^\|.*\|$/gm, "") // table rows
    .replace(/-{3,}/g, " ") // horizontal rules
    .replace(/>\s*/g, "") // blockquotes
    .replace(/https?:\/\/\S+/g, ""); // stray URLs
  const words = plainText.split(/\s+/).filter((w) => w.length > 1);

  // Sources/References section
  const hasSourcesSection = /^#{1,3}\s+(Sources|References)/im.test(content);

  // H2 sections count
  const h2Count = (content.match(/^## /gm) || []).length;

  // Comparison table detection
  const hasTable = content.includes("| ---") || content.includes("|---");

  // FAQ detection
  const hasFAQ = /#{1,3}\s+(FAQ|Frequently Asked)/i.test(content);

  // TL;DR detection
  const hasTLDR = /TL;DR|tl;dr/i.test(content);

  return {
    uniqueSources: uniqueDomains.size,
    uniqueDomainsList: [...uniqueDomains].sort(),
    inlineCitations: allLinks.length,
    statsWithAttribution: statsSet.size,
    statsExamples: [...statsSet].slice(0, 5),
    expertQuotes: quotes.length,
    quotesExamples: quotes.slice(0, 3),
    wordCount: words.length,
    hasSourcesSection,
    h2Count,
    hasTable,
    hasFAQ,
    hasTLDR,
  };
}

async function runWorkflow() {
  heading("Phase 3: End-to-End Workflow Run");

  // Verify env vars
  if (!process.env.OPENAI_API_KEY) {
    console.log("  [SKIP] OPENAI_API_KEY not set — skipping workflow run");
    return;
  }
  if (!process.env.FIRECRAWL_API_KEY) {
    console.log("  [SKIP] FIRECRAWL_API_KEY not set — skipping workflow run");
    return;
  }

  console.log(`  Prompt:  "${testInput.trackedPrompt}"`);
  console.log(`  Sources: ${testInput.sources.length} URLs`);
  console.log(`  Brand:   ${testInput.brandContext.brandName}`);
  console.log();
  console.log("  Starting workflow (this takes 3-5 minutes)...");
  console.log();

  const startTime = Date.now();

  // Import mastra only when we're actually running the workflow
  // (avoids side effects if we're just running config checks)
  const { mastra } = await import("../mastra");

  try {
    const workflow = mastra.getWorkflow("aiContentWorkflow");
    const run = await workflow.createRun();
    const result = await run.start({ inputData: testInput });

    const durationSec = Math.round((Date.now() - startTime) / 1000);

    if (result.status !== "success" || !result.result) {
      console.log(`  Workflow failed after ${durationSec}s: ${result.status}`);

      // Try to get step-level errors
      if ((result as any).steps) {
        for (const [stepId, stepResult] of Object.entries(
          (result as any).steps as Record<string, any>
        )) {
          if (stepResult?.status === "failed") {
            console.log(`  Step "${stepId}" failed: ${stepResult.error}`);
          }
        }
      }
      check("Workflow completes successfully", false, `status: ${result.status}`);
      return;
    }

    check("Workflow completes successfully", true, `${durationSec}s`);

    const { content, metadata } = result.result as {
      content: string;
      metadata: {
        title: string;
        wordCount: number;
        sections: string[];
        sourcesScraped: number;
        researchQueriesRun: number;
        sources: { title: string; url: string; type: string }[];
      };
    };

    // ── Workflow Metadata ──
    subheading("Workflow Metadata");
    console.log(`  Title:             "${metadata.title}"`);
    console.log(`  Reported words:    ${metadata.wordCount}`);
    console.log(`  Sources scraped:   ${metadata.sourcesScraped}`);
    console.log(`  Research queries:  ${metadata.researchQueriesRun}`);
    console.log(`  Total sources:     ${metadata.sources?.length || 0}`);

    if (metadata.sources?.length) {
      const primary = metadata.sources.filter((s) => s.type === "primary");
      const research = metadata.sources.filter((s) => s.type === "research");
      console.log(`    Primary:  ${primary.length}`);
      console.log(`    Research: ${research.length}`);
    }

    check(
      "Research queries >= 3",
      metadata.researchQueriesRun >= 3,
      `${metadata.researchQueriesRun} queries`
    );
    check(
      "Metadata sources >= 5",
      (metadata.sources?.length || 0) >= 5,
      `${metadata.sources?.length || 0} sources`
    );

    // ── Article Quality Analysis ──
    subheading("Article Quality Analysis");
    const metrics = analyzeArticle(content);

    check(
      `Unique cited domains >= ${THRESHOLDS.uniqueSources}`,
      metrics.uniqueSources >= THRESHOLDS.uniqueSources,
      `${metrics.uniqueSources} domains: ${metrics.uniqueDomainsList.slice(0, 8).join(", ")}${metrics.uniqueDomainsList.length > 8 ? "..." : ""}`
    );

    check(
      `Inline citation links >= ${THRESHOLDS.inlineCitations}`,
      metrics.inlineCitations >= THRESHOLDS.inlineCitations,
      `${metrics.inlineCitations} links`
    );

    check(
      `Stats with attribution >= ${THRESHOLDS.statsWithAttribution}`,
      metrics.statsWithAttribution >= THRESHOLDS.statsWithAttribution,
      `${metrics.statsWithAttribution} found`
    );
    if (metrics.statsExamples.length > 0) {
      for (const ex of metrics.statsExamples.slice(0, 3)) {
        console.log(`    e.g. ${ex.slice(0, 90)}`);
      }
    }

    check(
      `Expert quotes >= ${THRESHOLDS.expertQuotes}`,
      metrics.expertQuotes >= THRESHOLDS.expertQuotes,
      `${metrics.expertQuotes} found`
    );
    if (metrics.quotesExamples.length > 0) {
      for (const q of metrics.quotesExamples) {
        console.log(`    "${q.snippet}..." — ${q.speaker}`);
      }
    }

    check(
      `Word count ${THRESHOLDS.wordCountMin}-${THRESHOLDS.wordCountMax}`,
      metrics.wordCount >= THRESHOLDS.wordCountMin &&
        metrics.wordCount <= THRESHOLDS.wordCountMax,
      `${metrics.wordCount} words`
    );

    check(
      "Sources/References section present",
      metrics.hasSourcesSection,
      metrics.hasSourcesSection ? "found" : "MISSING"
    );

    // ── Structure Checks ──
    subheading("Article Structure");
    check("H2 sections >= 5", metrics.h2Count >= 5, `${metrics.h2Count} H2s`);
    check("Has comparison table", metrics.hasTable, metrics.hasTable ? "found" : "missing");
    check("Has FAQ section", metrics.hasFAQ, metrics.hasFAQ ? "found" : "missing");
    check("Has TL;DR", metrics.hasTLDR, metrics.hasTLDR ? "found" : "missing");

    // ── Save article for manual review ──
    const outputPath = path.resolve(__dirname, "../test-article-output.md");
    fs.writeFileSync(outputPath, content, "utf-8");
    console.log(`\n  Article saved to: ${outputPath}`);
    console.log(`  Total time: ${durationSec}s`);
  } catch (error: any) {
    const durationSec = Math.round((Date.now() - startTime) / 1000);
    console.error(`\n  Workflow error after ${durationSec}s:`, error.message);
    if (error.stack) {
      const relevantLines = error.stack
        .split("\n")
        .slice(0, 5)
        .join("\n");
      console.error(relevantLines);
    }
    check("Workflow completes without error", false, error.message);
  }
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  console.log();
  console.log("################################################################");
  console.log("#     Content Lab Enrichment Quality Test                      #");
  console.log("################################################################");

  // Phase 1: Fast config checks (no API calls)
  await verifyConfigurations();

  // Phase 2: Prompt quality checks (filesystem only)
  verifyPrompts();

  // Phase 3: Full workflow (requires API keys, takes 3-5 min)
  await runWorkflow();

  // ── Summary ──
  heading("SUMMARY");
  console.log(`  ${passedChecks}/${totalChecks} checks passed`);

  if (failedChecks.length > 0) {
    console.log(`\n  Failed checks:`);
    for (const f of failedChecks) {
      console.log(`    - ${f}`);
    }
    console.log(`\n  RESULT: FAIL`);
  } else {
    console.log(`\n  RESULT: ALL PASS`);
  }

  console.log();
  process.exit(failedChecks.length > 0 ? 1 : 0);
}

main();
