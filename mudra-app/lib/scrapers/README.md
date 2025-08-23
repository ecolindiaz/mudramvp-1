# Enhanced GEO Scraper Integration Guide

## 🎯 Overview

The Enhanced GEO Scraper is a comprehensive technical analysis tool that evaluates websites for Generative Engine Optimization (GEO) - how well they're optimized to be mentioned by AI systems like ChatGPT, Perplexity, and Claude.

### What it Does
- **Analyzes 6 core GEO metrics** with detailed scoring (0-100)
- **Extracts structured data** (JSON-LD, microdata, schema markup)
- **Recognizes entities** (organizations, people, technologies, products)
- **Evaluates FAQ optimization** for AI voice responses  
- **Assesses content freshness** signals
- **Measures technical accessibility** for AI crawlers

### Why it Matters
- AI engines favor well-structured, authoritative, fresh content
- Proper schema markup helps AI understand and cite your content
- FAQ optimization directly impacts voice search results
- Content authority signals increase mention probability

---

## 🏗️ Technical Architecture

```
Enhanced GEO Scraper Flow:
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend UI   │───▶│   API Routes     │───▶│   Service Layer │
│   (Analysis)    │    │   (/api/geo)     │    │   (geo.service) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                        │
                       ┌─────────────────┐              │
                       │   Database      │◀─────────────┘
                       │   (Prisma)      │
                       └─────────────────┘
                                ▲
                       ┌─────────────────┐
                       │  GEO Scraper    │
                       │  (Firecrawl)    │
                       └─────────────────┘
```

---

## 📊 GEO Score Breakdown

### Overall Score Calculation (0-100)
```typescript
overall = (
  contentAuthority * 0.25 +      // 25% - Statistics, citations, testimonials
  technicalAccessibility * 0.20 + // 20% - Meta tags, HTTPS, accessibility  
  structuredData * 0.20 +         // 20% - JSON-LD, schema markup
  entityRecognition * 0.15 +      // 15% - Organizations, technologies
  faqOptimization * 0.10 +        // 10% - FAQ sections, Q&A pairs
  contentFreshness * 0.10         // 10% - Publication dates, updates
)
```

### Individual Metrics
- **Content Authority**: Statistics, expert quotes, citations, testimonials
- **Technical Accessibility**: HTTPS, meta tags, mobile-friendly, Core Web Vitals
- **Structured Data**: JSON-LD schemas, microdata, organization/website markup
- **Entity Recognition**: Clear mentions of companies, people, technologies, products
- **FAQ Optimization**: FAQ sections, Q&A pairs, FAQ schema markup
- **Content Freshness**: Publication dates, last modified, update frequency

---

## 🗄️ Database Schema Integration

### 1. Add GEO Analysis Models to Prisma Schema

```prisma
// Add to prisma/schema.prisma

model GeoAnalysis {
  id        String   @id @default(cuid())
  websiteId String
  website   Website  @relation(fields: [websiteId], references: [id], onDelete: Cascade)
  
  // GEO Scores
  overallScore              Int
  contentAuthorityScore     Int
  technicalAccessibilityScore Int
  structuredDataScore       Int
  entityRecognitionScore    Int
  faqOptimizationScore     Int
  contentFreshnessScore    Int
  
  // Analysis Results (JSON)
  structuredData     Json
  entityRecognition  Json
  faqOptimization   Json
  contentFreshness  Json
  contentStructure  Json
  technicalAccessibility Json
  
  // Metadata
  analysisUrl   String
  rawData      Json    // Complete scraper output
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  
  @@map("geo_analyses")
}

// Update existing Website model
model Website {
  id               String           @id @default(cuid())
  url              String           @unique
  userId           String
  user             User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Existing relations
  technicalAnalyses TechnicalAnalysis[]
  
  // Add GEO analysis relation
  geoAnalyses      GeoAnalysis[]
  
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt
  
  @@map("websites")
}
```

### 2. Run Database Migration

```bash
# Generate migration
npx prisma migrate dev --name add-geo-analysis

# Generate Prisma client
npx prisma generate
```

---

## 🛠️ Service Layer Integration

### 1. Create GEO Analysis Service

Create `lib/services/geo-analysis.service.ts`:

