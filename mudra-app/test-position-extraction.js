// Test different position extraction approaches

const sampleResponse = `
Top Global Startup Accelerators

1. **Y Combinator**
   - Funding: $500,000 for ~7% equity
   
2. **Techstars**
   - Funding: $220,000 for ~5-7% equity
   
3. **500 Global**
   - Funding: $150,000 for 6% equity
   
4. **a16z Speedrun**
   - Funding: $750,000-$1M for ~7-10% equity
   
5. **Antler**
   - Funding: $200,000-$250,000 for 8-9% equity
   
6. **Entrepreneurs First**
   - Funding: $250,000 for ~9% equity
   
7. **Boost VC**
   - Funding: Up to $500,000 for 15% equity
`;

// Approach 1: Regex pattern matching (most reliable)
function extractPositionsWithRegex(text, brandName) {
  const competitors = {};
  
  // Pattern 1: "1. **Company Name**" or "1. Company Name"
  const pattern1 = /^(\d+)\.\s+\*?\*?([^*\n]+?)\*?\*?\s*$/gm;
  
  let match;
  while ((match = pattern1.exec(text)) !== null) {
    const position = parseInt(match[1]);
    const company = match[2].trim();
    
    // Skip the brand itself
    if (company.toLowerCase() !== brandName.toLowerCase()) {
      competitors[company] = position;
    }
  }
  
  // Pattern 2: "### 1st Place: Company Name"
  const pattern2 = /###\s*(\d+)(?:st|nd|rd|th)\s+(?:Place)?:?\s*\*?\*?([^*\n]+)/gi;
  while ((match = pattern2.exec(text)) !== null) {
    const position = parseInt(match[1]);
    const company = match[2].trim();
    if (company.toLowerCase() !== brandName.toLowerCase()) {
      competitors[company] = position;
    }
  }
  
  // Pattern 3: "1st: Company Name" or "First Place: Company"
  const pattern3 = /(\d+)(?:st|nd|rd|th)\s*(?:Place)?:?\s*\*?\*?([^*\n]+)/gi;
  while ((match = pattern3.exec(text)) !== null) {
    const position = parseInt(match[1]);
    const company = match[2].trim().split(/\n|\*\*/)[0].trim();
    if (company.toLowerCase() !== brandName.toLowerCase()) {
      competitors[company] = position;
    }
  }
  
  return competitors;
}

// Approach 2: Structured list detection
function detectRankingStructure(text) {
  const lines = text.split('\n');
  const rankings = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check if line starts with a number
    const match = line.match(/^(\d+)\.\s+(.+)/);
    if (match) {
      const position = parseInt(match[1]);
      const content = match[2];
      
      // Extract company name (usually in bold or first text)
      const companyMatch = content.match(/\*?\*?([^*:\n]+)/);
      if (companyMatch) {
        rankings.push({
          position,
          company: companyMatch[1].trim(),
          fullText: content
        });
      }
    }
  }
  
  return rankings;
}

// Test the approaches
console.log('=== REGEX APPROACH ===');
const regexResults = extractPositionsWithRegex(sampleResponse, 'Y Combinator');
console.log(JSON.stringify(regexResults, null, 2));

console.log('\n=== STRUCTURED LIST APPROACH ===');
const structuredResults = detectRankingStructure(sampleResponse);
console.log(JSON.stringify(structuredResults, null, 2));

// Approach 3: Combined approach (recommended)
function extractCompetitorPositions(text, brandName) {
  const positions = {};
  
  // Method 1: Standard numbered list "1. Company" or "1. **Company**"
  const numberedListRegex = /^(\d+)\.\s+\*?\*?([^*\n]+?)\*?\*?(?:\n|$)/gm;
  let match;
  
  while ((match = numberedListRegex.exec(text)) !== null) {
    const pos = parseInt(match[1]);
    let company = match[2].trim();
    
    // Clean up company name (remove trailing colons, asterisks, etc.)
    company = company.replace(/[:\*]+$/, '').trim();
    
    if (company && company.toLowerCase() !== brandName.toLowerCase()) {
      positions[company] = pos;
    }
  }
  
  // Method 2: "### 1st Place:" or "### 1st:" format
  const headingRankRegex = /###\s*(\d+)(?:st|nd|rd|th)\s+(?:Place)?:?\s*\*?\*?([^*\n]+)/gi;
  
  while ((match = headingRankRegex.exec(text)) !== null) {
    const pos = parseInt(match[1]);
    let company = match[2].trim();
    company = company.replace(/[:\*]+$/, '').trim();
    
    if (company && company.toLowerCase() !== brandName.toLowerCase()) {
      if (!positions[company]) { // Don't overwrite if already found
        positions[company] = pos;
      }
    }
  }
  
  // Method 3: "Ranked 1st:" or "1st Place:" inline format
  const inlineRankRegex = /(?:Ranked\s+)?(\d+)(?:st|nd|rd|th)\s+(?:Place)?:?\s+\*?\*?([A-Z][^.\n]{2,40}?)\*?\*?(?=\s|$|\*|\n)/g;
  
  while ((match = inlineRankRegex.exec(text)) !== null) {
    const pos = parseInt(match[1]);
    let company = match[2].trim();
    company = company.replace(/[:\*]+$/, '').trim();
    
    if (company && company.toLowerCase() !== brandName.toLowerCase()) {
      if (!positions[company]) {
        positions[company] = pos;
      }
    }
  }
  
  return positions;
}

console.log('\n=== COMBINED APPROACH (RECOMMENDED) ===');
const combinedResults = extractCompetitorPositions(sampleResponse, 'Y Combinator');
console.log(JSON.stringify(combinedResults, null, 2));
