"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
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
import { Progress } from "@/components/ui/progress"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts"
import { 
  IconTrendingUp,
  IconTrendingDown,
  IconExternalLink,
  IconPlus,
  IconStar,
  IconMessage,
  IconCalendar,
  IconTarget,
  IconWorldWww,
  IconBuildingStore,
  IconNews,
  IconBrandReddit,
  IconBrandLinkedin,
  IconBrandTwitter,
} from "@tabler/icons-react"
import { Checkbox } from "@/components/ui/checkbox"
import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Info } from "lucide-react"

// Mock data for citations
const citationData = [
  {
    id: 1,
    source: "Wikipedia",
    domain: "wikipedia.org",
    citations: 45,
    trend: "up",
    trendValue: "+12%",
    category: "Reference",
    lastCited: "2 days ago",
    authority: 95
  },
  {
    id: 2,
    source: "TechCrunch",
    domain: "techcrunch.com",
    citations: 32,
    trend: "up",
    trendValue: "+8%",
    category: "News",
    lastCited: "1 week ago",
    authority: 88
  },
  {
    id: 3,
    source: "Product Hunt",
    domain: "producthunt.com",
    citations: 28,
    trend: "up",
    trendValue: "+15%",
    category: "Product",
    lastCited: "3 days ago",
    authority: 75
  },
  {
    id: 4,
    source: "Reddit",
    domain: "reddit.com",
    citations: 24,
    trend: "down",
    trendValue: "-3%",
    category: "Community",
    lastCited: "5 days ago",
    authority: 70
  },
  {
    id: 5,
    source: "LinkedIn",
    domain: "linkedin.com",
    citations: 19,
    trend: "up",
    trendValue: "+5%",
    category: "Professional",
    lastCited: "1 day ago",
    authority: 82
  }
]

// Mock data for brand voice radar chart
const brandVoiceData = [
  { attribute: "Authority", score: 85 },
  { attribute: "Innovation", score: 92 },
  { attribute: "Trustworthiness", score: 78 },
  { attribute: "Expertise", score: 88 },
  { attribute: "Clarity", score: 82 },
  { attribute: "Engagement", score: 75 },
]