```typescript
import { PrismaClient } from '@/lib/generated/prisma'
import { extractEnhancedGEOData, type EnhancedGEOResult } from '../scrapers/enhanced-geo-scraper'

const prisma = new PrismaClient()

export class GeoAnalysisService {
  
  /**
   * Run GEO analysis and save to database
   */
  static async analyzeWebsite(websiteId: string): Promise<GeoAnalysis> {
    // Get website URL
    const website = await prisma.website.findUnique({
      where: { id: websiteId }
    })
    
    if (!website) {
      throw new Error('Website not found')
    }
    
    try {
      // Run enhanced GEO scraper
      console.log(`🔍 Starting GEO analysis for: ${website.url}`)
      const geoData = await extractEnhancedGEOData(website.url)
      
      // Save to database
      const analysis = await prisma.geoAnalysis.create({
        data: {
          websiteId,
          analysisUrl: website.url,
          
          // Scores
          overallScore: geoData.geoScore.overall,
          contentAuthorityScore: geoData.geoScore.contentAuthority,
          technicalAccessibilityScore: geoData.geoScore.technicalAccessibility,
          structuredDataScore: geoData.geoScore.structuredData,
          entityRecognitionScore: geoData.geoScore.entityRecognition,
          faqOptimizationScore: geoData.geoScore.faqOptimization,
          contentFreshnessScore: geoData.geoScore.contentFreshness,
          
          // Analysis data
          structuredData: geoData.structuredData,
          entityRecognition: geoData.entityRecognition,
          faqOptimization: geoData.faqOptimization,
          contentFreshness: geoData.contentFreshness,
          contentStructure: geoData.contentStructure,
          technicalAccessibility: geoData.technicalAccessibility,
          
          // Raw data for debugging
          rawData: geoData
        }
      })
      
      console.log(`✅ GEO analysis completed with score: ${geoData.geoScore.overall}/100`)
      return analysis
      
    } catch (error) {
      console.error('❌ GEO analysis failed:', error)
      throw new Error(`GEO analysis failed: ${error.message}`)
    }
  }
  
  /**
   * Get latest GEO analysis for website
   */
  static async getLatestAnalysis(websiteId: string): Promise<GeoAnalysis | null> {
    return prisma.geoAnalysis.findFirst({
      where: { websiteId },
      orderBy: { createdAt: 'desc' }
    })
  }
  
  /**
   * Get GEO analysis history
   */
  static async getAnalysisHistory(websiteId: string): Promise<GeoAnalysis[]> {
    return prisma.geoAnalysis.findMany({
      where: { websiteId },
      orderBy: { createdAt: 'desc' }
    })
  }
  
  /**
   * Re-analyze website (create new analysis)
   */
  static async reanalyzeWebsite(websiteId: string): Promise<GeoAnalysis> {
    console.log(`🔄 Re-analyzing website: ${websiteId}`)
    return this.analyzeWebsite(websiteId)
  }
}

export type { GeoAnalysis } from '@/lib/generated/prisma'
```

---

## 🌐 API Routes Integration

### 1. Main GEO Analysis Route

Create `app/api/geo-analysis/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { GeoAnalysisService } from '@/lib/services/geo-analysis.service'

export async function POST(request: NextRequest) {
  try {
    const { websiteId } = await request.json()
    
    if (!websiteId) {
      return NextResponse.json(
        { success: false, error: { message: 'Website ID is required', code: 'MISSING_WEBSITE_ID' } },
        { status: 400 }
      )
    }
    
    // Run GEO analysis
    const analysis = await GeoAnalysisService.analyzeWebsite(websiteId)
    
    return NextResponse.json({
      success: true,
      data: analysis
    })
    
  } catch (error) {
    console.error('GEO analysis API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          message: error.message || 'GEO analysis failed', 
          code: 'ANALYSIS_FAILED' 
        } 
      },
      { status: 500 }
    )
  }
}
```

### 2. Website-Specific Routes

Create `app/api/geo-analysis/[websiteId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { GeoAnalysisService } from '@/lib/services/geo-analysis.service'

// GET latest GEO analysis
export async function GET(
  request: NextRequest,
  { params }: { params: { websiteId: string } }
) {
  try {
    const analysis = await GeoAnalysisService.getLatestAnalysis(params.websiteId)
    
    if (!analysis) {
      return NextResponse.json(
        { success: false, error: { message: 'No GEO analysis found', code: 'NOT_FOUND' } },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      data: analysis
    })
    
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: error.message, code: 'FETCH_FAILED' } },
      { status: 500 }
    )
  }
}
```

Create `app/api/geo-analysis/[websiteId]/reanalyze/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { GeoAnalysisService } from '@/lib/services/geo-analysis.service'

export async function POST(
  request: NextRequest,
  { params }: { params: { websiteId: string } }
) {
  try {
    const analysis = await GeoAnalysisService.reanalyzeWebsite(params.websiteId)
    
    return NextResponse.json({
      success: true,
      data: analysis
    })
    
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: error.message, code: 'REANALYSIS_FAILED' } },
      { status: 500 }
    )
  }
}
```

### 3. History Route

Create `app/api/geo-analysis/[websiteId]/history/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { GeoAnalysisService } from '@/lib/services/geo-analysis.service'

export async function GET(
  request: NextRequest,
  { params }: { params: { websiteId: string } }
) {
  try {
    const history = await GeoAnalysisService.getAnalysisHistory(params.websiteId)
    
    return NextResponse.json({
      success: true,
      data: history
    })
    
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: error.message, code: 'HISTORY_FETCH_FAILED' } },
      { status: 500 }
    )
  }
}
```

---

## 🎨 Frontend Components

### 1. GEO Score Card Component

Create `components/dashboard/geo-score-card.tsx`:

