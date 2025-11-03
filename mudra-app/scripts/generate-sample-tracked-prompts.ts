/**
 * Generate Sample Tracked Prompts
 * 
 * Creates realistic sample prompts with analysis results for testing the deep view UI
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Sample prompt templates by category
const promptTemplates = {
  Organic: [
    "Best project management tools for startups in 2025",
    "How to improve team productivity in remote work",
    "Top CRM solutions for small businesses",
    "What are the most effective marketing automation tools",
    "Best practices for agile project management",
    "How to choose the right analytics platform",
    "Comparing different email marketing services",
    "What collaboration tools do tech companies use",
    "How to optimize workflow management",
    "Best customer support software for SaaS",
  ],
  Competitor: [
    "Asana vs Monday vs ClickUp comparison",
    "Salesforce alternatives for startups",
    "HubSpot vs Marketo which is better",
    "Slack vs Microsoft Teams features",
    "Trello vs Notion for project management",
    "Zendesk vs Intercom pricing comparison",
    "Mailchimp vs Constant Contact review",
    "Jira vs Linear for software teams",
    "Airtable vs Smartsheet comparison",
    "Pipedrive vs Close CRM differences",
  ],
  "How-to": [
    "How to set up automated workflows",
    "How to integrate third-party APIs",
    "How to create custom dashboards",
    "How to automate customer onboarding",
    "How to track project milestones",
    "How to implement team collaboration features",
    "How to set up role-based permissions",
    "How to configure email notifications",
    "How to export data for analysis",
    "How to customize reporting templates",
  ],
  "Brand-Specific": [
    "What is [Brand] and how does it work",
    "[Brand] pricing and plans explained",
    "[Brand] integrations and API capabilities",
    "[Brand] customer reviews and testimonials",
    "Getting started with [Brand] tutorial",
    "[Brand] enterprise features overview",
    "[Brand] mobile app functionality",
    "[Brand] security and compliance features",
    "[Brand] customer success stories",
    "[Brand] vs competitors feature comparison",
  ],
};

// AI Models to rotate through
const aiModels = [
  'ChatGPT-4',
  'Claude 3',
  'Gemini Pro',
  'Perplexity',
  'Copilot',
];

// Sentiments with weighted probabilities
const sentiments = ['Positive', 'Neutral', 'Negative'] as const;
const sentimentWeights = [0.6, 0.3, 0.1]; // 60% positive, 30% neutral, 10% negative

// Generate realistic analysis response
function generateAnalysisResponse(promptText: string, brandName: string, sentiment: string, position: number | null): string {
  const responses = {
    Positive: [
      `${brandName} is an excellent choice for this use case. It offers comprehensive features including advanced analytics, seamless integrations, and exceptional user experience. Many teams have successfully implemented ${brandName} to streamline their workflows and improve productivity.`,
      `Based on extensive user reviews, ${brandName} stands out in this category. The platform provides robust functionality, intuitive design, and strong customer support. Companies using ${brandName} report significant improvements in efficiency and team collaboration.`,
      `${brandName} is highly recommended by industry experts. It combines powerful features with ease of use, making it ideal for teams of all sizes. The platform's regular updates and responsive support team ensure continued value for users.`,
    ],
    Neutral: [
      `There are several good options in this space, including ${brandName}, Competitor A, and Competitor B. Each has its strengths depending on your specific needs and budget. ${brandName} offers solid features for mid-sized teams.`,
      `When comparing solutions, ${brandName} is one option worth considering alongside others. It provides standard features expected in this category and has a growing user base. The choice depends on your specific requirements.`,
      `${brandName} is available as one of many tools in this category. It offers a range of features suitable for various use cases. Consider evaluating multiple options to find the best fit for your organization.`,
    ],
    Negative: [
      `While ${brandName} exists in this market, many users report limitations in key areas. Alternative solutions like Competitor X may offer more comprehensive features for similar use cases.`,
      `${brandName} has some functionality in this area, but users often cite concerns about usability and feature completeness. Consider exploring other established platforms with stronger track records.`,
      `There are more established players in this space that might better serve your needs. ${brandName} is relatively limited compared to industry leaders in terms of features and integrations.`,
    ],
  };

  const responseArray = responses[sentiment as keyof typeof responses];
  const randomResponse = responseArray[Math.floor(Math.random() * responseArray.length)];
  
  return randomResponse;
}

// Generate competitive landscape
function generateCompetitiveLandscape(brandName: string, position: number | null) {
  const competitors = ['Competitor A', 'Competitor B', 'Competitor C', 'Competitor D', 'Competitor E'];
  
  if (position === null) {
    return {
      mentioned: [competitors[0], competitors[1], competitors[2]],
      notMentioned: [brandName],
      totalMentioned: 3,
    };
  }
  
  const mentioned = [...competitors.slice(0, position), brandName, ...competitors.slice(position, 4)].slice(0, 5);
  
  return {
    mentioned,
    notMentioned: [],
    totalMentioned: mentioned.length,
  };
}

// Weighted random selection
function weightedRandom(items: readonly any[], weights: number[]): any {
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;
  
  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return items[i];
    }
  }
  
  return items[items.length - 1];
}

async function generateSamplePrompts(brandProfileId: number, brandName: string = 'MudraAI') {
  console.log(`🚀 Generating sample tracked prompts for Brand Profile ID: ${brandProfileId}`);
  
  const allPrompts: any[] = [];
  const allAnalysisResults: any[] = [];
  
  // Generate prompts for each category
  for (const [category, templates] of Object.entries(promptTemplates)) {
    console.log(`\n📝 Generating ${templates.length} ${category} prompts...`);
    
    for (let i = 0; i < templates.length; i++) {
      const promptText = templates[i].replace(/\[Brand\]/g, brandName);
      
      // Create prompt in database
      const prompt = await prisma.prompt.create({
        data: {
          brandProfileId,
          text: promptText,
          category,
          isCustom: false,
          isActive: true,
        },
      });
      
      allPrompts.push(prompt);
      
      // Generate analysis result for this prompt
      const model = aiModels[Math.floor(Math.random() * aiModels.length)];
      const sentiment = weightedRandom(sentiments, sentimentWeights);
      
      // Determine brand position (40% chance of being mentioned)
      const brandMentioned = Math.random() < 0.4;
      const position = brandMentioned ? Math.floor(Math.random() * 5) + 1 : null;
      const visibility = brandMentioned ? Math.round((6 - (position || 6)) * 20) : 0;
      
      const response = generateAnalysisResponse(promptText, brandName, sentiment, position);
      const landscape = generateCompetitiveLandscape(brandName, position);
      
      const analysisResult = {
        promptId: prompt.id,
        prompt: promptText,
        model,
        provider: model.split('-')[0] || model,
        response,
        brandMentioned,
        brandPosition: position,
        sentiment: sentiment.toLowerCase(),
        visibility,
        competitiveLandscape: landscape,
        citationQuality: brandMentioned ? Math.random() * 5 : 0,
        contextRelevance: 3 + Math.random() * 2,
        timestamp: new Date().toISOString(),
      };
      
      allAnalysisResults.push(analysisResult);
      
      console.log(`  ✅ ${i + 1}. ${promptText.slice(0, 60)}... (Visibility: ${visibility}%, Position: ${position || 'N/A'})`);
    }
  }
  
  console.log(`\n📊 Creating GeoAnalysisResult record...`);
  
  // Create a single GeoAnalysisResult with all prompt analyses
  const avgVisibility = allAnalysisResults.reduce((sum, r) => sum + r.visibility, 0) / allAnalysisResults.length;
  
  const geoAnalysisResult = await prisma.geoAnalysisResult.create({
    data: {
      brandProfileId,
      overallScore: Math.round(avgVisibility),
      analyses: allAnalysisResults,
      summary: {
        totalPrompts: allPrompts.length,
        brandMentions: allAnalysisResults.filter(r => r.brandMentioned).length,
        averageVisibility: Math.round(avgVisibility),
        averagePosition: allAnalysisResults
          .filter(r => r.brandPosition !== null)
          .reduce((sum, r) => sum + (r.brandPosition || 0), 0) / 
          allAnalysisResults.filter(r => r.brandPosition !== null).length || 0,
        sentimentDistribution: {
          positive: allAnalysisResults.filter(r => r.sentiment === 'positive').length,
          neutral: allAnalysisResults.filter(r => r.sentiment === 'neutral').length,
          negative: allAnalysisResults.filter(r => r.sentiment === 'negative').length,
        },
      },
      timestamp: new Date(),
    },
  });
  
  console.log(`\n✨ Sample data generated successfully!`);
  console.log(`\n📈 Summary:`);
  console.log(`   - Total Prompts: ${allPrompts.length}`);
  console.log(`   - Brand Mentions: ${allAnalysisResults.filter(r => r.brandMentioned).length}/${allPrompts.length}`);
  console.log(`   - Average Visibility: ${Math.round(avgVisibility)}%`);
  console.log(`   - Sentiment Distribution:`);
  console.log(`     • Positive: ${allAnalysisResults.filter(r => r.sentiment === 'positive').length}`);
  console.log(`     • Neutral: ${allAnalysisResults.filter(r => r.sentiment === 'neutral').length}`);
  console.log(`     • Negative: ${allAnalysisResults.filter(r => r.sentiment === 'negative').length}`);
  
  return {
    prompts: allPrompts,
    analysisResult: geoAnalysisResult,
  };
}

// Main execution
async function main() {
  try {
    // Get the first brand profile or create one
    let brandProfile = await prisma.brandProfile.findFirst();
    
    if (!brandProfile) {
      console.log('⚠️  No brand profiles found. Creating a sample brand profile...');
      
      // Create a sample user first (if needed)
      let user = await prisma.user.findFirst();
      if (!user) {
        user = await prisma.user.create({
          data: {
            id: 'sample-user-' + Date.now(),
            email: 'demo@mudraai.com',
            name: 'Demo User',
          },
        });
      }
      
      brandProfile = await prisma.brandProfile.create({
        data: {
          userId: user.id,
          brandName: 'MudraAI',
          brandDescription: 'AI-powered platform for improving AI visibility and citations',
          website: 'https://mudraai.com',
          industry: 'Technology',
          targetAudience: 'Startups and enterprises looking to improve AI presence',
          competitors: JSON.stringify(['Competitor A', 'Competitor B', 'Competitor C']),
          uniqueValueProposition: 'First platform dedicated to GEO (Generative Engine Optimization)',
        },
      });
      
      console.log(`✅ Created brand profile: ${brandProfile.brandName} (ID: ${brandProfile.id})`);
    }
    
    console.log(`\n🎯 Using Brand Profile: ${brandProfile.brandName} (ID: ${brandProfile.id})`);
    
    // Check if prompts already exist
    const existingPrompts = await prisma.prompt.count({
      where: { brandProfileId: brandProfile.id },
    });
    
    if (existingPrompts > 0) {
      console.log(`\n⚠️  Found ${existingPrompts} existing prompts. Delete them first? (Y/n)`);
      console.log('   Run: npx prisma db execute --sql "DELETE FROM prompts WHERE brand_profile_id = ${brandProfile.id};"');
      console.log('   Or continue to add more prompts...');
    }
    
    // Generate sample prompts
    await generateSamplePrompts(brandProfile.id, brandProfile.brandName);
    
  } catch (error) {
    console.error('❌ Error generating sample prompts:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });










