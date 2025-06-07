"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  IconTrendingUp,
  IconLoader,
  IconCircleCheckFilled,
  IconPlus,
  IconFilter,
  IconDotsVertical,
  IconGripVertical,
  IconTarget,
  IconEye
} from "@tabler/icons-react"

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
    created: "26 May"
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
    created: "26 May"
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
    created: "26 May"
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
    created: "26 May"
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
    created: "26 May"
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
    created: "26 May"
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
    created: "26 May"
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
    created: "26 May"
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
    created: "26 May"
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
    created: "26 May"
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
      return <Badge variant="outline" className="text-muted-foreground px-1.5">{type}</Badge>
  }
}

function getIntentBadge(intent: string) {
  switch (intent) {
    case "Commercial":
      return <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20">{intent}</Badge>
    case "Informational":
      return <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20">{intent}</Badge>
    case "Branded":
      return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20">{intent}</Badge>
    default:
      return <Badge variant="outline" className="text-muted-foreground px-1.5">{intent}</Badge>
  }
}

function getVisibilityBadge(visibility: number) {
  if (visibility >= 90) {
    return (
      <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">
        <IconEye className="size-3 mr-1" />
        {visibility}%
      </Badge>
    )
  }
  if (visibility >= 70) {
    return (
      <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">
        <IconEye className="size-3 mr-1" />
        {visibility}%
      </Badge>
    )
  }
  if (visibility > 0) {
    return (
      <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
        <IconEye className="size-3 mr-1" />
        {visibility}%
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="bg-gray-500/10 text-gray-400 border-gray-500/20">
      <IconEye className="size-3 mr-1" />
      {visibility}%
    </Badge>
  )
}

function DragHandle({ id }: { id: number }) {
  return (
    <Button
      variant="ghost"
      className="text-muted-foreground -ml-3 size-8 cursor-grab active:cursor-grabbing"
      size="icon"
    >
      <IconGripVertical />
      <span className="sr-only">Drag to reorder</span>
    </Button>
  )
}

export function AnalysisView() {
  const [filterText, setFilterText] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")

  // Calculate stats
  const totalPrompts = mockPrompts.length
  const responsePrompts = mockPrompts.filter(p => p.responses > 0)
  const highVisibilityPrompts = mockPrompts.filter(p => p.visibility >= 70)
  const avgVisibility = Math.round(mockPrompts.reduce((sum, p) => sum + p.visibility, 0) / totalPrompts)

  // Filter prompts based on search and type
  const filteredPrompts = mockPrompts.filter(prompt => {
    const matchesText = prompt.prompt.toLowerCase().includes(filterText.toLowerCase())
    const matchesType = typeFilter === "all" || prompt.type === typeFilter
    return matchesText && matchesType
  })

  return (
    <div className="@container/main flex flex-1 flex-col gap-2 bg-black">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        {/* Header Cards */}
        <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-3">
          <Card className="@container/card">
            <CardHeader>
              <CardDescription>Total Prompts</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {totalPrompts}
              </CardTitle>
              <CardAction>
                <Badge variant="outline">
                  <IconTrendingUp />
                  Active
                </Badge>
              </CardAction>
            </CardHeader>
          </Card>
          <Card className="@container/card">
            <CardHeader>
              <CardDescription>With Responses</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {responsePrompts.length}
              </CardTitle>
              <CardAction>
                <Badge variant="outline">
                  <IconLoader />
                  Processing
                </Badge>
              </CardAction>
            </CardHeader>
          </Card>
          <Card className="@container/card">
            <CardHeader>
              <CardDescription>High Visibility</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {highVisibilityPrompts.length}
              </CardTitle>
              <CardAction>
                <Badge variant="outline">
                  <IconCircleCheckFilled className="fill-green-500 dark:fill-green-400" />
                  Optimized
                </Badge>
              </CardAction>
            </CardHeader>
          </Card>
        </div>

        {/* Main Table */}
        <div className="px-4 lg:px-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>All Prompts</CardTitle>
                  <CardDescription>
                    Create and manage prompts for your LLMs
                  </CardDescription>
                </div>
                <Button size="sm">
                  <IconPlus className="size-4" />
                  Add Prompt
                </Button>
              </div>
            </CardHeader>
            
            {/* Filters */}
            <div className="px-6 pb-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Input
                    placeholder="Filter by name or description..."
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    className="w-64"
                  />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-32">
                    <IconFilter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="Competitor">Competitor</SelectItem>
                    <SelectItem value="Organic">Organic</SelectItem>
                    <SelectItem value="Brand Specific">Brand Specific</SelectItem>
                  </SelectContent>
                </Select>
                <div className="ml-auto text-sm text-muted-foreground">
                  {filteredPrompts.length} prompts
                </div>
              </div>
            </div>

            <div className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="w-12">
                      <div className="flex items-center justify-center">
                        <Checkbox aria-label="Select all" />
                      </div>
                    </TableHead>
                    <TableHead>Prompt</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Intent</TableHead>
                    <TableHead>Resp.</TableHead>
                    <TableHead>Visibility</TableHead>
                    <TableHead>Language</TableHead>
                    <TableHead>Monitor</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPrompts.map((prompt) => (
                    <TableRow key={prompt.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell>
                        <DragHandle id={prompt.id} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center">
                          <Checkbox aria-label="Select row" />
                        </div>
                      </TableCell>
                      <TableCell className="font-medium max-w-md">
                        <div className="truncate">
                          {prompt.prompt}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="w-32">
                          {getTypeBadge(prompt.type)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getIntentBadge(prompt.intent)}
                      </TableCell>
                      <TableCell>
                        <Label htmlFor={`${prompt.id}-resp`} className="sr-only">
                          Responses
                        </Label>
                        <Input
                          className="hover:bg-input/30 focus-visible:bg-background dark:hover:bg-input/30 dark:focus-visible:bg-input/30 h-8 w-16 border-transparent bg-transparent text-center shadow-none focus-visible:border dark:bg-transparent"
                          defaultValue={`${prompt.responses} resp.`}
                          id={`${prompt.id}-resp`}
                          readOnly
                        />
                      </TableCell>
                      <TableCell>
                        {getVisibilityBadge(prompt.visibility)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-blue-400">🇺🇸</span>
                          <span className="text-muted-foreground">{prompt.language}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {prompt.monitor}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {prompt.created}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              className="data-[state=open]:bg-muted text-muted-foreground flex size-8"
                              size="icon"
                            >
                              <IconDotsVertical />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-32">
                            <DropdownMenuItem>Edit</DropdownMenuItem>
                            <DropdownMenuItem>View Details</DropdownMenuItem>
                            <DropdownMenuItem>Duplicate</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
} 