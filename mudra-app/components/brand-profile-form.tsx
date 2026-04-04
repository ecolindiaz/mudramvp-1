"use client"

import { useState, useEffect } from "react"
import { useBrandProfile } from "@/components/brand-profile-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Upload, X, Download } from "lucide-react"
import { safeParseArray, safeParseICPArray } from "@/lib/utils/safe-parse-array"
import { trackEvent } from "@/lib/analytics/posthog-events"
import { cn } from "@/lib/utils"

// Consistent styles for Mudra theme
const inputStyles = "bg-white/[0.03] border border-white/[0.06] text-white placeholder-white/30 focus:bg-white/[0.05] focus:border-white/[0.12] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
const labelStyles = "text-white/60 text-sm font-medium"

type TabId = "brand-profile" | "audience"

const initialData = {
  companyName: "",
  companyWebsite: "",
  companyLinkedIn: "",
  companyTwitter: "",
  userName: "",
  userRole: "",
  userAvatar: "",
  companyDescription: "",
  companyIndustry: "",
  companyServices: [""],
  companyICP: [""],
  competitors: [""],
  monthlySearchVolume: "",
  aiRecommendations: "",
  websitePlatform: "",
}

// Character limits for fields
const CHAR_LIMITS = {
  companyName: 50,
  companyDescription: 2048,
  companyICP: 4096,
  companyIndustry: 100,
} as const

function CharCount({ value, max }: { value: string; max: number }) {
  const len = value?.length || 0
  return (
    <span className={cn("text-xs tabular-nums", len > max ? "text-red-400" : "text-white/30")}>
      {len}/{max}
    </span>
  )
}

