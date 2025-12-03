const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPrompt461() {
  try {
    console.log('Checking prompt 461 details...\n');
    
    // Find the GEO analysis result with prompt test id 461
    const results = await prisma.geoAnalysisResult.findMany({
      where: {
        promptTests: {
          path: '$',
          array_contains: [{
            id: 461
          }]
        }
      },
      select: {
        id: true,
        brandProfileId: true,
        promptTests: true,
      }
    });

    if (results.length === 0) {
      console.log('No results found with prompt test 461');
      return;
    }

    console.log(`Found ${results.length} result(s) containing prompt test 461\n`);

    for (const result of results) {
      const promptTests = Array.isArray(result.promptTests) ? result.promptTests : [];
      const test461 = promptTests.find(t => t.id === 461);

      if (test461) {
        console.log('=== Prompt Test 461 ===');
        console.log('ID:', test461.id);
        console.log('Prompt:', test461.prompt);
        console.log('\nBrand Mentioned:', test461.brandMentioned);
        console.log('Brand Position:', test461.brandPosition);
        console.log('\n=== FULL RESPONSE TEXT ===');
        console.log(test461.response);
        console.log('\n=== END RESPONSE ===\n');
        
        // Check if "Mudra" or "mudra" appears in the response
        const responseText = test461.response || '';
        const mudraLower = responseText.toLowerCase();
        const mudraCount = (mudraLower.match(/mudra/g) || []).length;
        
        console.log(`Occurrences of "mudra" (case-insensitive): ${mudraCount}`);
        
        if (mudraCount > 0) {
          console.log('\nContexts where "mudra" appears:');
          const lines = responseText.split('\n');
          lines.forEach((line, i) => {
            if (line.toLowerCase().includes('mudra')) {
              console.log(`Line ${i + 1}: ${line}`);
            }
          });
        }
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPrompt461();
