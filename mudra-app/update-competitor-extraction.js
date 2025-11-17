const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'lib', 'services', 'direct-geo-analysis.service.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// Pattern to find and replace
const oldPattern = `3. **competitorsMentioned**: Array of OTHER company/brand names mentioned in the response (EXCLUDING "\${config.brandName}" itself)
   - Extract proper company names that are competitors, alternatives, or mentioned alongside the brand
   - Include full company names (e.g., "Techstars", "500 Startups", "Scale AI", "Labelbox", "Appen")
   - Focus on companies that appear in rankings, comparisons, lists, or as alternatives
   - Exclude generic terms like "startups", "companies", "accelerators" unless they are actual brand names
   - Return empty array [] if no competitors are mentioned
   - Example: From "Top 5 accelerators: 1. Y Combinator, 2. Techstars, 3. 500 Startups, 4. Seedcamp, 5. MassChallenge"
     → competitorsMentioned should be: ["Techstars", "500 Startups", "Seedcamp", "MassChallenge"]`;

const newPattern = `3. **competitorsMentioned**: Array of OTHER company/brand names mentioned in the response (EXCLUDING "\${config.brandName}" itself)
   - Extract ALL proper company names that are competitors, alternatives, or mentioned alongside the brand
   - Include EVERY company name found in rankings, comparisons, lists, or as alternatives (not just top 3-5)
   - Include full company names with proper formatting (e.g., "Techstars", "500 Global", "a16z", "Entrepreneurs First", "Boost VC")
   - Capture ALL companies even if they appear later in long lists (positions 4, 5, 6, 7, etc.)
   - Exclude generic terms like "startups", "companies", "accelerators" unless they are actual brand names
   - Return empty array [] if no competitors are mentioned
   - Examples:
     * From "Top 5 accelerators: 1. Y Combinator, 2. Techstars, 3. 500 Global, 4. Seedcamp, 5. MassChallenge"
       → competitorsMentioned should be: ["Techstars", "500 Global", "Seedcamp", "MassChallenge"]
     * From "Top 7: 1. YC, 2. Techstars, 3. 500 Global, 4. a16z Speedrun, 5. Antler, 6. Entrepreneurs First, 7. Boost VC"
       → competitorsMentioned should be: ["Techstars", "500 Global", "a16z Speedrun", "Antler", "Entrepreneurs First", "Boost VC"]`;

// Replace all occurrences
const updatedContent = content.split(oldPattern).join(newPattern);

if (updatedContent === content) {
  console.log('❌ No changes made - pattern not found');
  process.exit(1);
}

fs.writeFileSync(filePath, updatedContent);

const count = (content.match(new RegExp(oldPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
console.log(`✅ Updated ${count} occurrences of competitor extraction instructions`);
console.log('✅ Enhanced AI prompt to extract ALL competitors mentioned (not just top 3-5)');
