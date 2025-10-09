import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface CreateTasksRequest {
  siteId: string;
  recommendations: string[];
  brandName?: string;
  overallScore?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateTasksRequest = await request.json();
    const { siteId, recommendations, brandName, overallScore } = body;

    if (!siteId || !recommendations || recommendations.length === 0) {
      return NextResponse.json(
        { success: false, error: 'siteId and recommendations are required' },
        { status: 400 }
      );
    }

    // Verify site exists
    const site = await prisma.site.findUnique({
      where: { id: siteId }
    });

    if (!site) {
      return NextResponse.json(
        { success: false, error: 'Site not found' },
        { status: 404 }
      );
    }

    // Create tasks from recommendations
    const createdTasks = await Promise.all(
      recommendations.map(async (recommendation, index) => {
        // Generate a unique template key based on the recommendation
        const templateKey = `ai-visibility-rec-${Date.now()}-${index}`;
        
        // Determine impact based on overall score
        let impact = 'medium';
        let confidence = 0.7;
        
        if (overallScore !== undefined) {
          if (overallScore < 40) {
            impact = 'high';
            confidence = 0.85;
          } else if (overallScore < 70) {
            impact = 'medium';
            confidence = 0.75;
          } else {
            impact = 'low';
            confidence = 0.65;
          }
        }

        // Create task
        return prisma.task.create({
          data: {
            siteId,
            templateKey,
            title: `Improve AI Visibility: ${recommendation.substring(0, 60)}${recommendation.length > 60 ? '...' : ''}`,
            whyItMatters: `This recommendation was generated from AI visibility analysis${brandName ? ` for ${brandName}` : ''}. Current visibility score: ${overallScore || 'N/A'}/100.`,
            impact,
            steps: [
              {
                step: 1,
                description: recommendation,
                status: 'pending'
              },
              {
                step: 2,
                description: 'Test changes and verify improved AI visibility',
                status: 'pending'
              },
              {
                step: 3,
                description: 'Monitor AI response mentions over the next week',
                status: 'pending'
              }
            ],
            tags: ['ai-visibility', 'seo', 'content-optimization'],
            evidence: {
              source: 'AI Visibility Analysis',
              recommendation,
              timestamp: new Date().toISOString(),
              visibilityScore: overallScore
            },
            suggestedOwner: 'Content Team',
            confidence,
            status: 'open'
          }
        });
      })
    );

    console.log(`✅ Created ${createdTasks.length} tasks from AI recommendations for site ${siteId}`);

    return NextResponse.json({
      success: true,
      data: {
        tasks: createdTasks,
        count: createdTasks.length
      }
    });

  } catch (error) {
    console.error('❌ Error creating tasks from recommendations:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create tasks'
      },
      { status: 500 }
    );
  }
}
