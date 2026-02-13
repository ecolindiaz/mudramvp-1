"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { IconFilter, IconChevronLeft, IconChevronRight } from "@tabler/icons-react"
import { CircleFlag } from "react-circle-flags"

// Mock data for prompts - ready for backend integration
const mockPrompts = [
  {
    id: 1,
    prompt: "how does amazon web services stack up against microsoft azure for cloud solutions?",
    type: "Competitor",
    intent: "Commercial",
    responses: 1,
    visibility: 95,
    language: "English",
    monitor: "Demo Monitor",
    created: "26 May",
    region: "US"
  },
  {
    id: 2,
    prompt: "is there a way to get personalized shopping recommendations online?",
    type: "Organic",
    intent: "Informational",
    responses: 1,
    visibility: 78,
    language: "English",
    monitor: "Demo Monitor",
    created: "26 May",
    region: "US"
  },
  {
    id: 3,
    prompt: "where can i find a platform with both fast shipping and competitive pricing?",
    type: "Organic",
    intent: "Informational",
    responses: 1,
    visibility: 92,
    language: "English",
    monitor: "Demo Monitor",
    created: "26 May",
    region: "US"
  },
  {
    id: 4,
    prompt: "what do people say about amazon's customer service and delivery speed?",
    type: "Brand Specific",
    intent: "Branded",
    responses: 1,
    visibility: 95,
    language: "English",
    monitor: "Demo Monitor",
    created: "26 May",
    region: "US"
  },
  {
    id: 5,
    prompt: "how does amazon prime compare to other membership services?",
    type: "Brand Specific",
    intent: "Commercial",
    responses: 0,
    visibility: 0,
    language: "English",
    monitor: "Demo Monitor",
    created: "26 May",
    region: "US"
  },
  {
    id: 6,
    prompt: "what's the fastest way to get groceries delivered to my home?",
    type: "Organic",
    intent: "Informational",
    responses: 1,
    visibility: 70,
    language: "English",
    monitor: "Demo Monitor",
    created: "26 May",
    region: "US"
  },
  {
    id: 7,
    prompt: "what are the benefits of using a cloud service for my small business?",
    type: "Organic",
    intent: "Informational",
    responses: 1,
    visibility: 0,
    language: "English",
    monitor: "Demo Monitor",
    created: "26 May",
    region: "US"
  },
  {
    id: 8,
    prompt: "what's the best way to manage large-scale data storage for a business?",
    type: "Organic",
    intent: "Informational",
    responses: 0,
    visibility: 0,
    language: "English",
    monitor: "Demo Monitor",
    created: "26 May",
    region: "US"
  },
  {
    id: 9,
    prompt: "can you recommend a platform for selling products globally?",
    type: "Organic",
    intent: "Informational",
    responses: 1,
    visibility: 78,
    language: "English",
    monitor: "Demo Monitor",
    created: "26 May",
    region: "US"
  },
  {
    id: 10,
    prompt: "how can i find the best deals on electronics online?",
    type: "Organic",
    intent: "Informational",
    responses: 1,
    visibility: 78,
    language: "English",
    monitor: "Demo Monitor",
    created: "26 May",
    region: "US"
  }
]

// Helper functions for styling
function getTypeBadge(type: string) {
  switch (type) {
    case "Competitor":
      return <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/20">{type}</Badge>
    case "Organic":
      return <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">{type}</Badge>
    case "Brand Specific":
      return <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20">{type}</Badge>
    default:
      return <Badge variant="outline" className="text-gray-400 border-gray-500/20">{type}</Badge>
  }
}

function getIntentBadge(intent: string) {
  switch (intent) {
    case "Commercial":
      return <Badge variant="secondary" className="bg-purple-500/10 text-purple-400 border-purple-500/20">{intent}</Badge>
    case "Informational":
      return <Badge variant="secondary" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20">{intent}</Badge>
    case "Branded":
      return <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20">{intent}</Badge>
    default:
      return <Badge variant="secondary" className="text-gray-400">{intent}</Badge>
  }
}

function getVisibilityIndicator(visibility: number) {
  const getColor = () => {
    if (visibility >= 90) return "bg-green-500"
    if (visibility >= 70) return "bg-green-500"
    if (visibility >= 50) return "bg-yellow-500"
    if (visibility > 0) return "bg-orange-500"
    return "bg-gray-500"
  }

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${getColor()}`} />
      <span className="text-sm text-white">{visibility}%</span>
    </div>
  )
}

export function TopPromptsTable() {
  const [filterText, setFilterText] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)

  // Calculate total prompts for pagination
  const totalPrompts = mockPrompts.length
  const promptsPerPage = 10
  const totalPages = Math.ceil(totalPrompts / promptsPerPage)

  // Filter prompts based on search and type
  const filteredPrompts = mockPrompts.filter(prompt => {
    const matchesText = prompt.prompt.toLowerCase().includes(filterText.toLowerCase())
    const matchesType = typeFilter === "all" || prompt.type === typeFilter
    return matchesText && matchesType
  })

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Input
              placeholder="Filter by name or description..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-64 bg-gray-900 border-gray-800 text-white placeholder:text-gray-500"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-32 bg-gray-900 border-gray-800 text-white">
              <IconFilter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-800">
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="Competitor">Competitor</SelectItem>
              <SelectItem value="Organic">Organic</SelectItem>
              <SelectItem value="Brand Specific">Brand Specific</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm text-gray-400">
          {totalPrompts} Prompts
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900/50 rounded-lg border border-gray-800">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-800 hover:bg-gray-800/50">
              <TableHead className="text-gray-400">Prompt</TableHead>
              <TableHead className="text-gray-400">Type</TableHead>
              <TableHead className="text-gray-400">Intent</TableHead>
              <TableHead className="text-gray-400">Resp.</TableHead>
              <TableHead className="text-gray-400">Visibility</TableHead>
              <TableHead className="text-gray-400">Language</TableHead>
              <TableHead className="text-gray-400">Monitor</TableHead>
              <TableHead className="text-gray-400">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPrompts.map((prompt) => (
              <TableRow 
                key={prompt.id} 
                className="border-gray-800 hover:bg-gray-800/30 cursor-pointer"
              >
                <TableCell className="max-w-md">
                  <div className="text-white font-medium truncate">
                    {prompt.prompt}
                  </div>
                </TableCell>
                <TableCell>
                  {getTypeBadge(prompt.type)}
                </TableCell>
                <TableCell>
                  {getIntentBadge(prompt.intent)}
                </TableCell>
                <TableCell className="text-white">
                  {prompt.responses} resp.
                </TableCell>
                <TableCell>
                  {getVisibilityIndicator(prompt.visibility)}
                </TableCell>
                <TableCell className="text-gray-300">
                  <div className="flex items-center gap-2">
                    <CircleFlag countryCode={prompt.region.toLowerCase()} height="16" width="16" className="flex-shrink-0" style={{ width: 16, height: 16 }} />
                    {prompt.language}
                  </div>
                </TableCell>
                <TableCell className="text-gray-300">
                  {prompt.monitor}
                </TableCell>
                <TableCell className="text-gray-300">
                  {prompt.created}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400">
          1-{Math.min(promptsPerPage, totalPrompts)} of {totalPrompts}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
            className="bg-gray-900 border-gray-800 text-white hover:bg-gray-800"
          >
            <IconChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
            className="bg-gray-900 border-gray-800 text-white hover:bg-gray-800"
          >
            <IconChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
} 