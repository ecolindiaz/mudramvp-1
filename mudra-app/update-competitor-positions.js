// Script to add competitor position tracking to DirectGEO analysis
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'lib', 'services', 'direct-geo-analysis.service.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Old JSON structure
const oldJsonPattern = /{\s*"brandMentioned":\s*boolean,\s*"brandPosition":\s*number or null,\s*"competitorsMentioned":\s*string\[\],\s*"sentiment":\s*"positive" \| "neutral" \| "negative",\s*"confidence":\s*number,\s*"explanation":\s*"brief reasoning"\s*}/g;

// New JSON structure
const newJson = `{
  "brandMentioned": boolean,
  "brandPosition": number or null,
  "competitorsMentioned": string[],
  "competitorPositions": { [key: string]: number },
  "sentiment": "positive" | "neutral" | "negative",
  "confidence": number,
  "explanation": "brief reasoning"
}`;

// Replace all occurrences
content = content.replace(oldJsonPattern, newJson);

// Now add the competitorPositions field documentation before sentiment
const beforeSentiment = /4\. \*\*sentiment\*\*: Overall sentiment toward "\$\{config\.brandName\}" in this response:/g;

const competitorPositionsDoc = `4. **competitorPositions**: Object mapping competitor names to their positions (if they appear in a ranking)
   - Extract numerical positions for each competitor mentioned
   - Format: { "CompanyName": position_number }
   - Only include competitors that have an explicit position/ranking
   - Examples:
     * "2. Techstars" → { "Techstars": 2 }
     * "3rd: 500 Startups" → { "500 Startups": 3 }
     * From "Top 5: 1. Y Combinator, 2. Techstars, 3. 500 Startups"
       → { "Techstars": 2, "500 Startups": 3 }
   - Return empty object {} if no competitors have positions

5. **sentiment**: Overall sentiment toward "\${config.brandName}" in this response:`;

content = content.replace(beforeSentiment, competitorPositionsDoc);

// Update confidence from 5 to 6
content = content.replace(/5\. \*\*confidence\*\*: How confident are you in this analysis\?/g, '6. **confidence**: How confident are you in this analysis?');

// Update system prompt to mention competitor positions
content = content.replace(
  /Extract position\/ranking numbers carefully\./g,
  'Extract position/ranking numbers carefully for both the brand and competitors.'
);

// Write back
fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Successfully updated direct-geo-analysis.service.ts with competitor position tracking');
console.log('   - Added competitorPositions field to JSON response structure');
console.log('   - Updated field numbering (4, 5, 6)');
console.log('   - Enhanced system prompt');
