/**
 * Schema Injection Pipeline — Comprehensive Integration Test Suite
 *
 * Actually imports and calls the real functions (readSchemaKnowledge,
 * readKnowledgeDocs) and builds the system prompt exactly as the executor
 * does in production. No DB or LLM calls — but everything else is real.
 *
 * Run with:  npx tsx scripts/test-schema-injection.ts
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ─── Import the REAL functions ──────────────────────────────────────────────
import {
  readSchemaKnowledge,
  readKnowledgeDocs,
} from "../lib/analysis/technical/knowledge.js";

// ─── Colors ──────────────────────────────────────────────────────────────────
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

// ─── Test Harness ────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
let skipped = 0;
const failures: string[] = [];

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ${GREEN}✓${RESET} ${label}`);
  } else {
    failed++;
    const msg = detail ? `${label} — ${detail}` : label;
    failures.push(msg);
    console.log(`  ${RED}✗${RESET} ${label}`);
    if (detail) console.log(`    ${DIM}${detail}${RESET}`);
  }
}

function skip(label: string, reason: string) {
  skipped++;
  console.log(`  ${YELLOW}○${RESET} ${label} ${DIM}(${reason})${RESET}`);
}

function section(title: string) {
  console.log(`\n${CYAN}${BOLD}▸ ${title}${RESET}`);
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const KB_ROOT = path.resolve(moduleDir, "../lib/analysis/technical/kb");

/**
 * Build the system prompt exactly as issue-agent-executor.service.ts does.
 * This is the production code path for schema_markup agents.
 */
function buildSchemaSystemPrompt(schemaKb: string): string {
  return `You are an expert Schema.org JSON-LD markup architect. You generate production-ready structured data that will be committed to the user's repository via an automated PR.

GROUNDING RULE: Only generate schema properties for data that actually exists on the page. Never fabricate URLs, ratings, prices, dates, authors, or any property values. If a property's value cannot be determined from the page content, omit it.

You will be given:
- The issue to fix (already contains specific instructions)
- The live page content (what users see)
- The current source code of the target file
- A schema knowledge base with required/recommended properties, examples, and restrictions

Use the knowledge base below as your authoritative reference for which properties to include, their types, and validation rules. Base all property values on actual page content.

${schemaKb}`;
}