```typescript
"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import type { GeoAnalysis } from '@/lib/services/geo-analysis.service'

interface GeoScoreCardProps {
  analysis: GeoAnalysis
}

export function GeoScoreCard({ analysis }: GeoScoreCardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500'
    if (score >= 60) return 'bg-yellow-500'
    return 'bg-red-500'
  }
  
  const getScoreBadge = (score: number) => {
    if (score >= 80) return 'success'
    if (score >= 60) return 'warning'
    return 'destructive'
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          GEO Visibility Score
          <Badge variant={getScoreBadge(analysis.overallScore)}>
            {analysis.overallScore}/100
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Score */}
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium">Overall Score</span>
            <span className="text-sm text-muted-foreground">{analysis.overallScore}/100</span>
          </div>
          <Progress value={analysis.overallScore} className="h-2" />
        </div>
        
        {/* Individual Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-xs">Content Authority</span>
              <span className="text-xs">{analysis.contentAuthorityScore}/100</span>
            </div>
            <Progress value={analysis.contentAuthorityScore} className="h-1" />
          </div>
          
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-xs">Technical Access</span>
              <span className="text-xs">{analysis.technicalAccessibilityScore}/100</span>
            </div>
            <Progress value={analysis.technicalAccessibilityScore} className="h-1" />
          </div>
          
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-xs">Structured Data</span>
              <span className="text-xs">{analysis.structuredDataScore}/100</span>
            </div>
            <Progress value={analysis.structuredDataScore} className="h-1" />
          </div>
          
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-xs">Entity Recognition</span>
              <span className="text-xs">{analysis.entityRecognitionScore}/100</span>
            </div>
            <Progress value={analysis.entityRecognitionScore} className="h-1" />
          </div>
          
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-xs">FAQ Optimization</span>
              <span className="text-xs">{analysis.faqOptimizationScore}/100</span>
            </div>
            <Progress value={analysis.faqOptimizationScore} className="h-1" />
          </div>
          
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-xs">Content Freshness</span>
              <span className="text-xs">{analysis.contentFreshnessScore}/100</span>
            </div>
            <Progress value={analysis.contentFreshnessScore} className="h-1" />
          </div>
        </div>
        
        <div className="text-xs text-muted-foreground">
          Last analyzed: {new Date(analysis.createdAt).toLocaleDateString()}
        </div>
      </CardContent>
    </Card>
  )
}
```

### 2. GEO Analysis Details Component

Create `components/dashboard/geo-analysis-details.tsx`:

```typescript
"use client"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown } from 'lucide-react'
import type { GeoAnalysis } from '@/lib/services/geo-analysis.service'

interface GeoAnalysisDetailsProps {
  analysis: GeoAnalysis
}

export function GeoAnalysisDetails({ analysis }: GeoAnalysisDetailsProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})
  
  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }))
  }
  
  const structuredData = analysis.structuredData as any
  const entityRecognition = analysis.entityRecognition as any
  const faqOptimization = analysis.faqOptimization as any
  const contentFreshness = analysis.contentFreshness as any
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>GEO Analysis Details</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="structured-data" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="structured-data">Structured Data</TabsTrigger>
            <TabsTrigger value="entities">Entities</TabsTrigger>
            <TabsTrigger value="faq">FAQ</TabsTrigger>
            <TabsTrigger value="freshness">Freshness</TabsTrigger>
          </TabsList>
          
          <TabsContent value="structured-data" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Schema Types Found</h4>
                <div className="flex flex-wrap gap-2">
                  {structuredData?.schemaTypes?.map((type: string, i: number) => (
                    <Badge key={i} variant="outline">{type}</Badge>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">JSON-LD Scripts</h4>
                <p className="text-sm text-muted-foreground">
                  {structuredData?.jsonLd?.length || 0} scripts detected
                </p>
              </div>
            </div>
            
            <Collapsible 
              open={openSections['json-ld']} 
              onOpenChange={() => toggleSection('json-ld')}
            >
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium">
                <ChevronDown className="h-4 w-4" />
                View JSON-LD Details
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-48">
                  {JSON.stringify(structuredData?.jsonLd, null, 2)}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          </TabsContent>
          
          <TabsContent value="entities" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Organizations ({entityRecognition?.organizations?.length || 0})</h4>
                <div className="space-y-1 max-h-32 overflow-auto">
                  {entityRecognition?.organizations?.map((org: string, i: number) => (
                    <Badge key={i} variant="secondary" className="mr-1 mb-1">{org}</Badge>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Technologies ({entityRecognition?.technologies?.length || 0})</h4>
                <div className="space-y-1 max-h-32 overflow-auto">
                  {entityRecognition?.technologies?.map((tech: string, i: number) => (
                    <Badge key={i} variant="outline" className="mr-1 mb-1">{tech}</Badge>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">People ({entityRecognition?.people?.length || 0})</h4>
                <div className="space-y-1 max-h-32 overflow-auto">
                  {entityRecognition?.people?.map((person: string, i: number) => (
                    <Badge key={i} variant="secondary" className="mr-1 mb-1">{person}</Badge>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Products ({entityRecognition?.products?.length || 0})</h4>
                <div className="space-y-1 max-h-32 overflow-auto">
                  {entityRecognition?.products?.map((product: string, i: number) => (
                    <Badge key={i} variant="outline" className="mr-1 mb-1">{product}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="faq" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">FAQ Sections</h4>
                <p className="text-sm text-muted-foreground">
                  {faqOptimization?.faqSections?.length || 0} sections found
                </p>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">FAQ Schema</h4>
                <Badge variant={faqOptimization?.faqStructuredData ? "success" : "destructive"}>
                  {faqOptimization?.faqStructuredData ? "Present" : "Missing"}
                </Badge>
              </div>
            </div>
            
            {faqOptimization?.faqSections?.map((section: any, i: number) => (
              <div key={i} className="border rounded p-3">
                <h5 className="font-medium mb-2">{section.title}</h5>
                <p className="text-sm text-muted-foreground">{section.content}</p>
              </div>
            ))}
          </TabsContent>
          
          <TabsContent value="freshness" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Publish Date</h4>
                <p className="text-sm">{contentFreshness?.publishDate || 'Not found'}</p>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Last Modified</h4>
                <p className="text-sm">{contentFreshness?.lastModified || 'Not found'}</p>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Update Frequency</h4>
                <p className="text-sm">{contentFreshness?.updateFrequency || 'Unknown'}</p>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Freshness Signals</h4>
                <p className="text-sm">{contentFreshness?.freshnessSignals?.length || 0} signals</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
```

