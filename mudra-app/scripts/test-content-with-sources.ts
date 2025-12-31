/**
 * Test Script: Content Generation with Source Citations
 * 
 * Tests the updated workflow that includes source links in the generated content.
 * Run with: npx tsx scripts/test-content-with-sources.ts
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env" });

import { mastra } from "../mastra";

async function testContentWithSources() {
  console.log("=".repeat(80));
  console.log("TEST: Content Generation with Source Citations");
  console.log("=".repeat(80));
  console.log();

  // Check environment variables
  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ OPENAI_API_KEY not set");
    process.exit(1);
  }
  if (!process.env.FIRECRAWL_API_KEY) {
    console.error("❌ FIRECRAWL_API_KEY not set");
    process.exit(1);
  }
  console.log("✅ Environment variables loaded");
  console.log();

  const workflow = mastra.getWorkflow("aiContentWorkflow");

  const input = {
    trackedPrompt: "What are the best data labeling providers for frontier AI research labs?",
    sources: [
      { url: "https://scale.com", title: "Scale AI" },
      { url: "https://labelbox.com", title: "Labelbox" },
      { url: "https://appen.com", title: "Appen" },
    ],
    brandContext: {
      brandName: "Scale AI",
      brandDescription: "The data foundation for AI",
      targetICP: "Frontier AI Research Labs",
      uniqueValueProp: "Trusted by leading frontier labs",
      userName: "Alex Wang",
      userRole: "CEO",
    },
  };

  console.log("📥 INPUT:");
  console.log("  Tracked Prompt:", input.trackedPrompt);
  console.log("  Sources:", input.sources.map(s => s.url).join(", "));
  console.log("  Brand:", input.brandContext.brandName);
  console.log("  Author:", `${input.brandContext.userName}, ${input.brandContext.userRole}`);
  console.log();

  console.log("⏳ Starting workflow... (this may take 2-3 minutes)");
  console.log();

  const startTime = Date.now();

  try {
    const run = await workflow.createRunAsync();
    const result = await run.start({ inputData: input });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    if (result.status === "success" && result.result) {
      console.log("=".repeat(80));
      console.log("✅ WORKFLOW COMPLETED SUCCESSFULLY");
      console.log("=".repeat(80));
      console.log();

      console.log("📊 METADATA:");
      console.log("  Title:", result.result.metadata.title);
      console.log("  Word Count:", result.result.metadata.wordCount);
      console.log("  Sections:", result.result.metadata.sections?.length || "N/A");
      console.log("  Author:", `${result.result.metadata.author.name}, ${result.result.metadata.author.title}`);
      console.log("  Duration:", duration, "seconds");
      console.log();

      // Check for sources in metadata
      if (result.result.metadata.sources && result.result.metadata.sources.length > 0) {
        console.log("📚 SOURCES IN METADATA:");
        result.result.metadata.sources.forEach((s: any, i: number) => {
          console.log(`  ${i + 1}. [${s.title}](${s.url})`);
        });
        console.log();
      }

      // Analyze content for source citations
      const content = result.result.content;
      
      console.log("🔍 SOURCE CITATION ANALYSIS:");
      
      // Check for Sources/References section
      const hasSourcesSection = /##\s*(Sources|References)/i.test(content);
      console.log(`  Has Sources/References section: ${hasSourcesSection ? "✅ YES" : "❌ NO"}`);
      
      // Count markdown links
      const linkMatches = content.match(/\[([^\]]+)\]\(https?:\/\/[^\)]+\)/g) || [];
      console.log(`  Total hyperlinks found: ${linkMatches.length}`);
      
      // Check for inline citations
      const inlineCitations = content.match(/According to|Research from|Data from|Source:|per\s+\[|reports that|found that|states that/gi) || [];
      console.log(`  Inline citation phrases: ${inlineCitations.length}`);

      // Check for statistic citations (numbers followed by source)
      const statCitations = content.match(/\d+%|\d+\s*(billion|million|thousand)/gi) || [];
      console.log(`  Statistics mentioned: ${statCitations.length}`);

      // Check for quoted content with attribution
      const quotedContent = content.match(/"[^"]+"\s*[—–-]\s*[A-Z]/g) || [];
      console.log(`  Attributed quotes found: ${quotedContent.length}`);
      
      // List unique domains linked
      const urlMatches = content.match(/\(https?:\/\/([^\/\)]+)/g) || [];
      const uniqueDomains = [...new Set(urlMatches.map(u => u.replace(/^\(https?:\/\//, "")))];
      console.log(`  Unique domains cited: ${uniqueDomains.length}`);
      if (uniqueDomains.length > 0) {
        uniqueDomains.forEach(d => console.log(`    - ${d}`));
      }
      console.log();

      // Print actual word count
      const actualWordCount = content.split(/\s+/).length;
      console.log("📝 CONTENT STATS:");
      console.log(`  Actual word count: ${actualWordCount}`);
      console.log(`  Word count in range (1200-1600): ${actualWordCount >= 1200 && actualWordCount <= 1600 ? "✅ YES" : "⚠️ NO"}`);
      console.log();

      // Print content preview (first 1500 chars)
      console.log("=".repeat(80));
      console.log("📄 CONTENT PREVIEW (first 1500 chars):");
      console.log("=".repeat(80));
      console.log(content.slice(0, 1500));
      console.log("...");
      console.log();

      // Print Sources section if found
      const sourcesMatch = content.match(/##\s*(Sources|References)[\s\S]*$/i);
      if (sourcesMatch) {
        console.log("=".repeat(80));
        console.log("📚 SOURCES SECTION:");
        console.log("=".repeat(80));
        console.log(sourcesMatch[0].slice(0, 1000));
      }

      // Summary
      console.log();
      console.log("=".repeat(80));
      console.log("📋 SUMMARY:");
      console.log("=".repeat(80));
      console.log(`  ✅ Content generated: ${actualWordCount} words`);
      console.log(`  ${hasSourcesSection ? "✅" : "❌"} Sources section included`);
      console.log(`  ${linkMatches.length > 0 ? "✅" : "❌"} Hyperlinks in content: ${linkMatches.length}`);
      console.log(`  ${uniqueDomains.length >= 2 ? "✅" : "❌"} Multiple sources cited: ${uniqueDomains.length}`);
      console.log(`  ${inlineCitations.length > 0 ? "✅" : "❌"} Inline citations: ${inlineCitations.length}`);
      console.log(`  ${statCitations.length > 0 ? "✅" : "❌"} Statistics with context: ${statCitations.length}`);
      console.log(`  ${quotedContent.length > 0 ? "✅" : "⚠️"} Attributed quotes: ${quotedContent.length}`);
      console.log();

    } else {
      console.log("=".repeat(80));
      console.log("❌ WORKFLOW FAILED");
      console.log("=".repeat(80));
      console.log("Status:", result.status);
      console.log("Error:", result.error);
      console.log();
      console.log("Steps:", JSON.stringify(result.steps, null, 2));
    }
  } catch (error: any) {
    console.error("❌ Test failed with error:", error.message);
    console.error(error.stack);
  }
}

testContentWithSources();

