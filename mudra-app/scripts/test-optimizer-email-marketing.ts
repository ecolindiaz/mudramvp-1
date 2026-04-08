/**
 * Answer Optimizer Eval Suite — Email Marketing Article
 *
 * Different content from the credit cards test to validate the optimizer
 * works across topics. Tests topic preservation, word count, and quality.
 *
 * Article topic: "Best Email Marketing Platforms for Small Business"
 * Prompt topic: "What is the best CRM for startups?" (DIFFERENT topic)
 *
 * Run: cd mudra-app && npx tsx --env-file=.env.local scripts/test-optimizer-email-marketing.ts
 */

import { contentOptimizerAgent } from "../src/mastra/agents/content-optimizer-agent";
import { optimizationOutputSchema } from "../src/mastra/agents/schemas/optimization-schema";

// ── Test Article ─────────────────────────────────────────────────────
const TEST_PAGE_TITLE = "7 Best Email Marketing Platforms for Small Business in 2026";
const TEST_PAGE_URL = "https://mailchimp.com/resources/best-email-marketing-platforms";
const TEST_PROMPT_TEXT = "What is the best CRM software for startups?";

const TEST_ORIGINAL_MARKDOWN = `# 7 Best Email Marketing Platforms for Small Business in 2026

Email marketing remains one of the highest-ROI channels for small businesses. For every dollar spent, email generates an average return of $36, making it essential for customer retention and revenue growth.

Choosing the right email marketing platform can be overwhelming. This guide breaks down the top options based on pricing, automation capabilities, deliverability, and ease of use.

## Why email marketing matters for small businesses

Small businesses often operate with limited marketing budgets. Email marketing provides a direct, cost-effective way to nurture leads, announce promotions, and build lasting customer relationships without the ongoing ad spend of paid channels.

Unlike social media, where algorithm changes can cut your reach overnight, your email list is an asset you own. Every subscriber is a direct line to a potential customer.

## Key features to look for in an email marketing platform

When evaluating platforms, focus on these capabilities:
- Drag-and-drop email builder for non-technical users
- Marketing automation workflows (welcome series, abandoned cart, re-engagement)
- List segmentation and tagging
- A/B testing for subject lines and content
- Analytics and reporting dashboards
- Integration with your existing tools (Shopify, WordPress, CRMs)
- Deliverability rates and sender reputation management

## 7 best email marketing platforms

### 1. Mailchimp
Mailchimp is the most widely recognized email marketing platform, trusted by over 13 million small businesses worldwide. It offers a generous free plan for up to 500 contacts, making it ideal for businesses just starting out. The platform includes a visual email builder, basic automation, and landing page creation.

### 2. ConvertKit
ConvertKit is built specifically for creators and small content businesses. It emphasizes simplicity with a tag-based subscriber system rather than traditional lists. Visual automation builder makes it easy to create complex email sequences.

### 3. ActiveCampaign
ActiveCampaign combines email marketing with CRM functionality, making it a strong choice for businesses that want both in one platform. Advanced automation capabilities and machine learning-powered send time optimization set it apart.

### 4. Brevo (formerly Sendinblue)
Brevo offers email marketing, SMS marketing, and chat in one platform. Its pricing model is based on emails sent rather than contacts stored, which can be more economical for businesses with large but infrequent email lists.

### 5. Constant Contact
One of the longest-running email marketing platforms, Constant Contact is known for its ease of use and strong customer support. Event management tools and social media integration are included.

### 6. MailerLite
MailerLite stands out for its clean interface and generous free plan. It includes a website builder, landing pages, and pop-up forms alongside standard email marketing features. Great for budget-conscious small businesses.

### 7. Klaviyo
Klaviyo is the go-to choice for e-commerce businesses, particularly those on Shopify. Deep product data integration enables highly personalized product recommendations and abandoned cart flows.

## How to choose the right platform

Consider your business type, budget, and technical skill level. E-commerce businesses benefit most from Klaviyo's deep integrations. Content creators should look at ConvertKit. General small businesses will find Mailchimp or MailerLite the most accessible starting points.
`;

