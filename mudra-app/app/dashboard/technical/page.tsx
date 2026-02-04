"use client"

// Force dynamic rendering for dashboard pages
export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useCallback } from "react"
import { BrandProfileProvider, useBrandProfile } from "../../../components/brand-profile-context"

import { AppSidebar } from "../../../components/app-sidebar"
import { SiteHeader } from "../../../components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "../../../components/ui/sidebar"
import { Separator } from "../../../components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card"
import { 
  TechnicalStructureScoreCard, 
  PageScoresTable, 
  PageDetailPanel,
  ScrapeJobTrigger 
} from "../../../components/technical-structure"

interface PageScore {
  pageUrl: string;
  pageType: string | null;
  overallScore: number;
  grade: { grade: string; label: string; color: string };
  dimensions: {
    structuredData: number;
    semanticHtml: number;
    citability: number;
    accessibility: number;
    answerEngine: number;
  };
  issueCount: number;
  scoredAt: string;
}

function TechnicalStructurePageInner() {
  const { brandProfile } = useBrandProfile()
  const [siteScore, setSiteScore] = useState<any>(null)
  const [pages, setPages] = useState<PageScore[]>([])
  const [totalPages, setTotalPages] = useState(0)
  const [selectedPage, setSelectedPage] = useState<string | null>(null)
  const [pageDetail, setPageDetail] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [orderBy, setOrderBy] = useState<'score_asc' | 'score_desc' | 'url'>('score_desc')
  const [pageTypeFilter, setPageTypeFilter] = useState<string | undefined>(undefined)
  const limit = 20

  const fetchScores = useCallback(async () => {
    if (!brandProfile?.id) return
    
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        brandProfileId: brandProfile.id.toString(),
        limit: limit.toString(),
        offset: offset.toString(),
        orderBy,
        includePages: 'true', // Request pages in the same call
      })
      if (pageTypeFilter) {
        params.set('pageType', pageTypeFilter)
      }

      const res = await fetch(`/api/site-scrape/scores?${params}`)
      const data = await res.json()
      
      if (data.success && data.data) {
        // Handle case when no scores exist yet
        if (data.data.hasScores === false) {
          setSiteScore(null)
          setPages([])
          setTotalPages(0)
        } else {
          // Site score is under data.site (not data.siteScore)
          setSiteScore(data.data.site || null)
          // Pages are under data.pages.items
          setPages(data.data.pages?.items || [])
          setTotalPages(data.data.pages?.total || 0)
        }
      }
    } catch (err) {
      console.error('Failed to fetch scores:', err)
    } finally {
      setIsLoading(false)
    }
  }, [brandProfile?.id, offset, orderBy, pageTypeFilter])

  useEffect(() => {
    fetchScores()
  }, [fetchScores])

  // Fetch page detail when selected
  useEffect(() => {
    if (!selectedPage || !brandProfile?.id) {
      setPageDetail(null)
      return
    }

    const fetchPageDetail = async () => {
      try {
        const params = new URLSearchParams({
          brandProfileId: brandProfile.id.toString(),
          pageUrl: selectedPage,
        })
        const res = await fetch(`/api/site-scrape/page?${params}`)
        const data = await res.json()
        if (data.success) {
          setPageDetail(data.data)
        }
      } catch (err) {
        console.error('Failed to fetch page detail:', err)
      }
    }

    fetchPageDetail()
  }, [selectedPage, brandProfile?.id])

  const handleJobComplete = () => {
    // Refresh scores when job completes
    fetchScores()
  }

  if (!brandProfile?.id) {
    return (
      <SidebarProvider
        className="bg-dark-grey"
        style={{ "--sidebar-width": "16rem" } as React.CSSProperties}
      >
        <AppSidebar />
        <SidebarInset>
          <SiteHeader />
          <Separator className="w-full border-border" />
          <div className="flex items-center justify-center h-64 p-6">
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6 text-center text-white/60">
                Please complete your brand profile setup first.
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider
      className="bg-dark-grey"
      style={{ "--sidebar-width": "16rem" } as React.CSSProperties}
    >
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <Separator className="w-full border-border" />
        <div className="flex flex-1 flex-col overflow-x-hidden max-w-full">
          <div className="@container/main flex flex-1 flex-col overflow-x-hidden max-w-full">
            {/* Page Header */}
            <div className="px-4 lg:px-6 pt-4 md:pt-6 pb-4 md:pb-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold tracking-tight text-white">
                    Technical Structure
                  </h1>
                  <p className="text-sm text-white/60 mt-1">
                    Site-wide Answer Engine Optimization analysis
                  </p>
                </div>
              </div>
            </div>
            
            <div className="h-[1px] bg-white/10"></div>
            
            <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
              {/* Scrape Trigger + Score Card */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ScrapeJobTrigger
                  brandProfileId={brandProfile.id}
                  websiteUrl={brandProfile.companyWebsite || ''}
                  onJobComplete={handleJobComplete}
                />
                
                {siteScore ? (
                  <TechnicalStructureScoreCard siteScore={siteScore} />
                ) : (
                  <Card className="bg-white/5 border-white/10">
                    <CardHeader>
                      <CardTitle className="text-white">Technical Structure Score</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center text-white/60 py-8">
                      {isLoading ? (
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
                      ) : (
                        <p>Run a scan to generate your Technical Structure Score</p>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Page Scores Table + Detail Panel */}
              {pages.length > 0 && (
                <div className={`grid gap-6 ${selectedPage ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1'}`}>
                  <Card className={`bg-white/5 border-white/10 ${selectedPage ? 'lg:col-span-2' : ''}`}>
                    <CardHeader>
                      <CardTitle className="text-white">Page Scores</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <PageScoresTable
                        pages={pages}
                        total={totalPages}
                        limit={limit}
                        offset={offset}
                        onPageChange={setOffset}
                        onSortChange={setOrderBy}
                        onPageTypeFilter={setPageTypeFilter}
                        onPageClick={setSelectedPage}
                        currentSort={orderBy}
                        currentPageType={pageTypeFilter}
                      />
                    </CardContent>
                  </Card>
                  
                  {selectedPage && pageDetail && (
                    <div className="lg:col-span-1">
                      <PageDetailPanel
                        page={pageDetail}
                        onClose={() => setSelectedPage(null)}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default function TechnicalStructurePage() {
  return (
    <BrandProfileProvider>
      <TechnicalStructurePageInner />
    </BrandProfileProvider>
  )
}