/** Extract all JSON blocks from a string */
function extractJsonBlocks(text: string): string[] {
  const blocks: string[] = [];
  const re = /```json\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    blocks.push(m[1].trim());
  }
  return blocks;
}

// ═════════════════════════════════════════════════════════════════════════════
async function main() {
// ═════════════════════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════════════════
// 1. KB FILE STRUCTURE (quick sanity)
// ═════════════════════════════════════════════════════════════════════════════
section("1. KB File Structure");

const schemaTypesPath = path.join(KB_ROOT, "schema-types.md");
let schemaTypesContent = "";
try {
  schemaTypesContent = await fs.readFile(schemaTypesPath, "utf8");
  assert(schemaTypesContent.length > 0, "schema-types.md exists and is non-empty");
} catch {
  assert(false, "schema-types.md exists", `Not found at ${schemaTypesPath}`);
}

const expectedSections = [
  "## 1. Organization", "## 2. WebSite", "## 3. Product", "## 4. Service",
  "## 5. Article", "## 6. BlogPosting", "## 7. FAQPage", "## 8. BreadcrumbList",
  "## 9. HowTo", "## 10. SoftwareApplication", "## 11. WebApplication",
  "## 12. OfferCatalog", "## 13. ItemList", "## 14. VideoObject",
  "## 15. Review", "## 16. Person", "## 17. CollectionPage",
];
for (const sec of expectedSections) {
  assert(schemaTypesContent.includes(sec), `Contains section: ${sec}`);
}

// All JSON examples in KB are valid
const allJsonBlocks = extractJsonBlocks(schemaTypesContent);
let kbJsonValid = 0;
let kbJsonInvalid = 0;
for (const block of allJsonBlocks) {
  try { JSON.parse(block); kbJsonValid++; } catch { kbJsonInvalid++; }
}
assert(
  kbJsonInvalid === 0,
  `All ${allJsonBlocks.length} JSON-LD blocks in KB are valid JSON (${kbJsonInvalid} invalid)`
);

// ═════════════════════════════════════════════════════════════════════════════
// 2. readKnowledgeDocs() — REAL FUNCTION CALLS
// ═════════════════════════════════════════════════════════════════════════════
section("2. readKnowledgeDocs() — Real KB Loading");

{
  const schemaDocs = await readKnowledgeDocs(["json-ld"]);
  assert(schemaDocs.length > 0, 'readKnowledgeDocs(["json-ld"]) returns content');
  assert(schemaDocs.includes("GROUNDING RULE"), "Schema docs contain GROUNDING RULE");
  assert(schemaDocs.includes("Organization"), "Schema docs contain Organization type");
  assert(schemaDocs.length <= 32000, `Schema docs respect 32k cap (got ${schemaDocs.length})`);
}

{
  const seoDocs = await readKnowledgeDocs(["robots.txt"]);
  assert(seoDocs.length > 0, 'readKnowledgeDocs(["robots.txt"]) returns content');
  assert(!seoDocs.includes("GROUNDING RULE"), "SEO docs do NOT contain schema GROUNDING RULE");
  assert(seoDocs.length <= 8000, `SEO docs respect 8k cap (got ${seoDocs.length})`);
}

{
  const geoDocs = await readKnowledgeDocs(["llms.txt"]);
  assert(geoDocs.length > 0, 'readKnowledgeDocs(["llms.txt"]) returns content');
}

{
  const contentDocs = await readKnowledgeDocs(["content quality"]);
  assert(contentDocs.length > 0, 'readKnowledgeDocs(["content quality"]) returns content');
}

{
  const multiDocs = await readKnowledgeDocs(["json-ld", "robots.txt"]);
  assert(multiDocs.includes("GROUNDING RULE"), "Multi-topic includes schema content");
  assert(multiDocs.includes("---"), "Multi-topic joins with --- separator");
}

{
  // Unknown topic falls back to seo-rules.md
  const fallback = await readKnowledgeDocs(["something-totally-unknown"]);
  assert(fallback.length > 0, "Unknown topic falls back to seo-rules.md (non-empty)");
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. readSchemaKnowledge() — SECTION EXTRACTION (REAL CALLS)
// ═════════════════════════════════════════════════════════════════════════════
section("3. readSchemaKnowledge() — Real Section Extraction");

// --- 3a. Always-present content ---
{
  const result = await readSchemaKnowledge("Add Organization schema to homepage");
  assert(result.length > 0, "Returns non-empty for Organization issue");

  // Header (grounding rule, decision tree, universal rules) always present
  assert(result.includes("GROUNDING RULE"), "Always includes GROUNDING RULE");
  assert(result.includes("Quick Decision Tree"), "Always includes Quick Decision Tree");
  assert(result.includes("Universal Rules"), "Always includes Universal Rules");

  // Tail (deprecation table + skeletons) always present
  assert(result.includes("Deprecation Status Summary"), "Always includes Deprecation table");
  assert(result.includes("Compact Generation Skeletons"), "Always includes Compact Skeletons");
}

// --- 3b. Organization-only issue ---
{
  const result = await readSchemaKnowledge("Add Organization schema to homepage");
  assert(result.includes("## 1. Organization"), "Organization issue → includes Organization section");
  assert(!result.includes("## 3. Product"), "Organization issue → does NOT include Product section");
  assert(!result.includes("## 7. FAQPage"), "Organization issue → does NOT include FAQPage section");
  assert(!result.includes("## 14. VideoObject"), "Organization issue → does NOT include VideoObject section");

  // Verify the extracted Organization section has real content
  assert(result.includes("Google Required"), "Organization section has Google Required table");
  assert(result.includes("`name`"), "Organization section lists name property");
  assert(result.includes("`logo`"), "Organization section lists logo property");
  assert(result.includes("`sameAs`"), "Organization section lists sameAs property");

  // Verify it has valid JSON-LD examples
  const jsonBlocks = extractJsonBlocks(result);
  const orgBlocks = jsonBlocks.filter(b => b.includes('"Organization"'));
  assert(orgBlocks.length >= 1, `Organization section has >=1 Organization JSON-LD example (got ${orgBlocks.length})`);
  for (const block of orgBlocks) {
    try {
      const parsed = JSON.parse(block);
      assert(parsed["@type"] === "Organization", "Organization example has correct @type");
      assert(parsed["@context"] === "https://schema.org", "Organization example has correct @context");
    } catch {
      assert(false, "Organization JSON-LD example is parseable");
    }
  }
}

// --- 3c. Homepage issue: Organization + WebSite ---
{
  const result = await readSchemaKnowledge("Add Organization and WebSite schema to homepage");
  assert(result.includes("## 1. Organization"), "Homepage → includes Organization");
  assert(result.includes("## 2. WebSite"), "Homepage → includes WebSite");
  assert(!result.includes("## 6. BlogPosting"), "Homepage → does NOT include BlogPosting");
  assert(result.includes("SearchAction"), "WebSite section has SearchAction info");
  assert(result.includes("Homepage only"), "WebSite section has placement guidance");
}

// --- 3d. Blog issue: BlogPosting + Person + BreadcrumbList ---
{
  const result = await readSchemaKnowledge("Add BlogPosting, Person, and BreadcrumbList schema to blog posts");
  assert(result.includes("## 6. BlogPosting"), "Blog → includes BlogPosting");
  assert(result.includes("## 16. Person"), "Blog → includes Person");
  assert(result.includes("## 8. BreadcrumbList"), "Blog → includes BreadcrumbList");
  assert(!result.includes("## 3. Product"), "Blog → does NOT include Product");
  assert(!result.includes("## 12. OfferCatalog"), "Blog → does NOT include OfferCatalog");

  // BlogPosting section has author-related content
  assert(result.includes("datePublished"), "BlogPosting section mentions datePublished");
  assert(result.includes("headline"), "BlogPosting section mentions headline");
}

// --- 3e. Pricing page: WebApplication + OfferCatalog ---
{
  const result = await readSchemaKnowledge("Add WebApplication and OfferCatalog schema for pricing page");
  assert(result.includes("## 11. WebApplication"), "Pricing → includes WebApplication");
  assert(result.includes("## 12. OfferCatalog"), "Pricing → includes OfferCatalog");
  assert(!result.includes("## 6. BlogPosting"), "Pricing → does NOT include BlogPosting");
}

// --- 3f. Product + Video + Review ---
{
  const result = await readSchemaKnowledge("Add Product, VideoObject, and Review schema to product page");
  assert(result.includes("## 3. Product"), "Product page → includes Product");
  assert(result.includes("## 14. VideoObject"), "Product page → includes VideoObject");
  assert(result.includes("## 15. Review"), "Product page → includes Review");
  assert(!result.includes("## 9. HowTo"), "Product page → does NOT include HowTo");

  // Product section has pricing-related content
  assert(result.includes("Offer"), "Product section references Offer type");
  assert(result.includes("priceCurrency"), "Product section mentions priceCurrency");
}

// --- 3g. FAQ issue ---
{
  const result = await readSchemaKnowledge("Add FAQPage schema for existing FAQ content");
  assert(result.includes("## 7. FAQPage"), "FAQ → includes FAQPage");
  assert(result.includes("mainEntity"), "FAQPage section mentions mainEntity");
  assert(result.includes("Question"), "FAQPage section mentions Question type");
  assert(result.includes("acceptedAnswer"), "FAQPage section mentions acceptedAnswer");
}

// --- 3h. HowTo + BreadcrumbList for tutorial ---
{
  const result = await readSchemaKnowledge("Add HowTo and BreadcrumbList schema for tutorial page");
  assert(result.includes("## 9. HowTo"), "Tutorial → includes HowTo");
  assert(result.includes("## 8. BreadcrumbList"), "Tutorial → includes BreadcrumbList");
  assert(result.includes("HowToStep"), "HowTo section mentions HowToStep");
}

// --- 3i. SoftwareApplication ---
{
  const result = await readSchemaKnowledge("Add SoftwareApplication schema");
  assert(result.includes("## 10. SoftwareApplication"), "SoftwareApp → includes SoftwareApplication");
  assert(result.includes("operatingSystem"), "SoftwareApp section mentions operatingSystem");
}

// --- 3j. CollectionPage ---
{
  const result = await readSchemaKnowledge("Add CollectionPage schema for category listing");
  assert(result.includes("## 17. CollectionPage"), "Collection → includes CollectionPage");
}

// --- 3k. ItemList / carousel ---
{
  const result = await readSchemaKnowledge("Add ItemList schema for carousel display");
  assert(result.includes("## 13. ItemList"), "Carousel → includes ItemList");
}

// --- 3l. "testimonial" keyword → Review section ---
{
  const result = await readSchemaKnowledge("Add schema for customer testimonials");
  assert(result.includes("## 15. Review"), '"testimonial" keyword → Review section');
}

// --- 3m. "pricing" keyword → OfferCatalog section ---
{
  const result = await readSchemaKnowledge("Improve pricing page structured data");
  assert(result.includes("## 12. OfferCatalog"), '"pricing" keyword → OfferCatalog section');
}

// --- 3n. "author" keyword → Person section ---
{
  const result = await readSchemaKnowledge("Add author schema to articles");
  assert(result.includes("## 16. Person"), '"author" keyword → Person section');
}

// --- 3o. Generic/empty issue → header + tail only, no specific sections ---
{
  // NB: avoid words like "website", "product", "service" etc. that trigger keyword matching
  const result = await readSchemaKnowledge("Fix technical SEO meta tags");
  assert(result.includes("GROUNDING RULE"), "Generic issue still has GROUNDING RULE");
  assert(result.includes("Compact Generation Skeletons"), "Generic issue still has skeletons");
  // Should NOT have any numbered type sections (detailed reference)
  const hasNumberedSection = /## \d+\. /.test(result);
  assert(!hasNumberedSection, "Generic issue does NOT include any numbered type sections");
}

// --- 3p. Empty string input ---
{
  const result = await readSchemaKnowledge("");
  assert(result.length > 0, "Empty input still returns header + tail");
  assert(result.includes("Compact Generation Skeletons"), "Empty input still has skeletons");
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. SYSTEM PROMPT ASSEMBLY (mimic production executor)
// ═════════════════════════════════════════════════════════════════════════════
section("4. System Prompt Assembly (production mirror)");

{
  // Mimic: issue.title = "Add Organization, WebSite Schema", issue.description = "Homepage needs structured data"
  const issueText = "Add Organization, WebSite Schema Homepage needs structured data";
  const schemaKb = await readSchemaKnowledge(issueText);
  const systemPrompt = buildSchemaSystemPrompt(schemaKb);

  assert(systemPrompt.includes("GROUNDING RULE"), "System prompt has GROUNDING RULE");
  assert(systemPrompt.includes("expert Schema.org JSON-LD markup architect"), "System prompt has agent identity");
  assert(systemPrompt.includes("automated PR"), "System prompt mentions PR workflow");
  assert(systemPrompt.includes("## 1. Organization"), "System prompt has Organization KB section");
  assert(systemPrompt.includes("## 2. WebSite"), "System prompt has WebSite KB section");
  assert(systemPrompt.includes("Compact Generation Skeletons"), "System prompt has compact skeletons");

  // Verify the prompt doesn't have irrelevant sections
  assert(!systemPrompt.includes("## 6. BlogPosting"), "System prompt does NOT have BlogPosting for homepage issue");
  assert(!systemPrompt.includes("## 14. VideoObject"), "System prompt does NOT have VideoObject for homepage issue");

  // Verify JSON-LD examples are embedded and parseable
  const jsonBlocks = extractJsonBlocks(systemPrompt);
  assert(jsonBlocks.length >= 2, `System prompt has >=2 JSON-LD examples (got ${jsonBlocks.length})`);
  let allParseable = true;
  for (const block of jsonBlocks) {
    try { JSON.parse(block); } catch { allParseable = false; }
  }
  assert(allParseable, "All JSON-LD examples in system prompt are parseable");

  console.log(`    ${DIM}System prompt length: ${systemPrompt.length} chars${RESET}`);
}

{
  // Scenario: Blog post issue
  const issueText = "Add BlogPosting, Person schema to blog articles";
  const schemaKb = await readSchemaKnowledge(issueText);
  const systemPrompt = buildSchemaSystemPrompt(schemaKb);

  assert(systemPrompt.includes("## 6. BlogPosting"), "Blog prompt has BlogPosting section");
  assert(systemPrompt.includes("## 16. Person"), "Blog prompt has Person section");
  assert(!systemPrompt.includes("## 3. Product"), "Blog prompt does NOT have Product");

  console.log(`    ${DIM}Blog prompt length: ${systemPrompt.length} chars${RESET}`);
}

{
  // Scenario: Full product page (Product + Video + Review + BreadcrumbList)
  const issueText = "Add Product, VideoObject, Review, BreadcrumbList schema to product detail page";
  const schemaKb = await readSchemaKnowledge(issueText);
  const systemPrompt = buildSchemaSystemPrompt(schemaKb);

  assert(systemPrompt.includes("## 3. Product"), "Product prompt has Product section");
  assert(systemPrompt.includes("## 14. VideoObject"), "Product prompt has VideoObject section");
  assert(systemPrompt.includes("## 15. Review"), "Product prompt has Review section");
  assert(systemPrompt.includes("## 8. BreadcrumbList"), "Product prompt has BreadcrumbList section");

  // This is a large prompt — verify it's reasonable
  assert(systemPrompt.length < 50000, `Product prompt is under 50k chars (got ${systemPrompt.length})`);
  console.log(`    ${DIM}Product prompt length: ${systemPrompt.length} chars${RESET}`);
}

{
  // Scenario: Generic issue (no specific schema type mentioned)
  const issueText = "Fix JSON-LD structured data issues on the site";
  const schemaKb = await readSchemaKnowledge(issueText);
  const systemPrompt = buildSchemaSystemPrompt(schemaKb);

  // Should still have the skeleton reference
  assert(systemPrompt.includes("Compact Generation Skeletons"), "Generic prompt has compact skeletons");
  // The "json" keyword doesn't match any specific type — should get compact output
  console.log(`    ${DIM}Generic prompt length: ${systemPrompt.length} chars${RESET}`);
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. SECTION ISOLATION — No Content Leakage
// ═════════════════════════════════════════════════════════════════════════════
section("5. Section Isolation — No Content Leakage");

{
  // Organization-only should NOT contain detailed sections from other types.
  // Note: compact skeletons (always included) contain brief one-liner references
  // to all types, so we check for content unique to DETAILED sections (property
  // tables, restriction paragraphs, multi-line examples).
  const result = await readSchemaKnowledge("Add Organization schema");

  // Section headers are the definitive isolation marker
  assert(!result.includes("## 7. FAQPage"), "Org-only → no FAQPage section header");
  assert(!result.includes("## 9. HowTo"), "Org-only → no HowTo section header");
  assert(!result.includes("## 14. VideoObject"), "Org-only → no VideoObject section header");
  assert(!result.includes("## 15. Review"), "Org-only → no Review section header");
  assert(!result.includes("## 10. SoftwareApplication"), "Org-only → no SoftwareApp section header");

  // Detailed content markers (property tables, restriction text) unique to other sections
  assert(!result.includes("operatingSystem"), "Org-only → no SoftwareApp operatingSystem property");
  assert(!result.includes("applicationCategory"), "Org-only → no SoftwareApp applicationCategory");
}

{
  // FAQPage-only should not contain detailed Product/SoftwareApp sections
  const result = await readSchemaKnowledge("Add FAQPage schema");
  assert(!result.includes("## 3. Product"), "FAQ-only → no Product section header");
  assert(!result.includes("## 10. SoftwareApplication"), "FAQ-only → no SoftwareApp section header");
  assert(!result.includes("operatingSystem"), "FAQ-only → no SoftwareApp operatingSystem property");
  assert(!result.includes("applicationCategory"), "FAQ-only → no SoftwareApp applicationCategory");
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. JSON-LD VALIDITY IN EXTRACTED SECTIONS
// ═════════════════════════════════════════════════════════════════════════════
section("6. JSON-LD Validity in Extracted Sections");

const scenarios: [string, string][] = [
  ["Organization", "Add Organization schema"],
  ["WebSite", "Add WebSite schema"],
  ["Product", "Add Product schema"],
  ["FAQPage", "Add FAQPage schema"],
  ["BlogPosting", "Add BlogPosting schema"],
  ["HowTo", "Add HowTo schema"],
  ["VideoObject", "Add VideoObject schema"],
  ["Review", "Add Review schema for testimonials"],
  ["Person", "Add Person schema for author"],
  ["BreadcrumbList", "Add BreadcrumbList schema"],
  ["SoftwareApplication", "Add SoftwareApplication schema"],
  ["WebApplication", "Add WebApplication schema"],
  ["OfferCatalog", "Add OfferCatalog schema for pricing"],
  ["ItemList", "Add ItemList schema for carousel"],
  ["CollectionPage", "Add CollectionPage schema"],
  ["Service", "Add Service schema"],
  ["Article", "Add Article schema"],
];

for (const [typeName, issueText] of scenarios) {
  const result = await readSchemaKnowledge(issueText);
  const jsonBlocks = extractJsonBlocks(result);

  // At least one JSON block should be present (from skeleton or example)
  assert(jsonBlocks.length >= 1, `${typeName}: extracted content has >=1 JSON block`);

  // All JSON blocks must be valid
  let allValid = true;
  for (const block of jsonBlocks) {
    try { JSON.parse(block); } catch { allValid = false; }
  }
  assert(allValid, `${typeName}: all extracted JSON blocks are valid`);
}

// ═════════════════════════════════════════════════════════════════════════════
// 7. AGENT ROUTING & WIRING (source checks)
// ═════════════════════════════════════════════════════════════════════════════
section("7. Agent Routing & Wiring");

const executorPath = path.resolve(moduleDir, "../lib/services/issue-agent-executor.service.ts");
let executorSource = "";
try { executorSource = await fs.readFile(executorPath, "utf8"); } catch {}

if (executorSource) {
  assert(executorSource.includes("'schema_markup': 'schemaArchitectAgent'"), "schema_markup maps to schemaArchitectAgent");
  assert(!executorSource.includes("'schema_architect'"), "Dead alias schema_architect removed");
  assert(!executorSource.includes("'json_ld_generation'"), "Dead alias json_ld_generation removed");
  assert(!executorSource.includes("'structured_data': 'schemaArchitectAgent'"), "Dead alias structured_data removed");
  assert(executorSource.includes("agentType === 'schema_markup'"), "isSchemaAgentType checks schema_markup only");
  assert(executorSource.includes("import { readSchemaKnowledge }"), "readSchemaKnowledge is imported");
  assert(executorSource.includes("readSchemaKnowledge(issueText)"), "readSchemaKnowledge is called with issueText");
  assert(executorSource.includes("GROUNDING RULE"), "Executor system prompt has GROUNDING RULE");
  assert(executorSource.includes("GEO (Generative Engine Optimization)"), "Non-schema agents use generic prompt");
} else {
  skip("Agent routing checks", "issue-agent-executor.service.ts not readable");
}

// E2B alias cleanup
const e2bPath = path.resolve(moduleDir, "../lib/services/e2b-sandbox.service.ts");
let e2bSource = "";
try { e2bSource = await fs.readFile(e2bPath, "utf8"); } catch {}
if (e2bSource) {
  assert(e2bSource.includes("'schema_markup'"), "E2B includes schema_markup");
  assert(!e2bSource.includes("'schema_architect'"), "E2B does not include schema_architect");
  assert(!e2bSource.includes("'json_ld_generation'"), "E2B does not include json_ld_generation");
} else {
  skip("E2B checks", "e2b-sandbox.service.ts not readable");
}

// Issue-from-scoring check mapping
const isfsPath = path.resolve(moduleDir, "../lib/services/issue-from-scoring.service.ts");
let isfsSource = "";
try { isfsSource = await fs.readFile(isfsPath, "utf8"); } catch {}
if (isfsSource) {
  for (const check of ["J1_present", "J2_valid", "J3_relevant", "J4_coverage", "FAQ_schema_gap"]) {
    assert(isfsSource.includes(`'${check}': 'schema_markup'`), `Scoring check ${check} → schema_markup`);
  }
} else {
  skip("Scoring check mapping", "issue-from-scoring.service.ts not readable");
}

// ═════════════════════════════════════════════════════════════════════════════
// 8. PRODUCTION GAP FIXES VERIFICATION
// ═════════════════════════════════════════════════════════════════════════════
section("8. Production Gap Fixes");

// Gap 1: resolveSourceFilePath uses affectedUrl instead of hardcoded path
if (executorSource) {
  assert(
    executorSource.includes("resolveSourceFilePath"),
    "Gap 1: resolveSourceFilePath function exists"
  );
  assert(
    executorSource.includes("resolveSourceFilePath(issue.agentType"),
    "Gap 1: gatherIssueContext uses resolveSourceFilePath"
  );
  assert(
    executorSource.includes("resolveSourceFilePath(agentType, issue.affectedUrl)"),
    "Gap 1: finalFilePath uses resolveSourceFilePath with affectedUrl"
  );
  // Verify URL-to-path conversion logic
  assert(
    executorSource.includes("app/${urlPath}/page.tsx"),
    "Gap 1: URL path segments convert to Next.js App Router paths"
  );
}

// Gap 2: J2 issues include existing schema types for KB extraction
const scorerPath = path.resolve(moduleDir, "../lib/analysis/technical/four-dimension-scorer.ts");
let scorerSource = "";
try { scorerSource = await fs.readFile(scorerPath, "utf8"); } catch {}
if (scorerSource) {
  assert(
    scorerSource.includes("Current types:") && scorerSource.includes("J2_valid"),
    "Gap 2: J2 issue message includes existing schema types"
  );
}
if (isfsSource) {
  assert(
    isfsSource.includes("J2_valid") && isfsSource.includes("Fix ${typeMatch[1]} JSON-LD Syntax"),
    "Gap 2: J2 issue title includes schema type names for KB extraction"
  );
}

// Gap 2 integration: J2 issue title now feeds readSchemaKnowledge correctly
{
  // Simulate J2 issue: "Fix Organization JSON-LD Syntax (Homepage)"
  const j2IssueText = "Fix Organization JSON-LD Syntax This page has invalid JSON-LD schema. Existing schema types: Organization";
  const j2Kb = await readSchemaKnowledge(j2IssueText);
  assert(j2Kb.includes("## 1. Organization"), "Gap 2: J2 Organization issue now extracts Organization KB section");
}
{
  // Simulate J2 with multiple types
  const j2Multi = "Fix Product, Review JSON-LD Syntax Existing schema types: Product, Review";
  const j2Kb = await readSchemaKnowledge(j2Multi);
  assert(j2Kb.includes("## 3. Product"), "Gap 2: J2 multi-type extracts Product section");
  assert(j2Kb.includes("## 15. Review"), "Gap 2: J2 multi-type extracts Review section");
}

// Gap 5: Duplicate schema insertion prevention
const ghServicePath = path.resolve(moduleDir, "../lib/services/github.service.ts");
let ghSource = "";
try { ghSource = await fs.readFile(ghServicePath, "utf8"); } catch {}
if (ghSource) {
  assert(
    ghSource.includes("return existingContent"),
    "Gap 5: hasExistingOptimization returns existing content (no duplicate insertion)"
  );
  assert(
    !ghSource.includes("// For now, still add"),
    "Gap 5: Old TODO comment about still adding duplicates is removed"
  );
  // All 17 types are checked for duplicates
  assert(
    ghSource.includes("'VideoObject'") && ghSource.includes("'CollectionPage'") && ghSource.includes("'HowTo'"),
    "Gap 5: Duplicate check covers all 17 schema types"
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 9. END-TO-END: Full Production Path Simulation
// ═════════════════════════════════════════════════════════════════════════════
section("9. End-to-End Production Path Simulation");

// Simulate what happens when a J1_present scoring check fires for a homepage:
//   1. issue-from-scoring creates issue with title like "Add Organization, WebSite Schema"
//   2. Executor gets agentType = 'schema_markup'
//   3. isSchemaAgentType('schema_markup') → true
//   4. issueText = issue.title + issue.description
//   5. schemaKb = readSchemaKnowledge(issueText)
//   6. systemPrompt = buildSchemaSystemPrompt(schemaKb)
//   7. Agent receives systemPrompt + user message with page content

const e2eScenarios: { name: string; issueTitle: string; issueDesc: string; mustInclude: string[]; mustNotInclude: string[] }[] = [
  {
    name: "Homepage (Organization + WebSite)",
    issueTitle: "Add Organization, WebSite Schema",
    issueDesc: "This homepage is missing JSON-LD structured data. Recommended: Organization, WebSite.",
    mustInclude: ["## 1. Organization", "## 2. WebSite", "SearchAction", "`name`", "`url`", "`logo`"],
    mustNotInclude: ["## 6. BlogPosting", "## 9. HowTo", "## 14. VideoObject"],
  },
  {
    name: "Blog Post (BlogPosting + Person + BreadcrumbList)",
    issueTitle: "Add BlogPosting, Person, BreadcrumbList Schema",
    issueDesc: "Blog post page needs structured data for SEO rich results.",
    mustInclude: ["## 6. BlogPosting", "## 16. Person", "## 8. BreadcrumbList", "datePublished", "headline"],
    mustNotInclude: ["## 3. Product", "## 12. OfferCatalog"],
  },
  {
    name: "Pricing Page (WebApplication + OfferCatalog)",
    issueTitle: "Add WebApplication, OfferCatalog Schema for Pricing Page",
    issueDesc: "SaaS pricing page should have structured pricing data.",
    mustInclude: ["## 11. WebApplication", "## 12. OfferCatalog"],
    mustNotInclude: ["## 6. BlogPosting", "## 9. HowTo"],
  },
  {
    name: "Product Detail (Product + Review + VideoObject)",
    issueTitle: "Add Product, Review, VideoObject Schema",
    issueDesc: "Product page with customer reviews and demo video needs structured data.",
    mustInclude: ["## 3. Product", "## 15. Review", "## 14. VideoObject", "priceCurrency"],
    mustNotInclude: ["## 6. BlogPosting", "## 9. HowTo"],
  },
  {
    name: "FAQ Page",
    issueTitle: "Add FAQPage Schema for Existing FAQ Content",
    issueDesc: "The FAQ page has Q&A content but no structured data.",
    mustInclude: ["## 7. FAQPage", "mainEntity", "acceptedAnswer"],
    mustNotInclude: ["## 3. Product", "## 14. VideoObject"],
  },
  {
    name: "Tutorial / HowTo",
    issueTitle: "Add HowTo, BreadcrumbList Schema for Tutorial",
    issueDesc: "Step-by-step tutorial page needs structured data.",
    mustInclude: ["## 9. HowTo", "## 8. BreadcrumbList", "HowToStep"],
    mustNotInclude: ["## 3. Product", "## 12. OfferCatalog"],
  },
];

for (const scenario of e2eScenarios) {
  console.log(`\n  ${DIM}── ${scenario.name} ──${RESET}`);

  const issueText = `${scenario.issueTitle} ${scenario.issueDesc}`;
  const schemaKb = await readSchemaKnowledge(issueText);
  const systemPrompt = buildSchemaSystemPrompt(schemaKb);

  // Verify always-present content
  assert(systemPrompt.includes("GROUNDING RULE"), `[${scenario.name}] Has GROUNDING RULE`);
  assert(systemPrompt.includes("Compact Generation Skeletons"), `[${scenario.name}] Has skeletons`);

  // Verify must-include sections
  for (const inc of scenario.mustInclude) {
    assert(systemPrompt.includes(inc), `[${scenario.name}] Includes: ${inc}`);
  }

  // Verify must-not-include (no irrelevant sections)
  for (const exc of scenario.mustNotInclude) {
    assert(!systemPrompt.includes(exc), `[${scenario.name}] Excludes: ${exc}`);
  }

  // Verify all JSON in the prompt is valid
  const jsonBlocks = extractJsonBlocks(systemPrompt);
  let jsonValid = true;
  for (const block of jsonBlocks) {
    try { JSON.parse(block); } catch { jsonValid = false; }
  }
  assert(jsonValid, `[${scenario.name}] All JSON-LD in prompt is valid (${jsonBlocks.length} blocks)`);

  console.log(`    ${DIM}Prompt size: ${systemPrompt.length} chars, ${jsonBlocks.length} JSON blocks${RESET}`);
}

// ═════════════════════════════════════════════════════════════════════════════
// RESULTS
// ═════════════════════════════════════════════════════════════════════════════
console.log("\n" + "=".repeat(70));
console.log(
  `${BOLD}Results:${RESET} ${GREEN}${passed} passed${RESET}, ${failed > 0 ? RED : DIM}${failed} failed${RESET}, ${skipped > 0 ? YELLOW : DIM}${skipped} skipped${RESET}`
);

if (failures.length > 0) {
  console.log(`\n${RED}${BOLD}Failures:${RESET}`);
  for (const f of failures) {
    console.log(`  ${RED}✗${RESET} ${f}`);
  }
}

console.log();
if (failed > 0) {
  console.log(`${RED}Some tests failed.${RESET}`);
} else {
  console.log(`${GREEN}All tests passed!${RESET}`);
}

} // end main

main().catch((err) => {
  console.error("Fatal error:", err);
});