const ORIGINAL_WORD_COUNT = TEST_ORIGINAL_MARKDOWN.split(/\s+/).filter(Boolean).length;

// ── Depth configs matching route.ts ──────────────────────────────────
const DEPTH_CONFIGS = {
  light: { label: "LIGHT TOUCH", floor: 1000, ceiling: 1200, retention: "75-85%" },
  moderate: { label: "SMART REWRITE", floor: 1500, ceiling: 1800, retention: "40-60%" },
  deep: { label: "DEEP OVERHAUL", floor: 1800, ceiling: 2200, retention: "15-30%" },
} as const;

type DepthKey = keyof typeof DEPTH_CONFIGS;

interface EvalResult {
  depth: string;
  title: string;
  h1: string;
  wordCount: number;
  targetRange: string;
  withinRange: boolean;
  sections: string[];
  topicOnTrack: boolean;
  bridgingSections: string[];
  emailMktMentions: number;
  crmMentions: number;
  ratio: string;
  statsAdded: number;
  faqsAdded: number;
  contentPreview: string;
  hasStructuralElements: {
    hasTldr: boolean;
    hasFaq: boolean;
    hasBottomLine: boolean;
    hasAuthorByline: boolean;
    hasStats: boolean;
  };
}

async function runOptimization(depth: DepthKey): Promise<EvalResult> {
  const config = DEPTH_CONFIGS[depth];
  // Target the midpoint — model tends to undershoot, server-side trimming catches overshoot
  const rangeMidpoint = Math.round((config.floor + config.ceiling) / 2);
  const targetWordCount = Math.min(Math.max(rangeMidpoint, ORIGINAL_WORD_COUNT), config.ceiling);

  const optimizePrompt = `## TOPIC ANCHOR
This article is about: "${TEST_PAGE_TITLE}"
Original URL: ${TEST_PAGE_URL}
Optimization target: make this article get cited when someone asks "${TEST_PROMPT_TEXT}"
RULES:
- Every H2 section must be directly about "${TEST_PAGE_TITLE}" — not about the prompt's topic.
- Do NOT add sections that bridge the article's subject to an adjacent topic from the prompt.
- The prompt tells you WHAT QUERY to optimize for, not what new subjects to introduce.

## Optimization Task
Depth Level: ${config.label}
Target Word Count: ${targetWordCount} words (minimum ${config.floor}, maximum ${config.ceiling})
Voice & Tone: professional

## Existing Article (ORIGINAL)
${TEST_ORIGINAL_MARKDOWN}

## Core Search Query: "best email marketing platforms small business 2026" (commercial intent)

## FAQ Research
- What is the best email marketing platform for beginners?
- How much does email marketing cost for a small business?
- Is Mailchimp still the best email marketing tool?
- What email marketing platform has the best automation?
- Can I do email marketing for free?

## Gap Analysis (top priorities)
- Content Gaps: Missing pricing comparison across platforms, no deliverability benchmarks
- Data Gaps: No statistics on email marketing ROI by industry, no platform market share data
- Format Gaps: No comparison table, no FAQ section, no TL;DR
- Depth Gaps: Surface-level coverage of automation features, no mention of AI-powered features

## Brand Context
Brand: Mailchimp | Industry: MarTech / Email Marketing
Author: Sarah Chen, Marketing Technology Writer

## CRITICAL: Word Count Constraint
The original article is ${ORIGINAL_WORD_COUNT} words. Your output MUST be between ${config.floor} and ${config.ceiling} words (target: ${targetWordCount}).
You need to produce at least ${config.floor - ORIGINAL_WORD_COUNT > 0 ? config.floor - ORIGINAL_WORD_COUNT + ' MORE words than the original' : 'as many words as the original'}.
- If your draft is BELOW ${config.floor} words: you MUST keep writing. Add longer direct-answer paragraphs, expand descriptions, add FAQ entries with 2-3 sentence answers, include comparison tables. A short article is a FAILURE.
- If your draft EXCEEDS ${config.ceiling} words: cut sections or shorten paragraphs.
Count every word before finalizing. The floor is as important as the ceiling.
Follow ${config.label} depth rules strictly.`;

  const response = await contentOptimizerAgent.generate(optimizePrompt, {
    structuredOutput: { schema: optimizationOutputSchema },
    maxSteps: 1,
  });

  const result = response.object as any;
  let content = result?.optimizedContent || "";
  const title = result?.metadata?.title || "";
  const sections: string[] = result?.metadata?.sections || [];

  const rawWordCount = content.split(/\s+/).filter(Boolean).length;

  // Server-side word count enforcement (same logic as the pipeline)
  if (rawWordCount > config.ceiling) {
    const h2Parts = content.split(/(?=\n## )/);
    const keepParts: string[] = [];
    const trimmable: string[] = [];

    for (const part of h2Parts) {
      const heading = part.match(/^## (.+)/m)?.[1]?.toLowerCase() || '';
      const isProtected = heading.includes('faq') || heading.includes('bottom line') ||
        !heading || keepParts.length < 3;
      if (isProtected) {
        keepParts.push(part);
      } else {
        trimmable.push(part);
      }
    }

    while (trimmable.length > 0 && (keepParts.join('') + trimmable.join('')).split(/\s+/).filter(Boolean).length > config.ceiling) {
      trimmable.pop();
    }

    content = keepParts.join('') + trimmable.join('');
  }

  const actualWordCount = content.split(/\s+/).filter(Boolean).length;

  const h1Match = content.match(/^#\s+(.+)$/m);
  const h1 = h1Match ? h1Match[1] : "(no H1)";

  const lc = content.toLowerCase();
  const emailMktMentions = (lc.match(/email marketing/g) || []).length;
  const crmMentions = (lc.match(/\bcrm\b/g) || []).length;

  // Detect bridging sections: sections whose PRIMARY subject is CRM (the prompt topic)
  // rather than email marketing. Mentioning CRM as a feature of a platform is OK.
  const bridging = sections.filter(s => {
    const ls = s.toLowerCase();
    // Only flag if CRM is the main subject, not a feature descriptor
    const isCrmFocused = ls.includes("crm software") || ls.includes("crm for startups") ||
      (ls.startsWith("how email marketing") && ls.includes("crm")) ||
      (ls.startsWith("why") && ls.includes("crm") && !ls.includes("email"));
    return isCrmFocused;
  });

  const lcTitle = title.toLowerCase();
  const lcH1 = h1.toLowerCase();
  const topicOk =
    (lcTitle.includes("email marketing") || lcTitle.includes("email")) &&
    (lcH1.includes("email marketing") || lcH1.includes("email")) &&
    !lcTitle.includes("crm software") &&
    !lcH1.includes("crm software") &&
    bridging.length === 0;

  // Check structural quality elements
  const hasTldr = lc.includes("tl;dr") || lc.includes("tldr") || lc.includes("> tl;dr");
  const hasFaq = lc.includes("## faq") || lc.includes("## frequently asked");
  const hasBottomLine = lc.includes("## bottom line") || lc.includes("## conclusion");
  const hasAuthorByline = lc.includes("author:") || lc.includes("last updated:");
  const hasStats = (lc.match(/\d+%/g) || []).length >= 2;

  return {
    depth: config.label,
    title,
    h1,
    wordCount: actualWordCount,
    targetRange: `${config.floor}-${config.ceiling}`,
    withinRange: actualWordCount >= config.floor && actualWordCount <= config.ceiling,
    sections,
    topicOnTrack: topicOk,
    bridgingSections: bridging,
    emailMktMentions: emailMktMentions,
    crmMentions: crmMentions,
    ratio: crmMentions > 0 ? `${(emailMktMentions / crmMentions).toFixed(1)}x` : `${emailMktMentions}:0`,
    statsAdded: result?.diffManifest?.statsAdded || 0,
    faqsAdded: result?.diffManifest?.faqsAdded || 0,
    contentPreview: content.slice(0, 500),
    hasStructuralElements: { hasTldr, hasFaq, hasBottomLine, hasAuthorByline, hasStats },
  };
}

function printResult(r: EvalResult) {
  console.log(`\n${"━".repeat(70)}`);
  console.log(`  ${r.depth}`);
  console.log(`${"━".repeat(70)}`);
  console.log(`  Title:        ${r.title}`);
  console.log(`  H1:           ${r.h1}`);
  console.log(`  Word Count:   ${r.wordCount} (target: ${r.targetRange}) ${r.withinRange ? "✅" : "❌ OUT OF RANGE"}`);
  console.log(`  Topic OK:     ${r.topicOnTrack ? "✅ On-topic" : "❌ Drifted"}`);
  if (r.bridgingSections.length > 0) {
    console.log(`  Bridging:     ❌ ${r.bridgingSections.join(", ")}`);
  }
  console.log(`  Email Mkt:    ${r.emailMktMentions}   CRM mentions: ${r.crmMentions}   Ratio: ${r.ratio}`);
  console.log(`  Stats added:  ${r.statsAdded}   FAQs added: ${r.faqsAdded}`);
  console.log(`  Structure:`);
  const s = r.hasStructuralElements;
  console.log(`    TL;DR: ${s.hasTldr ? "✅" : "❌"}  FAQ: ${s.hasFaq ? "✅" : "❌"}  Bottom Line: ${s.hasBottomLine ? "✅" : "❌"}  Author: ${s.hasAuthorByline ? "✅" : "❌"}  Stats: ${s.hasStats ? "✅" : "❌"}`);
  console.log(`  Sections:`);
  r.sections.forEach(s => console.log(`    - ${s}`));
  console.log(`\n  Preview:`);
  console.log(`  ${r.contentPreview.replace(/\n/g, "\n  ")}`);
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════════╗");
  console.log("║  Answer Optimizer — Email Marketing Eval (3 Depth Levels)           ║");
  console.log("║  Article: Best email marketing platforms for small business         ║");
  console.log("║  Prompt:  Best CRM software for startups (DIFFERENT topic)          ║");
  console.log("╚══════════════════════════════════════════════════════════════════════╝");
  console.log(`\nOriginal article: ${ORIGINAL_WORD_COUNT} words`);

  const depths: DepthKey[] = ["light", "moderate", "deep"];
  const results: EvalResult[] = [];

  for (const depth of depths) {
    console.log(`\n⏳ Running ${DEPTH_CONFIGS[depth].label}... (30-60s)`);
    try {
      const r = await runOptimization(depth);
      results.push(r);
      printResult(r);
    } catch (err: any) {
      console.log(`❌ ${DEPTH_CONFIGS[depth].label} failed: ${err.message}`);
    }
  }

  // ── Summary Table ──────────────────────────────────────────────────
  console.log(`\n\n${"═".repeat(80)}`);
  console.log("  SUMMARY");
  console.log(`${"═".repeat(80)}`);
  console.log(`  ${"Depth".padEnd(18)} ${"Words".padEnd(10)} ${"Range".padEnd(14)} ${"In Range".padEnd(10)} ${"Topic".padEnd(8)} ${"EM:CRM".padEnd(10)} ${"TL;DR".padEnd(7)} ${"FAQ".padEnd(5)} Bridging`);
  console.log(`  ${"-".repeat(18)} ${"-".repeat(10)} ${"-".repeat(14)} ${"-".repeat(10)} ${"-".repeat(8)} ${"-".repeat(10)} ${"-".repeat(7)} ${"-".repeat(5)} --------`);
  for (const r of results) {
    const s = r.hasStructuralElements;
    console.log(`  ${r.depth.padEnd(18)} ${String(r.wordCount).padEnd(10)} ${r.targetRange.padEnd(14)} ${(r.withinRange ? "✅" : "❌").padEnd(10)} ${(r.topicOnTrack ? "✅" : "❌").padEnd(8)} ${r.ratio.padEnd(10)} ${(s.hasTldr ? "✅" : "❌").padEnd(7)} ${(s.hasFaq ? "✅" : "❌").padEnd(5)} ${r.bridgingSections.length === 0 ? "✅ None" : "❌ " + r.bridgingSections.length}`);
  }

  const allPass = results.every(r => r.topicOnTrack && r.withinRange && r.bridgingSections.length === 0);
  console.log(`\n  Overall: ${allPass ? "✅ ALL PASSING" : "⚠️  SOME ISSUES — see details above"}`);
}

main();
