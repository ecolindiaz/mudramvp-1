/**
 * Create a Scale AI brand profile and generate prompts
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  try {
    console.log('🚀 Setting up Scale AI brand profile...')
    
    // Create or update Scale AI brand profile
    const profile = await prisma.brandProfile.upsert({
      where: { id: 1 },
      update: {
        companyName: 'Scale AI',
        companyDescription: 'Scale AI is the data platform for AI, providing high-quality training data and human feedback for machine learning models. We help companies build, deploy, and improve their AI applications with enterprise-grade data labeling, RLHF, and model evaluation.',
        companyIndustry: 'AI/ML Data Platform',
        companyWebsite: 'https://scale.com',
        companyServices: 'Data labeling, RLHF, Model evaluation, Generative AI data, Computer vision, NLP, LLM fine-tuning',
        companyICP: 'AI/ML engineers, Data scientists, AI product teams at startups and enterprises',
        competitors: 'Labelbox, Snorkel AI, V7, Sama, SuperAnnotate',
        monthlySearchVolume: 'High',
        aiRecommendations: 'Improve technical documentation, Create more use-case content',
        stage: 'Growth',
        resources: 'Enterprise',
      },
      create: {
        companyName: 'Scale AI',
        companyDescription: 'Scale AI is the data platform for AI, providing high-quality training data and human feedback for machine learning models. We help companies build, deploy, and improve their AI applications with enterprise-grade data labeling, RLHF, and model evaluation.',
        companyIndustry: 'AI/ML Data Platform',
        companyWebsite: 'https://scale.com',
        companyServices: 'Data labeling, RLHF, Model evaluation, Generative AI data, Computer vision, NLP, LLM fine-tuning',
        companyICP: 'AI/ML engineers, Data scientists, AI product teams at startups and enterprises',
        competitors: 'Labelbox, Snorkel AI, V7, Sama, SuperAnnotate',
        monthlySearchVolume: 'High',
        aiRecommendations: 'Improve technical documentation, Create more use-case content',
        stage: 'Growth',
        resources: 'Enterprise',
      }
    })
    
    console.log(`✅ Brand profile created/updated: ${profile.companyName} (ID: ${profile.id})`)
    
    // Now generate prompts via API
    console.log('\n🎯 Generating prompts via API...')
    const response = await fetch('http://localhost:3000/api/campaigns/generate-prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandProfileId: 1 })
    })
    
    const result = await response.json()
    
    if (result.success) {
      console.log(`✅ Generated ${result.prompts} prompts`)
      console.log('\nBreakdown:')
      result.breakdown.forEach(cat => {
        console.log(`  - ${cat.category}: ${cat.count} prompts`)
      })
    } else {
      console.error('❌ Failed to generate prompts:', result.error)
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

