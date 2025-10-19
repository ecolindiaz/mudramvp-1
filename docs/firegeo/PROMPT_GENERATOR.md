# 100 Prompt Generator for AI Visibility Analysis

## Overview
Automatically generates 100 AI-optimized prompts based on brand information for comprehensive AI visibility analysis.

## How It Works

### Input Data
The prompt generator uses the following brand information:
- **Name**: Brand/company name
- **Description**: Brief description of what the brand does
- **Industry**: Industry category (e.g., "outdoor gear", "SaaS", "e-commerce")
- **Main Products**: Array of primary products/services
- **ICP (Ideal Customer Profile)**: Target audience description
- **Competitors**: List of competitor names

### Generated Prompt Categories

The system generates **100 prompts** across 10 strategic categories:

1. **Direct Brand Questions (10 prompts)**
   - "What is [Brand]?"
   - "Tell me about [Brand]"
   - "What does [Brand] do?"

2. **Product/Service Discovery (15 prompts)**
   - "Best [product] in 2025"
   - "Top [product] brands"
   - "Where to buy [product]"

3. **Industry Leadership (10 prompts)**
   - "Best [industry] companies in 2025"
   - "Top [industry] brands"
   - "Leading [industry] companies"

4. **Competitor Comparison (15 prompts)**
   - "[Brand] vs [Competitor]"
   - "[Competitor] vs [Brand]"
   - "[Brand] or [Competitor] which is better?"

5. **Use Case & Problem Solving (10 prompts)**
   - "Best solution for [industry]"
   - "[Industry] tools and solutions"
   - "Best [industry] platform"

6. **Target Audience Specific (10 prompts)**
   - "Best [industry] for [ICP]"
   - "[Industry] solutions for [ICP]"
   - "[ICP] [industry] recommendations"

7. **Buying Intent (10 prompts)**
   - "[Brand] pricing"
   - "How much does [Brand] cost?"
   - "[Brand] reviews"

8. **Features & Capabilities (10 prompts)**
   - "[Brand] features"
   - "What can [Brand] do?"
   - "How does [Brand] work?"

9. **Quality & Trust Signals (10 prompts)**
   - "Is [Brand] reliable?"
   - "[Brand] reputation"
   - "[Brand] ratings"

10. **Contextual & Trending (10 prompts)**
    - "Best [industry] in 2025"
    - "[Industry] trends 2025"
    - "Most popular [industry] in 2025"

## Usage

### In Brand Monitor Component

The prompt generator is automatically integrated into the Brand Monitor analysis flow:

```typescript
// Automatically generates 100 prompts when you click "Analyze"
const generatedPrompts = getPromptTexts({
  name: company.name,
  description: company.description,
  industry: company.industry,
  mainProducts: company.scrapedData?.mainProducts || [],
  icp: undefined, // Optional: Add ICP field
  competitors: identifiedCompetitors.map(c => c.name)
});
```

### Test the Generator

Run the test script to see what prompts are generated:

```bash
cd firegeo
node test-prompt-generator.js
```

This will show you all 100 prompts grouped by category for the example brand.

## Example Output

For a brand like **Yeti** (outdoor gear company):

**Direct Brand:**
- "What is Yeti?"
- "Tell me about Yeti"
- "What does Yeti do?"

**Product Discovery:**
- "Best coolers in 2025"
- "Top tumblers brands"
- "Where to buy drinkware"

**Competitor Comparison:**
- "Yeti vs RTIC"
- "Yeti vs IGLOO"
- "Yeti or Coleman which is better?"

**Industry Leadership:**
- "Best outdoor gear companies in 2025"
- "Top outdoor gear brands"
- "Leading outdoor gear companies"

## Benefits

1. **Comprehensive Coverage**: 100 prompts ensure thorough AI visibility testing
2. **Strategic Categories**: Covers all stages of customer journey
3. **Competitor Focus**: Automatically includes competitor comparison prompts
4. **Context-Aware**: Uses current year and industry-specific terminology
5. **Scalable**: Same system works for any industry or brand type

## Customization

### Add More Categories
Edit `lib/prompt-generator.ts` to add new prompt categories:

```typescript
// Category 11: Your New Category
prompts.push(
  { text: `Your custom prompt for ${name}`, category: 'custom-category' },
  // Add more prompts...
);
```

### Adjust Prompt Counts
Modify the number of prompts per category by changing the slice ranges or loops in the generator.

### Add ICP Field
To use the ICP (Ideal Customer Profile) field:

1. Add ICP field to company data structure
2. Pass it to the prompt generator
3. It will automatically generate target-audience-specific prompts

## Integration Flow

1. **User enters URL** → Website scraped
2. **Company info extracted** → Name, industry, products identified
3. **User adds competitors** → Competitor list populated
4. **Click "Analyze"** → 100 prompts automatically generated
5. **Analysis runs** → Each prompt tested across all AI providers
6. **Results displayed** → Brand visibility score calculated

## Performance

- **Generation time**: < 10ms (instant)
- **Memory footprint**: Minimal (~20KB for 100 prompts)
- **Analysis time**: Depends on AI provider API speed (typically 30-60 seconds for 100 prompts)

## Future Enhancements

- [ ] Dynamic prompt weighting based on industry
- [ ] ML-based prompt optimization
- [ ] User-customizable prompt templates
- [ ] A/B testing different prompt strategies
- [ ] Localization for international markets
- [ ] Industry-specific prompt libraries