### 3. GEO Analysis Hook

Create `hooks/dashboard/use-geo-analysis.ts`:

```typescript
"use client"

import { useState, useEffect } from 'react'
import type { GeoAnalysis } from '@/lib/services/geo-analysis.service'

export function useGeoAnalysis(websiteId: string) {
  const [analysis, setAnalysis] = useState<GeoAnalysis | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const fetchAnalysis = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/geo-analysis/${websiteId}`)
      const result = await response.json()
      
      if (result.success) {
        setAnalysis(result.data)
      } else {
        setError(result.error.message)
      }
    } catch (err) {
      setError('Failed to fetch GEO analysis')
    } finally {
      setIsLoading(false)
    }
  }
  
  const runAnalysis = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/geo-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteId })
      })
      
      const result = await response.json()
      
      if (result.success) {
        setAnalysis(result.data)
      } else {
        setError(result.error.message)
      }
    } catch (err) {
      setError('Failed to run GEO analysis')
    } finally {
      setIsLoading(false)
    }
  }
  
  const reanalyze = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/geo-analysis/${websiteId}/reanalyze`, {
        method: 'POST'
      })
      
      const result = await response.json()
      
      if (result.success) {
        setAnalysis(result.data)
      } else {
        setError(result.error.message)
      }
    } catch (err) {
      setError('Failed to reanalyze website')
    } finally {
      setIsLoading(false)
    }
  }
  
  useEffect(() => {
    if (websiteId) {
      fetchAnalysis()
    }
  }, [websiteId])
  
  return {
    analysis,
    isLoading,
    error,
    runAnalysis,
    reanalyze,
    refetch: fetchAnalysis
  }
}
```

---

## 🚀 Integration Steps

### 1. Environment Setup

Ensure you have the required environment variable:

```bash
# Add to .env.local
FIRECRAWL_API_KEY=your_firecrawl_api_key_here
```

### 2. Database Migration

```bash
# Generate and apply migration
npx prisma migrate dev --name add-geo-analysis

# Generate Prisma client
npx prisma generate
```

### 3. Add to Dashboard Page

Update your dashboard page to include GEO analysis:

```typescript
// app/dashboard/page.tsx
import { GeoScoreCard } from '@/components/dashboard/geo-score-card'
import { GeoAnalysisDetails } from '@/components/dashboard/geo-analysis-details'
import { useGeoAnalysis } from '@/hooks/dashboard/use-geo-analysis'

export default function DashboardPage() {
  const { analysis, isLoading, runAnalysis, reanalyze } = useGeoAnalysis(websiteId)
  
  return (
    <div className="space-y-6">
      {/* Existing dashboard content */}
      
      {/* GEO Analysis Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {analysis && <GeoScoreCard analysis={analysis} />}
        {analysis && <GeoAnalysisDetails analysis={analysis} />}
      </div>
      
      {/* Analysis Actions */}
      <div className="flex gap-4">
        <Button onClick={runAnalysis} disabled={isLoading}>
          {isLoading ? 'Analyzing...' : 'Run GEO Analysis'}
        </Button>
        {analysis && (
          <Button onClick={reanalyze} variant="outline" disabled={isLoading}>
            Re-analyze
          </Button>
        )}
      </div>
    </div>
  )
}
```

---

## ⚠️ Important Considerations

### Rate Limits
- **Firecrawl Free Plan**: 10 requests/minute
- **Analysis takes 5-6 requests**: Allow 30+ seconds between analyses
- **Production**: Use paid plan for higher limits

### Error Handling
- Always implement try-catch blocks
- Log errors for debugging
- Show user-friendly error messages
- Implement retry logic for transient failures

### Performance
- GEO analysis takes 30-60 seconds to complete
- Show loading states in UI
- Consider background job processing for large-scale analyses
- Cache results for 24 hours to avoid unnecessary re-analysis

### Security
- Validate all inputs
- Sanitize URLs before processing
- Rate limit API endpoints
- Log analysis attempts for monitoring

---

## 🔧 Troubleshooting

### Common Issues