export function BrandProfileForm() {
  const { profile, setProfile } = useBrandProfile()
  const [formData, setFormData] = useState(initialData)
  const [activeTab, setActiveTab] = useState<TabId>("brand-profile")
  const [editOpen, setEditOpen] = useState(false)
  const [kbFiles, setKbFiles] = useState<File[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // Load profile data from context on mount
  useEffect(() => {
    if (profile && profile.companyName) {
      const nonNullProfile = Object.fromEntries(
        Object.entries(profile).filter(([_, v]) => v != null)
      )
      const profileData = {
        ...initialData,
        ...nonNullProfile,
        companyServices: safeParseArray(profile.companyServices, initialData.companyServices),
        companyICP: safeParseICPArray(profile.companyICP, initialData.companyICP),
        competitors: safeParseArray(profile.competitors, initialData.competitors),
      }
      setFormData(profileData)
    }
  }, [profile])

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const accepted = ".pdf,.doc,.docx,.txt,.md,.csv"
  const handleKBFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files ? Array.from(e.target.files) : []
    setKbFiles(prev => [...prev, ...list])
  }

  const updateMultiRow = (field: "companyServices" | "companyICP" | "competitors", idx: number, val: string) => {
    const arr = [...(formData[field] as string[])]
    arr[idx] = val
    setFormData(prev => ({ ...prev, [field]: arr }))
  }
  const addRow = (field: "companyServices" | "companyICP" | "competitors") => {
    setFormData(prev => ({ ...prev, [field]: [...(prev[field] as string[]), ""] }))
  }
  const removeRow = (field: "companyServices" | "companyICP" | "competitors", idx: number) => {
    const arr = (formData[field] as string[]).filter((_, i) => i !== idx)
    setFormData(prev => ({ ...prev, [field]: arr.length ? arr : [""] }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    const profileToSave = {
      ...profile,
      ...formData,
      companyServices: JSON.stringify(formData.companyServices),
      companyICP: JSON.stringify(formData.companyICP),
      competitors: formData.competitors,
    }
    try {
      await setProfile(profileToSave as any)
      trackEvent.profileUpdated()
      setEditOpen(false)
    } catch (error) {
      console.error("Failed to save brand profile:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    // Reset to last saved context
    const nonNullProfile = Object.fromEntries(
      Object.entries(profile).filter(([_, v]) => v != null)
    )
    const profileData = {
      ...initialData,
      ...nonNullProfile,
      companyServices: safeParseArray(profile.companyServices, initialData.companyServices),
      companyICP: safeParseICPArray(profile.companyICP, initialData.companyICP),
      competitors: safeParseArray(profile.competitors, initialData.competitors),
    }
    setFormData(profileData)
    setEditOpen(false)
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "brand-profile", label: "Brand Profile" },
    { id: "audience", label: "Ideal Customer" },
  ]

  const truncate = (s: string | undefined, max = 80) => {
    if (!s) return "-"
    return s.length > max ? s.slice(0, max) + "..." : s
  }

  // Build ICP display text
  const icpText = (formData.companyICP as string[]).filter(Boolean).join(", ")

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white">Knowledge Base</h1>
      </div>

      {/* Underline Tabs */}
      <div className="border-b border-white/[0.06] mb-8">
        <div className="flex gap-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "pb-3 text-sm font-medium transition-colors relative",
                activeTab === tab.id
                  ? "text-white"
                  : "text-white/40 hover:text-white/60"
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Brand Profile Tab */}
      {activeTab === "brand-profile" && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Brand Profile</h2>

          {/* Table */}
          <div className="rounded-xl border border-white/[0.06] overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-white/[0.06] hover:bg-transparent">
                  <TableHead className="text-white/40 font-medium text-xs uppercase tracking-wider pl-4">Name</TableHead>
                  <TableHead className="text-white/40 font-medium text-xs uppercase tracking-wider">Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {formData.companyName ? (
                  <TableRow
                    className="border-b border-white/[0.04] cursor-pointer hover:bg-white/[0.02] transition-colors"
                    onClick={() => setEditOpen(true)}
                  >
                    <TableCell className="pl-4 py-4 text-white font-medium">
                      {formData.companyName || "Untitled"}
                    </TableCell>
                    <TableCell className="py-4 text-white/60">
                      {truncate(formData.companyDescription)}
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={2} className="py-12 text-center text-white/30">
                      No brand profile configured yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Footer count */}
          <div className="mt-4 text-xs text-white/30">
            Showing {formData.companyName ? "1 - 1" : "0"} of {formData.companyName ? "1" : "0"} items
          </div>
        </div>
      )}

      {/* Audience Segments Tab */}
      {activeTab === "audience" && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Ideal Customer</h2>

          <div className="rounded-xl border border-white/[0.06] overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-white/[0.06] hover:bg-transparent">
                  <TableHead className="text-white/40 font-medium text-xs uppercase tracking-wider pl-4">Segment</TableHead>
                  <TableHead className="text-white/40 font-medium text-xs uppercase tracking-wider">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(formData.companyICP as string[]).filter(Boolean).length > 0 ? (
                  (formData.companyICP as string[]).filter(Boolean).map((icp, i) => (
                    <TableRow
                      key={i}
                      className="border-b border-white/[0.04] cursor-pointer hover:bg-white/[0.02] transition-colors"
                      onClick={() => setEditOpen(true)}
                    >
                      <TableCell className="pl-4 py-4 text-white font-medium">
                        Segment {i + 1}
                      </TableCell>
                      <TableCell className="py-4 text-white/60">
                        {truncate(icp, 120)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={2} className="py-12 text-center text-white/30">
                      No audience segments defined yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 text-xs text-white/30">
            Showing {(formData.companyICP as string[]).filter(Boolean).length > 0
              ? `1 - ${(formData.companyICP as string[]).filter(Boolean).length} of ${(formData.companyICP as string[]).filter(Boolean).length}`
              : "0"} items
          </div>
        </div>
      )}

      {/* Edit Slide-over Panel */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent
          side="right"
          className="!w-full sm:!max-w-[680px] bg-[#141414] border-l border-white/[0.06] p-0 overflow-y-auto"
        >
          {/* Panel Header */}
          <SheetHeader className="sticky top-0 z-10 bg-[#1b1b1b] border-b border-white/[0.06] px-6 py-3 gap-0">
            <SheetTitle className="text-sm font-normal text-white/60">Edit Brand Profile</SheetTitle>
          </SheetHeader>

          <div className="px-6 py-6 space-y-8">
            {/* Title + Export */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Edit Brand Profile</h2>
              <Button
                variant="outline"
                size="sm"
                className="border-white/[0.08] bg-transparent text-white/70 hover:bg-white/[0.04] hover:text-white gap-1.5 rounded-lg"
              >
                <Download className="size-3.5" />
                Export
              </Button>
            </div>

            {/* URL */}
            <div className="space-y-1.5">
              <Label className={labelStyles}>URL</Label>
              <Input
                value={formData.companyWebsite}
                onChange={(e) => handleInputChange("companyWebsite", e.target.value)}
                placeholder="yourcompany.com"
                className={inputStyles}
              />
            </div>

            {/* Brand Name */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className={labelStyles}>Brand Name</Label>
                <CharCount value={formData.companyName} max={CHAR_LIMITS.companyName} />
              </div>
              <Input
                value={formData.companyName}
                onChange={(e) => handleInputChange("companyName", e.target.value)}
                placeholder="Your company name"
                maxLength={CHAR_LIMITS.companyName}
                className={inputStyles}
              />
            </div>

            {/* Divider + Brand Information */}
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Brand Information</h3>
              <p className="text-sm text-white/40">Provide key brand facts for accurate and grounded content creation.</p>
            </div>

            {/* About the Brand */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className={labelStyles}>About the Brand</Label>
                <CharCount value={formData.companyDescription} max={CHAR_LIMITS.companyDescription} />
              </div>
              <Textarea
                value={formData.companyDescription}
                onChange={(e) => handleInputChange("companyDescription", e.target.value)}
                placeholder="Describe your brand's mission, values, and what makes it unique."
                maxLength={CHAR_LIMITS.companyDescription}
                rows={6}
                className={cn(inputStyles, "resize-none")}
              />
              <p className="text-xs text-white/25">Describe your brand's mission, values, and what makes it unique.</p>
            </div>

            {/* Ideal Customer Profile */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className={labelStyles}>Ideal Customer Profile</Label>
                <CharCount value={icpText} max={CHAR_LIMITS.companyICP} />
              </div>
              {(formData.companyICP as string[]).map((v, i) => (
                <div key={`icp-${i}`} className="flex items-start gap-2">
                  <Textarea
                    value={v}
                    onChange={(e) => updateMultiRow("companyICP", i, e.target.value)}
                    placeholder="e.g. Finance leaders at companies ranging from startups to enterprises..."
                    rows={4}
                    className={cn(inputStyles, "resize-none flex-1")}
                  />
                  {(formData.companyICP as string[]).length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow("companyICP", i)}
                      className="mt-2 text-white/20 hover:text-red-400 transition-colors"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => addRow("companyICP")}
                className="text-white/30 hover:text-white/60 h-8 px-2"
              >
                + Add segment
              </Button>
            </div>

            {/* Industry */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className={labelStyles}>Industry</Label>
                <CharCount value={formData.companyIndustry} max={CHAR_LIMITS.companyIndustry} />
              </div>
              <Input
                value={formData.companyIndustry}
                onChange={(e) => handleInputChange("companyIndustry", e.target.value)}
                placeholder="e.g. AI/Technology, SaaS, Finance"
                maxLength={CHAR_LIMITS.companyIndustry}
                className={inputStyles}
              />
            </div>

            {/* Services / Products */}
            <div className="space-y-1.5">
              <Label className={labelStyles}>Services / Products</Label>
              {(formData.companyServices as string[]).map((v, i) => (
                <div key={`svc-${i}`} className="flex items-center gap-2">
                  <Input
                    value={v}
                    onChange={(e) => updateMultiRow("companyServices", i, e.target.value)}
                    placeholder="e.g. GEO Platform, AI Optimization"
                    className={cn(inputStyles, "flex-1")}
                  />
                  {(formData.companyServices as string[]).length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow("companyServices", i)}
                      className="text-white/20 hover:text-red-400 transition-colors"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => addRow("companyServices")}
                className="text-white/30 hover:text-white/60 h-8 px-2"
              >
                + Add service
              </Button>
            </div>

            {/* Competitors */}
            <div className="space-y-1.5">
              <Label className={labelStyles}>Competitors</Label>
              {formData.competitors.map((v, i) => (
                <div key={`comp-${i}`} className="flex items-center gap-2">
                  <Input
                    value={v}
                    onChange={(e) => updateMultiRow("competitors", i, e.target.value)}
                    placeholder="https://competitor-website.com"
                    className={cn(inputStyles, "flex-1")}
                  />
                  {formData.competitors.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow("competitors", i)}
                      className="text-white/20 hover:text-red-400 transition-colors"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => addRow("competitors")}
                className="text-white/30 hover:text-white/60 h-8 px-2"
              >
                + Add competitor
              </Button>
            </div>

            {/* Social Links */}
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Social & Links</h3>
              <p className="text-sm text-white/40 mb-4">Connect your brand's online presence.</p>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className={labelStyles}>LinkedIn URL</Label>
                  <Input
                    value={formData.companyLinkedIn}
                    onChange={(e) => handleInputChange("companyLinkedIn", e.target.value)}
                    placeholder="https://linkedin.com/company/yourcompany"
                    className={inputStyles}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className={labelStyles}>Twitter / X URL</Label>
                  <Input
                    value={formData.companyTwitter}
                    onChange={(e) => handleInputChange("companyTwitter", e.target.value)}
                    placeholder="https://twitter.com/yourcompany"
                    className={inputStyles}
                  />
                </div>
              </div>
            </div>

            {/* Website Platform */}
            <div className="space-y-1.5">
              <Label className={labelStyles}>Website Platform</Label>
              <Select
                value={formData.websitePlatform || undefined}
                onValueChange={(value) => handleInputChange("websitePlatform", value === "__none__" ? "" : value)}
              >
                <SelectTrigger className={inputStyles}>
                  <SelectValue placeholder="Select if you use a no-code platform" />
                </SelectTrigger>
                <SelectContent className="bg-[#1b1b1b] border-white/[0.06]">
                  <SelectItem value="__none__" className="focus:bg-white/[0.06] text-white">None</SelectItem>
                  <SelectItem value="framer" className="focus:bg-white/[0.06] text-white">Framer</SelectItem>
                  <SelectItem value="webflow" className="focus:bg-white/[0.06] text-white">Webflow</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Knowledge Base Upload */}
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Documents</h3>
              <p className="text-sm text-white/40 mb-4">Upload documents to use as context for AI content generation.</p>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
                <input id="kb-files-edit" type="file" multiple accept={accepted} onChange={handleKBFiles} className="hidden" />
                <label htmlFor="kb-files-edit">
                  <Button type="button" variant="outline" size="sm" className="border-white/[0.08] bg-transparent text-white/70 hover:bg-white/[0.04] hover:text-white gap-1.5 rounded-lg cursor-pointer" asChild>
                    <span>
                      <Upload className="size-3.5" /> Select files
                    </span>
                  </Button>
                </label>
                <p className="text-xs text-white/25 mt-2">Accepted: PDF, DOCX, TXT, MD, CSV</p>
                {kbFiles.length > 0 && (
                  <ul className="mt-3 space-y-1 text-sm text-white/60">
                    {kbFiles.map((f, i) => (
                      <li key={i} className="flex items-center justify-between">
                        <span className="truncate">{f.name}</span>
                        <button
                          onClick={() => setKbFiles(prev => prev.filter((_, idx) => idx !== i))}
                          className="text-white/20 hover:text-red-400 ml-2"
                        >
                          <X className="size-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-2 pb-4">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  className="flex-1 border-white/[0.08] bg-transparent text-white/70 hover:bg-white/[0.04] hover:text-white rounded-lg"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 bg-white text-black hover:bg-white/90 rounded-lg font-medium"
                >
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