const chartConfig = {
  score: {
    label: "Score",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig

// Mock data for outreach opportunities - simplified and focused
const outreachOpportunities = [
  {
    id: 1,
    title: "Strengthen partnerships with fintech-focused review platforms",
    impact: "High",
    effort: "Low",
    description: "Platforms like NerdWallet and FitSmallBusiness are highly cited, indicating their influence in fintech decision-making. Rho should optimize its presence on these platforms to drive credibility and customer acquisition.",
    websites: ["fitsmallbusiness.com", "nerdwallet.com"],
    steps: [
      "Conduct interviews with CFOs to identify key challenges in accounts payable.",
      "Publish whitepapers, webinars, and blog posts tailored to CFOs on topics like cost optimization and automation.",
      "Promote content through LinkedIn and CFO-specific forums."
    ],
    status: "identified",
    category: "Partnership Development",
    completed: [false, false, false]
  },
  {
    id: 2,
    title: "Expand presence on product review and comparison sites",
    impact: "High",
    effort: "Medium",
    description: "Sites like G2, Capterra, and TrustRadius are frequently referenced by AI models when comparing business solutions. Improving ratings and reviews here will boost AI citations.",
    websites: ["g2.com", "capterra.com", "trustradius.com"],
    steps: [
      "Launch customer review campaign targeting satisfied clients.",
      "Create detailed product profiles with screenshots and case studies.",
      "Respond to all reviews and engage with potential customers.",
      "Optimize product descriptions for key search terms."
    ],
    status: "contacted",
    category: "Review Management",
    completed: [true, false, false, false]
  },
  {
    id: 3,
    title: "Develop thought leadership content for industry publications",
    impact: "Medium",
    effort: "High",
    description: "Publications like TechCrunch, VentureBeat, and American Banker are authoritative sources that AI models frequently cite for business insights and trends.",
    websites: ["techcrunch.com", "venturebeat.com", "americanbanker.com"],
    steps: [
      "Research trending topics in fintech and business banking.",
      "Draft guest articles showcasing unique insights and data.",
      "Build relationships with editors and journalists.",
      "Pitch exclusive stories about company milestones or industry trends."
    ],
    status: "applied",
    category: "Media Relations",
    completed: [true, true, false, false]
  },
  {
    id: 4,
    title: "Optimize Wikipedia and knowledge base presence",
    impact: "High",
    effort: "Low",
    description: "Wikipedia is one of the most cited sources by AI models. Ensuring accurate, comprehensive information about your company and industry will improve AI references.",
    websites: ["wikipedia.org", "wikidata.org"],
    steps: [
      "Create or update company Wikipedia page with verified information.",
      "Add citations to reliable sources and press coverage.",
      "Contribute to relevant industry category pages.",
      "Monitor and maintain accuracy of information."
    ],
    status: "identified",
    category: "Knowledge Management",
    completed: [false, false, false, false]
  },
  {
    id: 5,
    title: "Engage with developer and startup communities",
    impact: "Medium",
    effort: "Medium",
    description: "Communities like Product Hunt, Hacker News, and Reddit are influential in tech decision-making and frequently referenced by AI models for product recommendations.",
    websites: ["producthunt.com", "news.ycombinator.com", "reddit.com"],
    steps: [
      "Launch on Product Hunt with comprehensive campaign.",
      "Share insights and answer questions on relevant subreddits.",
      "Participate in Hacker News discussions about fintech trends.",
      "Build relationships with community moderators and influencers."
    ],
    status: "accepted",
    category: "Community Engagement",
    completed: [true, false, false, false]
  },
  {
    id: 6,
    title: "Create strategic content partnerships with industry leaders",
    impact: "High",
    effort: "High",
    description: "Collaborating with established fintech leaders and publications for co-authored content creates high-authority backlinks and citations that AI models value.",
    websites: ["andreessen-horowitz.com", "techstars.com", "ycombinator.com"],
    steps: [
      "Identify potential collaboration partners in fintech space.",
      "Propose co-authored research reports or case studies.",
      "Develop joint webinar series with industry experts.",
      "Cross-promote content across partner networks."
    ],
    status: "negotiating",
    category: "Strategic Partnerships",
    completed: [true, true, false, false]
  }
]

function BrandVoiceRadarChart() {
  return (
    <Card>
      <CardHeader className="items-center">
        <CardTitle>Brand Voice Analysis</CardTitle>
        <CardDescription>
          How AI models perceive your brand across key attributes
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[300px]"
        >
          <RadarChart data={brandVoiceData}>
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <PolarAngleAxis dataKey="attribute" />
            <PolarGrid />
            <Radar
              dataKey="score"
              fill="var(--color-score)"
              fillOpacity={0.6}
              dot={{
                r: 4,
                fillOpacity: 1,
              }}
            />
          </RadarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm">
        <div className="flex items-center gap-2 leading-none font-medium">
          Overall brand perception trending up <IconTrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground flex items-center gap-2 leading-none">
          Based on AI model analysis across 500+ sources
        </div>
      </CardFooter>
    </Card>
  )
}

function getSourceIcon(domain: string) {
  switch (domain) {
    case "reddit.com":
      return <IconBrandReddit className="size-4" />
    case "linkedin.com":
      return <IconBrandLinkedin className="size-4" />
    case "twitter.com":
      return <IconBrandTwitter className="size-4" />
    case "wikipedia.org":
      return <IconWorldWww className="size-4" />
    case "techcrunch.com":
      return <IconNews className="size-4" />
    default:
      return <IconExternalLink className="size-4" />
  }
}

function getImpactEffortIndicator(impact: string, effort: string) {
  const getColor = () => {
    if (impact === "High" && effort === "Low") return "border-green-500"
    if (impact === "High" && effort === "Medium") return "border-blue-500"
    if (impact === "High" && effort === "High") return "border-yellow-500"
    if (impact === "Medium" && effort === "Low") return "border-green-400"
    if (impact === "Medium" && effort === "Medium") return "border-blue-400"
    return "border-gray-500"
  }

  const getText = () => {
    if (impact === "High" && effort === "Low") return "High Impact, Low effort"
    if (impact === "High" && effort === "Medium") return "High Impact, Medium effort"
    if (impact === "High" && effort === "High") return "High Impact, High effort"
    if (impact === "Medium" && effort === "Low") return "Medium Impact, Low effort"
    if (impact === "Medium" && effort === "Medium") return "Medium Impact, Medium effort"
    return "Low Impact, Low effort"
  }

  return (
    <div className={`flex items-center gap-2 text-sm text-muted-foreground`}>
      <div className={`w-16 h-px border-t-2 border-dashed ${getColor()}`} />
      <span>{getText()}</span>
    </div>
  )
}

function getStatusBadge(status: string) {
  switch (status) {
    case "identified":
      return <Badge variant="outline" className="text-blue-500 border-blue-500/20 bg-blue-500/10">Identified</Badge>
    case "contacted":
      return <Badge variant="outline" className="text-yellow-500 border-yellow-500/20 bg-yellow-500/10">Contacted</Badge>
    case "applied":
      return <Badge variant="outline" className="text-purple-500 border-purple-500/20 bg-purple-500/10">Applied</Badge>
    case "negotiating":
      return <Badge variant="outline" className="text-orange-500 border-orange-500/20 bg-orange-500/10">Negotiating</Badge>
    case "accepted":
      return <Badge variant="outline" className="text-green-500 border-green-500/20 bg-green-500/10">Accepted</Badge>
    case "completed":
      return <Badge variant="outline" className="text-emerald-500 border-emerald-500/20 bg-emerald-500/10">Completed</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

function getPriorityBadge(priority: string) {
  switch (priority) {
    case "High":
      return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">High Priority</Badge>
    case "Medium":
      return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Medium Priority</Badge>
    case "Low":
      return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Low Priority</Badge>
    default:
      return <Badge variant="outline">{priority}</Badge>
  }
}

function getDifficultyColor(difficulty: string) {
  switch (difficulty) {
    case "Easy":
      return "text-green-500"
    case "Medium":
      return "text-yellow-500"
    case "Hard":
      return "text-red-500"
    default:
      return "text-muted-foreground"
  }
}

function getCategoryIcon(category: string) {
  switch (category) {
    case "Content Marketing":
      return <IconNews className="size-4 text-blue-500" />
    case "Media Coverage":
      return <IconMessage className="size-4 text-purple-500" />
    case "Press Coverage":
      return <IconNews className="size-4 text-red-500" />
    case "Thought Leadership":
      return <IconStar className="size-4 text-yellow-500" />
    case "Paid Promotion":
      return <IconTarget className="size-4 text-green-500" />
    default:
      return <IconExternalLink className="size-4 text-muted-foreground" />
  }
}

export function FootprintView() {
  const totalCitations = citationData.reduce((sum, item) => sum + item.citations, 0)
  const avgAuthority = Math.round(citationData.reduce((sum, item) => sum + item.authority, 0) / citationData.length)
  const trendingUp = citationData.filter(item => item.trend === "up").length

  // Calculate outreach stats
  const totalOpportunities = outreachOpportunities.length
  const activeOpportunities = outreachOpportunities.filter(opp => 
    !['completed', 'rejected'].includes(opp.status)
  ).length
  const highImpactOpportunities = outreachOpportunities.filter(opp => opp.impact === "High").length

  // State for selected opportunity
  const [selectedOpportunity, setSelectedOpportunity] = useState(0)
  
  // State for modals
  const [isCitationsModalOpen, setIsCitationsModalOpen] = useState(false)
  const [isAuthorityModalOpen, setIsAuthorityModalOpen] = useState(false)

  return (
    <div className="@container/main flex flex-1 flex-col gap-2 bg-black">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        {/* Footprint Section */}
        <div className="px-4 lg:px-6">
          <h2 className="text-2xl font-semibold mb-6">Footprint</h2>
        </div>
        
        {/* Header Cards */}
        <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-3">
          <Card className="@container/card">
            <CardHeader>
              <CardDescription>Total Citations</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {totalCitations}
              </CardTitle>
              <CardAction>
                <Badge variant="outline">
                  <IconTrendingUp />
                  +18% this month
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="line-clamp-1 flex gap-2 font-medium">
                Strong AI visibility <IconTrendingUp className="size-4" />
              </div>
              <div className="text-muted-foreground">
                Across {citationData.length} major platforms
              </div>
              {/* More Info Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCitationsModalOpen(true)}
                className="mt-3 w-full"
              >
                <Info className="h-4 w-4 mr-2" />
                More Info
              </Button>
            </CardFooter>
          </Card>
          
          <Card className="@container/card">
            <CardHeader>
              <CardDescription>Footprint Score</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {avgAuthority}%
              </CardTitle>
              <CardAction>
                <Badge variant="outline">
                  <IconTrendingUp />
                  +5.2%
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="line-clamp-1 flex gap-2 font-medium">
                High authority sources <IconStar className="size-4" />
              </div>
              <div className="text-muted-foreground">
                Above industry average (75%)
              </div>
              {/* More Info Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAuthorityModalOpen(true)}
                className="mt-3 w-full"
              >
                <Info className="h-4 w-4 mr-2" />
                More Info
              </Button>
            </CardFooter>
          </Card>

          <Card className="@container/card">
            <CardHeader>
              <CardDescription>High Impact Opportunities</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {highImpactOpportunities}
              </CardTitle>
              <CardAction>
                <Badge variant="outline">
                  <IconTarget />
                  Priority focus
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="line-clamp-1 flex gap-2 font-medium">
                Strategic initiatives <IconTrendingUp className="size-4" />
              </div>
              <div className="text-muted-foreground">
                {totalOpportunities} total opportunities identified
              </div>
            </CardFooter>
          </Card>
        </div>

        <div className="px-4 lg:px-6">
          {/* Analysis Section */}
          <div className="mb-6">
            <h2 className="text-2xl font-semibold mb-6">Analysis</h2>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Citations Table */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>AI Citation Sources</CardTitle>
                      <CardDescription>
                        Most cited places AI models use to reference your brand
                      </CardDescription>
                    </div>
                    <Button size="sm" variant="outline">
                      <IconExternalLink className="size-4" />
                      View All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source</TableHead>
                        <TableHead>Citations</TableHead>
                        <TableHead>Authority</TableHead>
                        <TableHead>Trend</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {citationData.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {getSourceIcon(item.domain)}
                              <div>
                                <p className="font-medium">{item.source}</p>
                                <p className="text-sm text-muted-foreground">{item.domain}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{item.citations}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={item.authority} className="h-2 w-16" />
                              <span className="text-sm">{item.authority}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={
                              item.trend === "up" 
                                ? "text-green-500 border-green-500/20" 
                                : "text-red-500 border-red-500/20"
                            }>
                              {item.trend === "up" ? <IconTrendingUp className="size-3 mr-1" /> : <IconTrendingDown className="size-3 mr-1" />}
                              {item.trendValue}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Brand Voice Radar Chart */}
              <BrandVoiceRadarChart />
            </div>
          </div>

          {/* Improve Section */}
          <div className="mb-6">
            <h2 className="text-2xl font-semibold mb-6">Improve</h2>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Outreach Opportunities</CardTitle>
                    <CardDescription>
                      Strategic initiatives to expand your digital footprint
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">
                      View All ({totalOpportunities})
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Opportunity Selector */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                  {outreachOpportunities.map((opportunity, index) => (
                    <Button
                      key={opportunity.id}
                      variant={selectedOpportunity === index ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedOpportunity(index)}
                      className="whitespace-nowrap"
                    >
                      {opportunity.title.slice(0, 30)}...
                    </Button>
                  ))}
                </div>

                {/* Selected Opportunity Details */}
                <div className="bg-card/50 rounded-lg border p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Side - Content */}
                    <div className="space-y-6">
                      {/* Impact/Effort Indicator */}
                      {getImpactEffortIndicator(
                        outreachOpportunities[selectedOpportunity].impact,
                        outreachOpportunities[selectedOpportunity].effort
                      )}

                      {/* Title */}
                      <h3 className="text-xl font-semibold leading-tight">
                        {outreachOpportunities[selectedOpportunity].title}
                      </h3>

                      {/* Description */}
                      <p className="text-muted-foreground leading-relaxed">
                        {outreachOpportunities[selectedOpportunity].description}
                      </p>

                      {/* Website Links */}
                      <div className="space-y-2">
                        {outreachOpportunities[selectedOpportunity].websites.map((website, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm">
                            <IconExternalLink className="size-4 text-muted-foreground" />
                            <span className="text-blue-400 hover:text-blue-300 cursor-pointer">
                              {website}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right Side - Steps */}
                    <div className="space-y-4">
                      <h4 className="text-lg font-medium">Steps</h4>
                      <div className="space-y-3">
                        {outreachOpportunities[selectedOpportunity].steps.map((step, index) => (
                          <div key={index} className="flex items-start gap-3">
                            <Checkbox 
                              checked={outreachOpportunities[selectedOpportunity].completed[index]}
                              className="mt-1"
                            />
                            <span className="text-sm text-muted-foreground leading-relaxed">
                              {step}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-3 mt-8 pt-6 border-t">
                    <Button variant="outline">
                      Discard
                    </Button>
                    <Button>
                      Mark as done
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Total Citations Detail Modal */}
      <Dialog open={isCitationsModalOpen} onOpenChange={setIsCitationsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Total Citations
              <span className="text-2xl font-bold text-primary">{totalCitations}</span>
            </DialogTitle>
            <DialogDescription>
              Detailed breakdown of how AI models cite and reference your brand
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Progress Overview */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold">{totalCitations}</div>
                <div className="text-sm text-muted-foreground">Total Citations</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold">+18%</div>
                <div className="text-sm text-muted-foreground">This Month</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold">{citationData.length}</div>
                <div className="text-sm text-muted-foreground">Platforms</div>
              </div>
            </div>

            {/* Citation Sources Breakdown */}
            <div className="space-y-4">
              <h4 className="font-semibold">Top Citation Sources</h4>
              <div className="space-y-3">
                {citationData.slice(0, 3).map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      {getSourceIcon(item.domain)}
                      <div>
                        <div className="font-medium">{item.source}</div>
                        <div className="text-sm text-muted-foreground">{item.domain}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{item.citations} citations</div>
                      <div className="text-sm text-muted-foreground">Authority: {item.authority}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendations */}
            <div className="space-y-4">
              <h4 className="font-semibold">Recommendations</h4>
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <div className="font-medium">Maintain High-Quality Content</div>
                    <div className="text-sm text-muted-foreground">Continue producing authoritative content that AI models cite</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div>
                    <div className="font-medium">Expand to New Platforms</div>
                    <div className="text-sm text-muted-foreground">Target additional high-authority sources for citations</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Footprint Score Detail Modal */}
      <Dialog open={isAuthorityModalOpen} onOpenChange={setIsAuthorityModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Footprint Score
              <span className="text-2xl font-bold text-primary">{avgAuthority}%</span>
            </DialogTitle>
            <DialogDescription>
              Analysis of your brand's authority across high-value external sources
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Progress Overview */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold">{avgAuthority}%</div>
                <div className="text-sm text-muted-foreground">Authority Score</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold">+5.2%</div>
                <div className="text-sm text-muted-foreground">Growth</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold">75%</div>
                <div className="text-sm text-muted-foreground">Industry Avg</div>
              </div>
            </div>

            {/* Authority Sources Analysis */}
            <div className="space-y-4">
              <h4 className="font-semibold">Authority Distribution</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <div className="font-medium">Very High Authority (90%+)</div>
                    <div className="text-sm text-muted-foreground">Wikipedia, Major News Sites</div>
                  </div>
                  <div className="text-primary font-semibold">35%</div>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <div className="font-medium">High Authority (75-89%)</div>
                    <div className="text-sm text-muted-foreground">Tech Publications, Industry Sites</div>
                  </div>
                  <div className="text-primary font-semibold">45%</div>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <div className="font-medium">Medium Authority (60-74%)</div>
                    <div className="text-sm text-muted-foreground">Forums, Community Platforms</div>
                  </div>
                  <div className="text-primary font-semibold">20%</div>
                </div>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="space-y-4">
              <h4 className="font-semibold">Authority Metrics</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/30 rounded-lg p-3">
                  <div className="text-lg font-semibold">95%</div>
                  <div className="text-sm text-muted-foreground">Highest Source Authority</div>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <div className="text-lg font-semibold">70%</div>
                  <div className="text-sm text-muted-foreground">Lowest Source Authority</div>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <div className="text-lg font-semibold">{trendingUp}</div>
                  <div className="text-sm text-muted-foreground">Sources Trending Up</div>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <div className="text-lg font-semibold">{citationData.length - trendingUp}</div>
                  <div className="text-sm text-muted-foreground">Stable Sources</div>
                </div>
              </div>
            </div>

            {/* Recommendations */}
            <div className="space-y-4">
              <h4 className="font-semibold">Recommendations</h4>
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <div className="font-medium">Target Higher Authority Sources</div>
                    <div className="text-sm text-muted-foreground">Focus on publications with 90%+ authority scores</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div>
                    <div className="font-medium">Strengthen Existing Relationships</div>
                    <div className="text-sm text-muted-foreground">Maintain and deepen connections with current high-authority sources</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
} 