1. **"Invalid URL format"**
   - Ensure URL includes protocol (https://)
   - Check for special characters

2. **"FIRECRAWL_API_KEY not found"**
   - Add API key to .env.local
   - Restart development server

3. **"Rate limit exceeded"**
   - Wait 60 seconds between requests on free plan
   - Upgrade to paid plan for higher limits

4. **"Analysis timeout"**
   - Some websites take longer to analyze
   - Increase timeout in Firecrawl config

### Debug Mode

Enable debug logging by setting:

```bash
DEBUG=geo-scraper
```

---

## 📈 Next Steps

1. **Background Jobs**: Implement job queue for large-scale analysis
2. **Competitive Analysis**: Compare GEO scores across competitors  
3. **Historical Tracking**: Track score improvements over time
4. **Recommendations Engine**: Generate specific improvement suggestions
5. **Alerts**: Notify when scores drop significantly
6. **Export Reports**: Generate PDF reports for clients

This integration provides a complete GEO analysis system that helps users understand and improve their AI visibility! 🎯 

---

---

# 🔥 Firecrawl Basic Scraper Integration Guide

## 🎯 Overview

The Firecrawl Basic Scraper is a lightweight, efficient web scraping tool that extracts clean markdown content from any website. It's perfect for content analysis, competitor research, and data collection for your Mudra GEO platform.

### What it Does
- **Extracts clean markdown** from any website with human-level precision
- **Handles JavaScript-heavy sites** with proper wait times and timeouts
- **Supports both single-page and multi-page crawling**
- **Provides multiple output formats** (markdown, HTML, JSON)
- **Integrates seamlessly** with your existing Mudra infrastructure

### Why it Matters
- Quick content analysis for GEO optimization research
- Competitor content monitoring and analysis
- Bulk data collection for AI training and analysis
- Content quality assessment and benchmarking

---

## 🏗️ Architecture Overview

```
Firecrawl Scraper Architecture:
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│     CLI Tool    │    │   API Routes     │    │  Library Utils  │
│  (firecrawl-cli)│    │  (/api/scrape)   │    │  (firecrawl.ts) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         └────────────────────────▼────────────────────────┘
                           ┌─────────────────┐
                           │  Firecrawl API  │
                           │   (External)    │
                           └─────────────────┘
```

---

## 📁 File Structure

```
mudra-app/
├── lib/scrapers/
│   ├── firecrawl.ts              # Basic scraping utilities
│   └── enhanced-geo-scraper.ts   # Enhanced GEO analysis
├── lib/config/
│   └── firecrawl-config.ts       # Firecrawl configuration
├── app/api/
│   └── scrape/
│       └── route.ts              # Basic scraping API endpoint
├── scripts/
│   └── firecrawl-cli.ts          # Command-line interface
└── output/                       # Generated content files
```

---

## 🛠️ Installation & Setup

### 1. Environment Configuration

Add your Firecrawl API key to `.env.local`:

```bash
# Web Scraping
FIRECRAWL_API_KEY="your-firecrawl-api-key"
```

### 2. Dependencies

The scraper uses the existing Firecrawl dependency:

```json
{
  "dependencies": {
    "@mendable/firecrawl-js": "^3.1.0"
  }
}
```

### 3. API Key Setup

Get your API key from [Firecrawl](https://firecrawl.dev/) and add it to your environment.

---

## 🚀 Usage Methods

### 1. CLI Tool (Recommended for Development)

The CLI tool provides the most flexible way to test and use the scraper:

```bash
# Set your API key (one-time per session)
export FIRECRAWL_API_KEY="your-api-key"

# Basic scraping - output to terminal
npx tsx scripts/firecrawl-cli.ts https://example.com/ --only-main

# Save to file
npx tsx scripts/firecrawl-cli.ts https://example.com/ --only-main --out output/example.md

# Crawl multiple pages (site-wide)
npx tsx scripts/firecrawl-cli.ts https://example.com/ --crawl --limit 10 --out output/example-full.md

# Advanced options
npx tsx scripts/firecrawl-cli.ts https://example.com/ \
  --only-main \
  --timeout 30000 \
  --wait-for 2000 \
  --out output/example-optimized.md
```

#### CLI Options:
- `-c, --crawl` - Crawl entire site (multi-page)
- `-l, --limit <n>` - Max pages to crawl (default: 50)
- `-o, --out <path>` - Output file path (default: stdout)
- `--timeout <ms>` - Request timeout in ms (e.g., 30000)
- `--wait-for <ms>` - Wait before scraping to let JS load (e.g., 2000)
- `--only-main` - Only main content (default: false)
- `-h, --help` - Show help

### 2. API Endpoint (Production Use)

Use the REST API for programmatic access:

```bash
# Basic scraping
curl -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/",
    "onlyMainContent": true,
    "timeoutMs": 30000
  }'

# Multi-page crawling
curl -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/",
    "crawl": true,
    "limit": 5,
    "onlyMainContent": true
  }'
```

#### API Parameters:
- `url` (required) - Website URL to scrape
- `crawl` (optional) - Enable multi-page crawling
- `limit` (optional) - Max pages for crawling (default: 50)
- `timeoutMs` (optional) - Request timeout in milliseconds
- `waitForMs` (optional) - Wait time before scraping (for JS)
- `onlyMainContent` (optional) - Extract only main content

#### API Response:
```json
{
  "success": true,
  "data": {
    "markdown": "# Page Title\n\nContent here..."
  }
}
```

### 3. Direct Library Usage

Use the utility functions directly in your code:

```typescript
import { scrapeToMarkdown, crawlToMarkdown } from '@/lib/scrapers/firecrawl';

// Single page scraping
const content = await scrapeToMarkdown('https://example.com/', {
  onlyMainContent: true,
  timeoutMs: 30000,
  waitForMs: 2000
});

// Multi-page crawling
const fullSiteContent = await crawlToMarkdown('https://example.com/', {
  limit: 10,
  onlyMainContent: true,
  maxDepth: 2
});
```

---

## 🎨 Integration Examples

### 1. React Hook for Scraping

```typescript
// hooks/use-scraper.ts
import { useState } from 'react';

export function useScraper() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scrape = async (url: string, options = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, ...options })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setData(result.data.markdown);
      } else {
        setError(result.error.message);
      }
    } catch (err) {
      setError('Failed to scrape website');
    } finally {
      setLoading(false);
    }
  };

  return { scrape, loading, data, error };
}
```

### 2. Server Action Integration

```typescript
// app/actions/scrape.ts
'use server';

import { scrapeToMarkdown } from '@/lib/scrapers/firecrawl';

export async function scrapeWebsite(url: string) {
  try {
    const content = await scrapeToMarkdown(url, { 
      onlyMainContent: true,
      timeoutMs: 30000 
    });
    
    return { success: true, content };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Scraping failed' 
    };
  }
}
```

### 3. Competitor Analysis Service

```typescript
// lib/services/competitor-analysis.service.ts
import { scrapeToMarkdown } from '@/lib/scrapers/firecrawl';
import { extractEnhancedGEOData } from '@/lib/scrapers/enhanced-geo-scraper';

export class CompetitorAnalysisService {
  
  static async analyzeCompetitor(url: string) {
    try {
      // Get basic content
      const content = await scrapeToMarkdown(url, { onlyMainContent: true });
      
      // Get enhanced GEO analysis
      const geoAnalysis = await extractEnhancedGEOData(url);
      
      return {
        url,
        content,
        wordCount: content.split(' ').length,
        geoScore: geoAnalysis.geoScore.overall,
        analyzedAt: new Date().toISOString(),
        analysis: geoAnalysis
      };
    } catch (error) {
      throw new Error(`Competitor analysis failed: ${error.message}`);
    }
  }
  
  static async bulkAnalysis(urls: string[]) {
    const results = [];
    
    for (const url of urls) {
      try {
        const analysis = await this.analyzeCompetitor(url);
        results.push(analysis);
        
        // Rate limiting: wait 6 seconds between requests
        await new Promise(resolve => setTimeout(resolve, 6000));
      } catch (error) {
        results.push({
          url,
          error: error.message,
          analyzedAt: new Date().toISOString()
        });
      }
    }
    
    return results;
  }
}
```

### 4. Dashboard Component Integration

```typescript
// components/dashboard/scraper-widget.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useScraper } from '@/hooks/use-scraper';

export function ScraperWidget() {
  const [url, setUrl] = useState('');
  const { scrape, loading, data, error } = useScraper();

  const handleScrape = () => {
    if (url) {
      scrape(url, { onlyMainContent: true });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Content Scraper</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Enter website URL..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
          />
          <Button onClick={handleScrape} disabled={loading || !url}>
            {loading ? 'Scraping...' : 'Scrape'}
          </Button>
        </div>
        
        {error && (
          <div className="text-red-500 text-sm">
            Error: {error}
          </div>
        )}
        
        {data && (
          <div className="border rounded p-4 max-h-96 overflow-auto">
            <h4 className="font-medium mb-2">Scraped Content:</h4>
            <pre className="text-sm whitespace-pre-wrap">{data}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

---

## ⚙️ Configuration Options

### 1. Firecrawl Configuration

The scraper uses centralized configuration from `lib/config/firecrawl-config.ts`:

```typescript
// Default configuration
export const defaultScrapeOptions = {
  formats: ["markdown"],
  onlyMainContent: false,
  timeout: 120000  // 2 minutes
};

// Custom configuration for your use case
const customOptions = {
  formats: ["markdown"],
  onlyMainContent: true,    // Cleaner content extraction
  timeout: 30000,          // 30 seconds for faster responses
  waitFor: 2000            // Wait 2 seconds for JS to load
};
```

### 2. Rate Limiting

Firecrawl has rate limits based on your plan:

- **Free Plan**: 500 credits/month, 10 requests/minute
- **Starter Plan**: 10,000 credits/month, 100 requests/minute
- **Growth Plan**: 100,000 credits/month, 1,000 requests/minute

### 3. Optimization Settings

```typescript
// For fast, lightweight scraping
const fastOptions = {
  onlyMainContent: true,
  timeout: 15000,
  waitFor: 0
};

// For complex, JS-heavy sites
const thoroughOptions = {
  onlyMainContent: false,
  timeout: 60000,
  waitFor: 5000
};

// For bulk processing
const bulkOptions = {
  onlyMainContent: true,
  timeout: 30000,
  waitFor: 1000
};
```

---

## 🔧 Advanced Features

### 1. Bulk Processing Script

Create a script for bulk competitor analysis:

```bash
# Create a simple bulk processing script
cat > scripts/bulk-scrape.sh << 'EOF'
#!/bin/bash

# List of competitor URLs
URLS=(
  "https://competitor1.com"
  "https://competitor2.com" 
  "https://competitor3.com"
)

export FIRECRAWL_API_KEY="your-api-key"

# Create output directory
mkdir -p output/competitors

# Process each URL
for url in "${URLS[@]}"; do
  echo "Scraping: $url"
  domain=$(echo $url | sed 's/https:\/\///' | sed 's/\///' | sed 's/\./-/g')
  npx tsx scripts/firecrawl-cli.ts "$url" --only-main --out "output/competitors/$domain.md"
  echo "Waiting 6 seconds for rate limiting..."
  sleep 6
done

echo "Bulk scraping completed!"
EOF

chmod +x scripts/bulk-scrape.sh
```

### 2. Content Monitoring

Set up automated content monitoring:

```typescript
// lib/services/content-monitor.service.ts
import { scrapeToMarkdown } from '@/lib/scrapers/firecrawl';
import crypto from 'crypto';

export class ContentMonitorService {
  
  static async monitorChanges(url: string, previousHash?: string) {
    const content = await scrapeToMarkdown(url, { onlyMainContent: true });
    const currentHash = crypto.createHash('md5').update(content).digest('hex');
    
    const hasChanged = previousHash && previousHash !== currentHash;
    
    return {
      url,
      content,
      hash: currentHash,
      hasChanged,
      checkedAt: new Date().toISOString()
    };
  }
  
  static async scheduleMonitoring(urls: string[], intervalHours = 24) {
    setInterval(async () => {
      for (const url of urls) {
        try {
          const result = await this.monitorChanges(url);
          if (result.hasChanged) {
            console.log(`🔄 Content changed on: ${url}`);
            // Trigger notifications, update database, etc.
          }
        } catch (error) {
          console.error(`❌ Monitoring failed for ${url}:`, error);
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 6000));
      }
    }, intervalHours * 60 * 60 * 1000);
  }
}
```

### 3. Content Quality Analysis

Combine with AI for content quality scoring:

```typescript
// lib/services/content-quality.service.ts
import { scrapeToMarkdown } from '@/lib/scrapers/firecrawl';

export class ContentQualityService {
  
  static analyzeContent(content: string) {
    const lines = content.split('\n');
    const words = content.split(' ').filter(word => word.trim().length > 0);
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    return {
      wordCount: words.length,
      sentenceCount: sentences.length,
      paragraphCount: lines.filter(line => line.trim().length > 0).length,
      headingCount: lines.filter(line => line.startsWith('#')).length,
      listItemCount: lines.filter(line => line.startsWith('-') || line.startsWith('*')).length,
      averageWordsPerSentence: Math.round(words.length / sentences.length),
      readingTimeMinutes: Math.ceil(words.length / 200), // 200 WPM average
      
      // Content structure analysis
      hasIntroduction: content.includes('introduction') || content.includes('overview'),
      hasConclusion: content.includes('conclusion') || content.includes('summary'),
      hasCallToAction: content.toLowerCase().includes('contact') || content.toLowerCase().includes('try'),
      
      // SEO indicators
      titleCount: lines.filter(line => line.startsWith('# ')).length,
      linkCount: (content.match(/\[.*?\]\(.*?\)/g) || []).length,
      imageCount: (content.match(/!\[.*?\]\(.*?\)/g) || []).length
    };
  }
  
  static async analyzeCompetitorContent(url: string) {
    const content = await scrapeToMarkdown(url, { onlyMainContent: true });
    const quality = this.analyzeContent(content);
    
    return {
      url,
      content,
      quality,
      analyzedAt: new Date().toISOString()
    };
  }
}
```

---

## 🚨 Error Handling & Troubleshooting

### Common Issues & Solutions

1. **Rate Limit Exceeded**
   ```bash
   Error: Rate limit exceeded
   ```
   **Solution**: Wait 60 seconds or upgrade your Firecrawl plan

2. **Invalid URL Format**
   ```bash
   Error: Invalid URL format
   ```
   **Solution**: Ensure URL includes protocol (https://)

3. **Timeout Errors**
   ```bash
   Error: Request timeout
   ```
   **Solution**: Increase timeout or check if site is accessible

4. **API Key Issues**
   ```bash
   Error: FIRECRAWL_API_KEY is not set
   ```
   **Solution**: Add API key to environment variables

### Error Handling Best Practices

```typescript
// Robust error handling example
async function safeScrapingWrapper(url: string, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await scrapeToMarkdown(url, { 
        onlyMainContent: true,
        timeoutMs: 30000 
      });
    } catch (error) {
      console.warn(`Attempt ${attempt} failed for ${url}:`, error.message);
      
      if (attempt === retries) {
        throw new Error(`Failed to scrape ${url} after ${retries} attempts: ${error.message}`);
      }
      
      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

---

## 📊 Performance Optimization

### 1. Caching Strategy

```typescript
// lib/services/scraper-cache.service.ts
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 3600 }); // 1 hour cache

export class ScraperCacheService {
  
  static async getCachedContent(url: string): Promise<string | null> {
    return cache.get(url) || null;
  }
  
  static setCachedContent(url: string, content: string): void {
    cache.set(url, content);
  }
  
  static async scrapeWithCache(url: string, options = {}) {
    const cacheKey = `${url}-${JSON.stringify(options)}`;
    
    // Check cache first
    let content = this.getCachedContent(cacheKey);
    if (content) {
      console.log(`📦 Cache hit for: ${url}`);
      return content;
    }
    
    // Scrape and cache
    content = await scrapeToMarkdown(url, options);
    this.setCachedContent(cacheKey, content);
    console.log(`🔍 Cache miss, scraped: ${url}`);
    
    return content;
  }
}
```

### 2. Batch Processing

```typescript
// Process multiple URLs efficiently
export class BatchScrapingService {
  
  static async processBatch(urls: string[], batchSize = 5) {
    const results = [];
    
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (url, index) => {
        // Stagger requests to respect rate limits
        await new Promise(resolve => setTimeout(resolve, index * 1000));
        return this.scrapeWithRetry(url);
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults);
      
      // Wait between batches
      if (i + batchSize < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
    
    return results;
  }
  
  static async scrapeWithRetry(url: string, maxRetries = 2) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await scrapeToMarkdown(url, { onlyMainContent: true });
      } catch (error) {
        if (attempt === maxRetries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
      }
    }
  }
}
```

---

## 🔐 Security Considerations

### 1. URL Validation

```typescript
function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function sanitizeUrl(url: string): string {
  if (!validateUrl(url)) {
    throw new Error('Invalid URL format');
  }
  
  // Remove potentially dangerous characters
  return url.replace(/[<>'"]/g, '');
}
```

### 2. Rate Limiting

```typescript
// lib/middleware/rate-limit.ts
import { NextRequest } from 'next/server';

const rateLimitMap = new Map();

export function checkRateLimit(request: NextRequest, limit = 10, windowMs = 60000) {
  const ip = request.ip || 'unknown';
  const now = Date.now();
  
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }
  
  const userLimit = rateLimitMap.get(ip);
  
  if (now > userLimit.resetTime) {
    userLimit.count = 1;
    userLimit.resetTime = now + windowMs;
    return { allowed: true, remaining: limit - 1 };
  }
  
  if (userLimit.count >= limit) {
    return { allowed: false, remaining: 0 };
  }
  
  userLimit.count++;
  return { allowed: true, remaining: limit - userLimit.count };
}
```

---

## 📈 Integration with Mudra Platform

### 1. GEO Analysis Pipeline

```typescript
// Complete workflow combining basic scraping + GEO analysis
export class MudraAnalysisPipeline {
  
  static async fullAnalysis(url: string) {
    try {
      // Step 1: Basic content extraction
      console.log('🔍 Step 1: Extracting content...');
      const content = await scrapeToMarkdown(url, { onlyMainContent: true });
      
      // Step 2: Enhanced GEO analysis
      console.log('🎯 Step 2: Running GEO analysis...');
      const geoData = await extractEnhancedGEOData(url);
      
      // Step 3: Content quality analysis
      console.log('📊 Step 3: Analyzing content quality...');
      const quality = ContentQualityService.analyzeContent(content);
      
      return {
        url,
        content,
        contentQuality: quality,
        geoAnalysis: geoData,
        overallScore: this.calculateOverallScore(quality, geoData),
        analyzedAt: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Full analysis failed: ${error.message}`);
    }
  }
  
  static calculateOverallScore(quality: any, geoData: any) {
    return Math.round(
      (quality.wordCount > 500 ? 20 : 10) +  // Content length
      (quality.headingCount > 3 ? 20 : 10) + // Structure
      (geoData.geoScore.overall * 0.6)        // GEO score (main factor)
    );
  }
}
```

### 2. Dashboard Integration

```typescript
// hooks/use-mudra-analysis.ts
export function useMudraAnalysis() {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const runFullAnalysis = async (url: string) => {
    setLoading(true);
    try {
      const result = await MudraAnalysisPipeline.fullAnalysis(url);
      setAnalysis(result);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return { analysis, loading, runFullAnalysis };
}
```

---

## 🎯 Best Practices

### 1. Development Workflow

```bash
# Recommended development workflow

# 1. Test with CLI first
npx tsx scripts/firecrawl-cli.ts https://example.com/ --only-main

# 2. Integrate into components
# Use React hooks for state management

# 3. Add error handling
# Implement retry logic and user feedback

# 4. Optimize for production
# Add caching, rate limiting, monitoring
```

### 2. Production Deployment

```typescript
// Production environment checklist
const productionConfig = {
  // Use environment variables
  apiKey: process.env.FIRECRAWL_API_KEY,
  
  // Implement proper error handling
  maxRetries: 3,
  timeout: 30000,
  
  // Add monitoring
  logRequests: true,
  trackUsage: true,
  
  // Enable caching
  cacheEnabled: true,
  cacheTTL: 3600,
  
  // Rate limiting
  rateLimitEnabled: true,
  requestsPerMinute: 60
};
```

---

## 🚀 Next Steps

1. **Enhanced Analytics**: Combine with AI for sentiment analysis
2. **Real-time Monitoring**: Set up automated competitor tracking  
3. **Bulk Processing**: Implement background job queues
4. **Advanced Filtering**: Add content type and quality filters
5. **Export Features**: Generate reports and data exports
6. **API Integration**: Connect with other GEO analysis tools

The Firecrawl Basic Scraper is now fully integrated and ready for production use in your Mudra GEO platform! 🎉