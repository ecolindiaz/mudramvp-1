/**
 * Answer Optimizer Eval Suite
 *
 * Tests all 3 depth levels (Light Touch, Smart Rewrite, Deep Overhaul)
 * for topic preservation, word count compliance, and output quality.
 *
 * Run: cd mudra-app && npx tsx --env-file=.env.local scripts/test-optimizer-topic-drift.ts
 */

import { contentOptimizerAgent } from "../src/mastra/agents/content-optimizer-agent";
import { optimizationOutputSchema } from "../src/mastra/agents/schemas/optimization-schema";

// ── Test Article ─────────────────────────────────────────────────────
const TEST_PAGE_TITLE = "6 Best High-Limit Business Credit Cards in 2026";
const TEST_PAGE_URL = "https://ramp.com/blog/high-limit-business-credit-cards";
const TEST_PROMPT_TEXT = "What is the best spend management software for mid-sized companies?";

const TEST_ORIGINAL_MARKDOWN = `# 6 Best High-Limit Business Credit Cards in 2026

A high-limit business credit card is any card that offers extended access to credit, either through a preset high limit or flexible, charge-based models that adjust based on your business's financial profile. They are built for companies that need more spending power than a typical business card provides.

These cards come with significantly higher credit limits, enabling you to manage large, recurring expenses such as payroll and inventory.

## What constitutes a high-limit business credit card

While "high-limit" varies by business size, here's how different card types typically break down:
- Traditional bank cards offer $50,000 to $250,000 typical limits based on credit scores and financial statements. These limits are usually fixed until you request an increase.
- Fintech cards provide dynamic spending power, which can range from $50,000 to $1 million+ based on real-time revenue. Instead of relying on credit history, these cards analyze your actual cash flow.
- Traditional charge cards have no preset limit, but your spending power varies based on your financial profile and payment history.
- Corporate cards are designed for large enterprises with limits ranging from $100,000 to $10 million+.

The key difference lies in how limits are set and adjusted. Traditional cards rely on credit scores. Modern fintech options like Ramp use real-time cash flow data.

## What low limits actually cost your business

When suppliers offer early payment discounts of 2-3% for quick settlements, businesses with low limits frequently can't capitalize on these savings for large orders. Missing out on a 2% discount for a $50,000 purchase means throwing away $1,000 in savings.

Low limits also force you to split large purchases across multiple cards or payment methods, which creates reconciliation headaches, increases error rates, and can delay critical purchases.

Perhaps most costly are the growth opportunities you miss when spending constraints prevent you from scaling during peak periods.

## How to choose the right high-limit card for your business

Your monthly spending volume and business model determine which card type works best for you.

### Step 1: Review current business spending.
Look at your last 6 months of expenses to get a sense of your monthly spending patterns and your biggest expense categories.

### Step 2: Define your approval timeline.
Traditional banks typically take 7-14 business days for approval, while fintech cards like Ramp can often approve you within 48 hours.

### Step 3: Evaluate limit adjustment flexibility.
Some cards make you fill out paperwork and wait weeks for limit increases, while others automatically adjust your spending power as your revenue grows.

## Requirements for high-limit business credit cards

Most high-limit cards require U.S.-based operations with a federal tax ID and primary U.S. business address. Traditional cards typically require a 700+ credit score and $100,000+ annual revenue.

## 6 best high-limit business credit cards

### 1. Ramp Corporate Credit Card
Ramp's Corporate Card is designed for teams that need to keep growing without losing control. Unlike traditional high-limit cards, Ramp combines unlimited spending capacity with real-time visibility and automated policy enforcement. No annual, late, or foreign transaction fees.

### 2. Chase Ink Business Premier Credit Card
The Chase Ink Business Premier Credit Card generally offers a minimum spending limit of around $10,000, allowing for substantial business purchases. Up to 2.5% cashback on purchases of $5,000 or more.

### 3. Capital One Spark Cash Plus
The Spark Cash Plus is a charge card built for high-spend businesses that want straightforward rewards. Unlimited cashback on every purchase and no preset limit.

### 4. The Business Platinum Card from American Express
A premium choice for companies that travel frequently and spend heavily in specific business categories. High annual fee of $895.

### 5. Capital One Venture X Business Card
A premium travel-focused charge card designed for teams with frequent business travel and high monthly spending. $395 annual fee.

### 6. Blue Business Plus Card from American Express
A flexible, no-fee entry point for businesses that want solid rewards with simplicity. Flat 2X points up to $50K.
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
  creditCardMentions: number;
  spendMgmtMentions: number;
  ratio: string;
  statsAdded: number;
  faqsAdded: number;
  contentPreview: string;
}

async function runOptimization(depth: DepthKey): Promise<EvalResult> {
  const config = DEPTH_CONFIGS[depth];
  const targetWordCount = Math.min(Math.max(config.floor, ORIGINAL_WORD_COUNT), config.ceiling);

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

## Core Search Query: "best high-limit business credit cards 2026" (commercial intent)

## FAQ Research
- What business credit card has the highest limit?
- How to get a $50,000 credit card limit?
- What credit card has a $100,000 limit?
- How quickly can I get approved for a high-limit business card?

## Gap Analysis (top priorities)
- Content Gaps: Missing comparison of approval times across issuers, no mention of dynamic vs fixed limits trade-offs
- Data Gaps: No statistics on average business credit card limits
- Format Gaps: No comparison table, no FAQ section
- Depth Gaps: Surface-level coverage of fintech vs traditional cards

## Brand Context
Brand: Ramp | Industry: Fintech
Author: Richard Moy, Finance Writer

Target exactly ${targetWordCount} words. Follow ${config.label} depth rules strictly.`;

  const response = await contentOptimizerAgent.generate(optimizePrompt, {
    structuredOutput: { schema: optimizationOutputSchema },
    maxSteps: 1,
  });

  const result = response.object as any;
  let content = result?.optimizedContent || "";
  const title = result?.metadata?.title || "";
  const sections: string[] = result?.metadata?.sections || [];

  // Actual word count before trimming
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
  const ccMentions = (lc.match(/credit card/g) || []).length;
  const smMentions = (lc.match(/spend management/g) || []).length;

  const bridging = sections.filter(s => {
    const ls = s.toLowerCase();
    return ls.includes("spend management") || ls.includes("expense management") || ls.includes("spend platform");
  });

  const lcTitle = title.toLowerCase();
  const lcH1 = h1.toLowerCase();
  const topicOk =
    (lcTitle.includes("credit card") || lcTitle.includes("high-limit")) &&
    (lcH1.includes("credit card") || lcH1.includes("high-limit")) &&
    !lcTitle.includes("spend management") &&
    !lcH1.includes("spend management") &&
    bridging.length === 0;

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
    creditCardMentions: ccMentions,
    spendMgmtMentions: smMentions,
    ratio: smMentions > 0 ? `${(ccMentions / smMentions).toFixed(1)}x` : `${ccMentions}:0`,
    statsAdded: result?.diffManifest?.statsAdded || 0,
    faqsAdded: result?.diffManifest?.faqsAdded || 0,
    contentPreview: content.slice(0, 400),
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
  console.log(`  CC mentions:  ${r.creditCardMentions}   SM mentions: ${r.spendMgmtMentions}   Ratio: ${r.ratio}`);
  console.log(`  Stats added:  ${r.statsAdded}   FAQs added: ${r.faqsAdded}`);
  console.log(`  Sections:`);
  r.sections.forEach(s => console.log(`    - ${s}`));
  console.log(`\n  Preview:`);
  console.log(`  ${r.contentPreview.replace(/\n/g, "\n  ")}`);
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════════╗");
  console.log("║  Answer Optimizer — Full Eval (3 Depth Levels)                      ║");
  console.log("║  Article: High-limit business credit cards                          ║");
  console.log("║  Prompt:  Best spend management software (DIFFERENT topic)          ║");
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
  console.log(`\n\n${"═".repeat(70)}`);
  console.log("  SUMMARY");
  console.log(`${"═".repeat(70)}`);
  console.log(`  ${"Depth".padEnd(18)} ${"Words".padEnd(12)} ${"Range".padEnd(14)} ${"In Range".padEnd(10)} ${"Topic".padEnd(8)} ${"CC:SM".padEnd(8)} Bridging`);
  console.log(`  ${"-".repeat(18)} ${"-".repeat(12)} ${"-".repeat(14)} ${"-".repeat(10)} ${"-".repeat(8)} ${"-".repeat(8)} --------`);
  for (const r of results) {
    console.log(`  ${r.depth.padEnd(18)} ${String(r.wordCount).padEnd(12)} ${r.targetRange.padEnd(14)} ${(r.withinRange ? "✅" : "❌").padEnd(10)} ${(r.topicOnTrack ? "✅" : "❌").padEnd(8)} ${r.ratio.padEnd(8)} ${r.bridgingSections.length === 0 ? "✅ None" : "❌ " + r.bridgingSections.length}`);
  }

  const allPass = results.every(r => r.topicOnTrack && r.withinRange && r.bridgingSections.length === 0);
  console.log(`\n  Overall: ${allPass ? "✅ ALL PASSING" : "⚠️  SOME ISSUES — see details above"}`);
}

main();
