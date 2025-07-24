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
  CardFooter,
  CardHeader,
  CardTitle,
  CardContent,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { 
  IconTrendingUp,
  IconTrendingDown,
  IconLoader,
  IconCircleCheckFilled,
  IconPlus,
  IconFilter,
  IconDotsVertical,
  IconGripVertical,
  IconTarget,
  IconEye,
  IconChartPie,
  IconUsersGroup
} from "@tabler/icons-react"
import { Info } from "lucide-react"

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
  
  // State for modals
  const [isCompetitiveShareModalOpen, setIsCompetitiveShareModalOpen] = useState(false)
  const [isAIReferralsModalOpen, setIsAIReferralsModalOpen] = useState(false)

  // Calculate stats
  const totalPrompts = mockPrompts.length
  const responsePrompts = mockPrompts.filter(p => p.responses > 0)
  const highVisibilityPrompts = mockPrompts.filter(p => p.visibility >= 70)
  const avgVisibility = Math.round(mockPrompts.reduce((sum, p) => sum + p.visibility, 0) / totalPrompts)
  
  // New metrics calculations - ready for backend integration
  const competitiveShare = 68 // Percentage of market share in AI mentions
  const aiReferrals = 12 // Number of referrals from AI search

  // Filter prompts based on search and type
  const filteredPrompts = mockPrompts.filter(prompt => {
    const matchesText = prompt.prompt.toLowerCase().includes(filterText.toLowerCase())
    const matchesType = typeFilter === "all" || prompt.type === typeFilter
    return matchesText && matchesType
  })

  return (
    <div className="@container/main flex flex-1 flex-col gap-2 bg-black">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        {/* Prompts Section Title */}
        <div className="px-4 lg:px-6">
          <h2 className="text-2xl font-semibold mb-6">Prompts and Insights</h2>
        </div>
        
        {/* Top Metrics - Competitive Share and AI Referrals */}
        <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @lg/main:grid-cols-2">
          {/* Competitive Share Card */}
          <Card className="@container/card">
            <CardHeader className="pb-2">
              <CardDescription>Competitive Share</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {competitiveShare}%
              </CardTitle>
              <CardAction>
                <Badge variant="outline">
                  <IconChartPie className="w-4 h-4" />
                  Leading
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm pt-2">
              <div className="line-clamp-1 flex gap-2 font-medium">
                Market dominance <IconTrendingUp className="size-4" />
              </div>
              <div className="text-muted-foreground">
                vs competitors in AI mentions
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCompetitiveShareModalOpen(true)}
                className="mt-3 w-full"
              >
                <Info className="h-4 w-4 mr-2" />
                More Info
              </Button>
            </CardFooter>
          </Card>
          
          {/* AI Referrals Card */}
          <Card className="@container/card">
            <CardHeader className="pb-2">
              <CardDescription>Referrals from AI Search</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {aiReferrals}
              </CardTitle>
              <CardAction>
                <Badge variant="outline">
                  <IconTrendingDown className="w-4 h-4" />
                  -4
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm pt-2">
              <div className="line-clamp-1 flex gap-2 font-medium">
                Direct AI traffic <IconUsersGroup className="size-4" />
              </div>
              <div className="text-muted-foreground">
                Human visits from AI engines
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAIReferralsModalOpen(true)}
                className="mt-3 w-full"
              >
                <Info className="h-4 w-4 mr-2" />
                More Info
              </Button>
            </CardFooter>
          </Card>
        </div>
        
        {/* Prompt Metrics Cards - Made smaller */}
        <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-3 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @lg/main:grid-cols-3">
          <Card className="@container/card">
            <CardHeader className="pb-2">
              <CardDescription>Total Prompts</CardDescription>
              <CardTitle className="text-xl font-semibold tabular-nums @[200px]/card:text-2xl">
                {totalPrompts}
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="text-xs">
                  <IconTrendingUp className="w-3 h-3" />
                  Active
                </Badge>
              </CardAction>
            </CardHeader>
          </Card>
          
          <Card className="@container/card">
            <CardHeader className="pb-2">
              <CardDescription>With Responses</CardDescription>
              <CardTitle className="text-xl font-semibold tabular-nums @[200px]/card:text-2xl">
                {responsePrompts.length}
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="text-xs">
                  <IconLoader className="w-3 h-3" />
                  Processing
                </Badge>
              </CardAction>
            </CardHeader>
          </Card>
          
          <Card className="@container/card">
            <CardHeader className="pb-2">
              <CardDescription>High Visibility</CardDescription>
              <CardTitle className="text-xl font-semibold tabular-nums @[200px]/card:text-2xl">
                {highVisibilityPrompts.length}
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="text-xs">
                  <IconCircleCheckFilled className="fill-green-500 dark:fill-green-400 w-3 h-3" />
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
                            <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
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
      
      {/* Competitive Share Modal */}
      <Dialog open={isCompetitiveShareModalOpen} onOpenChange={setIsCompetitiveShareModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconChartPie className="size-5" />
              Competitive Share
            </DialogTitle>
            <DialogDescription>
              Your market position in AI mentions compared to competitors
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Your Share</CardDescription>
                  <CardTitle className="text-2xl">{competitiveShare}%</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Market Position</CardDescription>
                  <CardTitle className="text-2xl">#2</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Gap to Leader</CardDescription>
                  <CardTitle className="text-2xl">4%</CardTitle>
                </CardHeader>
              </Card>
            </div>

            {/* Market Share Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Market Share Breakdown</CardTitle>
                <CardDescription>
                  How you compare against top competitors in AI mentions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg border-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-semibold text-sm">1</div>
                      <span className="font-medium">CompetitorA</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">72%</div>
                      <div className="text-xs text-muted-foreground">Market Leader</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg border-2 bg-muted/20">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center font-semibold text-sm">2</div>
                      <span className="font-medium">Your Company</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{competitiveShare}%</div>
                      <div className="text-xs text-muted-foreground">Strong Position</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-semibold text-sm">3</div>
                      <span>CompetitorB</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">45%</div>
                      <div className="text-xs text-muted-foreground">Declining</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-semibold text-sm">4</div>
                      <span>CompetitorC</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">28%</div>
                      <div className="text-xs text-muted-foreground">Stable</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Improvement Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Recommended Actions</CardTitle>
                <CardDescription>
                  Strategic steps to improve your competitive position
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex gap-3 p-3 border rounded-lg">
                    <div className="flex-shrink-0 mt-1">
                      <Checkbox />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm">Focus on Technical Content</h4>
                        <Badge variant="outline" className="text-xs">High Impact</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Create developer-focused content to capture technical queries where competitors are weak
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 p-3 border rounded-lg">
                    <div className="flex-shrink-0 mt-1">
                      <Checkbox />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm">Improve Comparison Content</h4>
                        <Badge variant="outline" className="text-xs">Medium Impact</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Create detailed comparison guides to win head-to-head queries
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 p-3 border rounded-lg">
                    <div className="flex-shrink-0 mt-1">
                      <Checkbox />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm">Target Long-tail Queries</h4>
                        <Badge variant="outline" className="text-xs">Quick Win</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Identify and optimize for specific queries where competitors have low visibility
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              <Button className="flex-1">
                <IconTarget className="size-4 mr-2" />
                Create Action Plan
              </Button>
              <Button variant="outline">
                <IconTrendingUp className="size-4 mr-2" />
                Track Progress
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* AI Referrals Modal */}
      <Dialog open={isAIReferralsModalOpen} onOpenChange={setIsAIReferralsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconUsersGroup className="size-5" />
              AI Search Referrals
            </DialogTitle>
            <DialogDescription>
              Human visits referred by AI Search Engines and chatbots
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>This Month</CardDescription>
                  <CardTitle className="text-2xl">{aiReferrals}</CardTitle>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <IconTrendingDown className="size-3" />
                    <span>-4 from last month</span>
                  </div>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Avg Session Duration</CardDescription>
                  <CardTitle className="text-2xl">3.2m</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Conversion Rate</CardDescription>
                  <CardTitle className="text-2xl">18%</CardTitle>
                </CardHeader>
              </Card>
            </div>

            {/* Referral Sources */}
            <Card>
              <CardHeader>
                <CardTitle>Referral Sources</CardTitle>
                <CardDescription>
                  Which AI platforms are sending you the most traffic
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg border-2">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-foreground rounded-full"></div>
                      <span className="font-medium">ChatGPT</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">7 visits</div>
                      <div className="text-xs text-muted-foreground">58% of total</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-muted rounded-full"></div>
                      <span className="font-medium">Perplexity</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">3 visits</div>
                      <div className="text-xs text-muted-foreground">25% of total</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-muted rounded-full"></div>
                      <span className="font-medium">Claude</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">2 visits</div>
                      <div className="text-xs text-muted-foreground">17% of total</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tracking Methods */}
            <Card>
              <CardHeader>
                <CardTitle>How We Track This</CardTitle>
                <CardDescription>
                  Methods used to identify AI-referred traffic
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-start gap-3 p-3 border rounded-lg">
                    <IconEye className="size-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm">Referrer Analysis</p>
                      <p className="text-xs text-muted-foreground">Detection of AI platform referrer headers</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 border rounded-lg">
                    <IconTarget className="size-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm">UTM Tracking</p>
                      <p className="text-xs text-muted-foreground">AI-specific URL parameter monitoring</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 border rounded-lg">
                    <IconTrendingUp className="size-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm">Pattern Correlation</p>
                      <p className="text-xs text-muted-foreground">Traffic spikes matching AI mention times</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 border rounded-lg">
                    <IconUsersGroup className="size-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm">User Behavior</p>
                      <p className="text-xs text-muted-foreground">Analysis of AI-typical browsing patterns</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Improvement Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Increase AI Referrals</CardTitle>
                <CardDescription>
                  Action items to boost traffic from AI search engines
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex gap-3 p-3 border rounded-lg">
                    <div className="flex-shrink-0 mt-1">
                      <Checkbox />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm">Create AI-Friendly Landing Pages</h4>
                        <Badge variant="outline" className="text-xs">High Priority</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Build dedicated pages with UTM tracking for AI search referrals
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 p-3 border rounded-lg">
                    <div className="flex-shrink-0 mt-1">
                      <Checkbox />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm">Improve Source Credibility</h4>
                        <Badge variant="outline" className="text-xs">Medium Priority</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Add author credentials and citations to increase AI trust
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 p-3 border rounded-lg">
                    <div className="flex-shrink-0 mt-1">
                      <Checkbox />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm">Monitor AI Mentions</h4>
                        <Badge variant="outline" className="text-xs">Ongoing</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Set up alerts for new AI mentions to capitalize on traffic opportunities
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              <Button className="flex-1">
                <IconUsersGroup className="size-4 mr-2" />
                Optimize for AI Traffic
              </Button>
              <Button variant="outline">
                <IconEye className="size-4 mr-2" />
                Set Up Tracking
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
} 