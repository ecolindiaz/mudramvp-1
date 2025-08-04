// Script to seed the Firegeo database with sample data
import { db } from './lib/db.js';
import { brandAnalyses, conversations, messages, userProfile } from './lib/db/schema.js';

async function seedDatabase() {
  console.log('🌱 Seeding Firegeo database with sample data...');
  
  try {
    // Create a test user profile
    const testUserId = 'test-user-firegeo';
    
    console.log('👤 Creating user profile...');
    await db.insert(userProfile).values({
      userId: testUserId,
      displayName: 'Test User',
      bio: 'Sample user for testing Firegeo metrics'
    }).onConflictDoNothing();

    // Create sample brand analyses
    console.log('🏢 Creating brand analyses...');
    const analysisData = {
      visibilityScore: 75.5,
      totalMentions: 12,
      competitorComparison: {
        'Competitor A': { score: 82.3, mentions: 15 },
        'Competitor B': { score: 68.9, mentions: 8 }
      },
      providerBreakdown: {
        'OpenAI': { queries: 45, avgPosition: 2.8, mentions: 7 },
        'Anthropic': { queries: 32, avgPosition: 3.1, mentions: 3 },
        'Google': { queries: 28, avgPosition: 3.5, mentions: 2 }
      }
    };

    const competitors = ['Competitor A', 'Competitor B', 'Competitor C'];
    
    for (let i = 0; i < 5; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i * 7); // Weekly intervals
      
      await db.insert(brandAnalyses).values({
        userId: testUserId,
        url: 'https://example.com',
        companyName: 'Sample Company',
        industry: 'Technology',
        analysisData: {
          ...analysisData,
          visibilityScore: 70 + (Math.random() * 20), // Vary the score
          date: date.toISOString()
        },
        competitors: competitors,
        creditsUsed: 10,
        createdAt: date,
        updatedAt: date
      });
    }

    // Create sample conversations and messages
    console.log('💬 Creating conversations and messages...');
    for (let i = 0; i < 3; i++) {
      const conversation = await db.insert(conversations).values({
        userId: testUserId,
        title: `AI Conversation ${i + 1}`,
        lastMessageAt: new Date(),
      }).returning();

      // Add messages to each conversation
      for (let j = 0; j < 5; j++) {
        await db.insert(messages).values({
          conversationId: conversation[0].id,
          userId: testUserId,
          role: j % 2 === 0 ? 'user' : 'assistant',
          content: j % 2 === 0 ? 
            `Sample question about brand visibility ${j + 1}` : 
            `AI response mentioning the brand and competitors ${j + 1}`,
          tokenCount: 50 + Math.floor(Math.random() * 100),
        });
      }
    }

    console.log('✅ Database seeded successfully!');
    console.log('📊 Created:');
    console.log('  - 1 user profile');
    console.log('  - 5 brand analyses');
    console.log('  - 3 conversations');
    console.log('  - 15 messages');
    console.log('');
    console.log('🎯 Now your AI Visibility dashboard should show real metrics!');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    process.exit(0);
  }
}

seedDatabase();
