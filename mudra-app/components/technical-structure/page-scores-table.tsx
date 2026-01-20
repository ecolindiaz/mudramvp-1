'use client';

/**
 * Page Scores Table
 * 
 * Displays a paginated table of page-level scores with filtering and sorting.
 */

import React, { useState } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ChevronLeft, 
  ChevronRight, 
  ExternalLink,
  Search,
  SortAsc,
  SortDesc,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

interface PageScore {
  pageUrl: string;
  pageType: string | null;
  overallScore: number;
  grade: {
    grade: string;
    label: string;
    color: string;
  };
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

interface PageScoresTableProps {
  pages: PageScore[];
  total: number;
  limit: number;
  offset: number;
  onPageChange: (offset: number) => void;
  onSortChange?: (orderBy: 'score_asc' | 'score_desc' | 'url') => void;
  onPageTypeFilter?: (pageType: string | undefined) => void;
  onPageClick?: (pageUrl: string) => void;
  currentSort?: string;
  currentPageType?: string;
}

function getScoreColor(score: number): string {
  if (score >= 90) return 'text-green-600';
  if (score >= 75) return 'text-lime-600';
  if (score >= 60) return 'text-yellow-600';
  if (score >= 40) return 'text-orange-600';
  return 'text-red-600';
}

function getScoreBg(score: number): string {
  if (score >= 90) return 'bg-green-100';
  if (score >= 75) return 'bg-lime-100';
  if (score >= 60) return 'bg-yellow-100';
  if (score >= 40) return 'bg-orange-100';
  return 'bg-red-100';
}

function getGradeBadgeVariant(grade: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (grade === 'A' || grade === 'B') return 'default';
  if (grade === 'C') return 'secondary';
  return 'destructive';
}

function formatPageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname || '/';
  } catch {
    return url;
  }
}

const PAGE_TYPES = [
  { value: 'all', label: 'All Pages' },
  { value: 'main', label: 'Main' },
  { value: 'blog', label: 'Blog' },
  { value: 'product', label: 'Product' },
  { value: 'service', label: 'Service' },
  { value: 'features', label: 'Features' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'docs', label: 'Documentation' },
  { value: 'about', label: 'About' },
  { value: 'other', label: 'Other' },
];

export function PageScoresTable({
  pages,
  total,
  limit,
  offset,
  onPageChange,
  onSortChange,
  onPageTypeFilter,
  onPageClick,
  currentSort = 'score_desc',
  currentPageType,
}: PageScoresTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  
  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;
  
  const filteredPages = searchQuery 
    ? pages.filter(p => p.pageUrl.toLowerCase().includes(searchQuery.toLowerCase()))
    : pages;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search pages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        {onPageTypeFilter && (
          <Select
            value={currentPageType || 'all'}
            onValueChange={(value) => onPageTypeFilter(value === 'all' ? undefined : value)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Page Type" />
            </SelectTrigger>
            <SelectContent>
              {PAGE_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        
        {onSortChange && (
          <Select
            value={currentSort}
            onValueChange={(value) => onSortChange(value as any)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score_desc">
                <span className="flex items-center gap-2">
                  <SortDesc className="h-4 w-4" /> Score (High to Low)
                </span>
              </SelectItem>
              <SelectItem value="score_asc">
                <span className="flex items-center gap-2">
                  <SortAsc className="h-4 w-4" /> Score (Low to High)
                </span>
              </SelectItem>
              <SelectItem value="url">URL (A-Z)</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Page</TableHead>
              <TableHead className="text-center">Type</TableHead>
              <TableHead className="text-center">Score</TableHead>
              <TableHead className="text-center">SD</TableHead>
              <TableHead className="text-center">SH</TableHead>
              <TableHead className="text-center">CT</TableHead>
              <TableHead className="text-center">AC</TableHead>
              <TableHead className="text-center">AE</TableHead>
              <TableHead className="text-center">Issues</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No pages found
                </TableCell>
              </TableRow>
            ) : (
              filteredPages.map((page, idx) => (
                <TableRow 
                  key={idx}
                  className={onPageClick ? 'cursor-pointer hover:bg-muted/50' : ''}
                  onClick={() => onPageClick?.(page.pageUrl)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm truncate max-w-[300px]" title={page.pageUrl}>
                        {formatPageUrl(page.pageUrl)}
                      </span>
                      <a 
                        href={page.pageUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="text-xs capitalize">
                      {page.pageType || 'other'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span className={`font-bold ${getScoreColor(page.overallScore)}`}>
                        {page.overallScore}
                      </span>
                      <Badge 
                        variant={getGradeBadgeVariant(page.grade.grade)}
                        className="text-xs"
                      >
                        {page.grade.grade}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`text-sm ${getScoreColor(page.dimensions.structuredData)}`}>
                      {page.dimensions.structuredData}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`text-sm ${getScoreColor(page.dimensions.semanticHtml)}`}>
                      {page.dimensions.semanticHtml}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`text-sm ${getScoreColor(page.dimensions.citability)}`}>
                      {page.dimensions.citability}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`text-sm ${getScoreColor(page.dimensions.accessibility)}`}>
                      {page.dimensions.accessibility}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`text-sm ${getScoreColor(page.dimensions.answerEngine)}`}>
                      {page.dimensions.answerEngine}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {page.issueCount > 0 ? (
                      <div className="flex items-center justify-center gap-1 text-orange-600">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm">{page.issueCount}</span>
                      </div>
                    ) : (
                      <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {offset + 1}-{Math.min(offset + limit, total)} of {total} pages
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(0, offset - limit))}
            disabled={offset === 0}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(offset + limit)}
            disabled={offset + limit >= total}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
        <span className="font-medium">Dimensions:</span>
        <span>SD = Structured Data</span>
        <span>SH = Semantic HTML</span>
        <span>CT = Citability</span>
        <span>AC = Accessibility</span>
        <span>AE = Answer Engine</span>
      </div>
    </div>
  );
}

export default PageScoresTable;
