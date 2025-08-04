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