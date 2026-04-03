"use client"

import { useState, useEffect } from "react"
import { useBrandProfile } from "@/components/brand-profile-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Upload } from "lucide-react"
import { safeParseArray, safeParseICPArray } from "@/lib/utils/safe-parse-array"
import { trackEvent } from "@/lib/analytics/posthog-events"

// Consistent styles for Mudra theme
const inputStyles = "bg-white/[0.03] border-0 text-white placeholder-white/30 focus:bg-white/[0.05] disabled:opacity-50 disabled:cursor-not-allowed"
const labelStyles = "text-white/80 text-sm font-medium"

// Mock data - will be replaced with actual data from backend
const initialData = {
  // Company Information
  companyName: "Morphiq Inc.",
  companyWebsite: "https://trymudra.com",
  companyLinkedIn: "https://linkedin.com/company/mudra",
  companyTwitter: "https://twitter.com/mudra",
  
  // Personal Information
  userName: "John Doe",
  userRole: "CEO & Founder",
  userAvatar: "",
  
  // Company Profile
  companyDescription: "A Generative Engine Optimization platform helping startups get mentioned by AI.",
  companyIndustry: "AI/Technology",
  companyServices: ["GEO Platform", "AI Optimization", "Content Strategy"],
  companyICP: ["Startups", "Marketing teams", "GEO Specialists"],
  
  // Competitors
  competitors: [
    "https://competitor1.com",
    "https://competitor2.com",
    "https://competitor3.com"
  ],
  
  // Visibility Metrics
  monthlySearchVolume: "5,000",
  aiRecommendations: "Sometimes",

  // Website platform
  websitePlatform: ""
}

export function BrandProfileForm() {
  const { profile, setProfile } = useBrandProfile() // ✅ Get both profile AND setProfile from context
  const [formData, setFormData] = useState(initialData)
  const [isEditing, setIsEditing] = useState(false)
  const [kbFiles, setKbFiles] = useState<File[]>([])

  // Load profile data from context on mount
  useEffect(() => {
    if (profile && profile.companyName) {
      // Filter out null/undefined values so DB nulls don't overwrite defaults
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
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const accepted = ".pdf,.doc,.docx,.txt,.md,.csv"
  const handleKBFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files ? Array.from(e.target.files) : []
    setKbFiles((prev) => [...prev, ...list])
  }

  const updateMultiRow = (field: "companyServices" | "companyICP", idx: number, val: string) => {
    const arr = [...(formData[field] as string[])]
    arr[idx] = val
    setFormData(prev => ({ ...prev, [field]: arr }))
  }
  const addRow = (field: "companyServices" | "companyICP") => {
    setFormData(prev => ({ ...prev, [field]: [...(prev[field] as string[]), ""] }))
  }
  const removeRow = (field: "companyServices" | "companyICP", idx: number) => {
    const arr = (formData[field] as string[]).filter((_, i) => i !== idx)
    setFormData(prev => ({ ...prev, [field]: arr.length ? arr : [""] }))
  }

  const handleSave = async () => {
    console.log('💾 Saving brand profile:', formData)
    // Convert arrays to strings and merge with existing profile to preserve id, stage, resources
    const profileToSave = {
      ...profile,
      ...formData,
      companyServices: JSON.stringify(formData.companyServices),
      companyICP: JSON.stringify(formData.companyICP),
      competitors: formData.competitors, // Keep as array
    }
    try {
      await setProfile(profileToSave as any) // ✅ Persist to context and API
      trackEvent.profileUpdated()
      setIsEditing(false) // ✅ Close editing UI on successful save
    } catch (error) {
      console.error('❌ Failed to save brand profile:', error)
      // Keep editing UI open on error so user can retry
    }
  }

  const handleCancel = () => {
    // Reset to last saved context, parsing arrays
    const nonNullProfile = Object.fromEntries(
      Object.entries(profile).filter(([_, v]) => v != null)
    )
    const profileData = {
      ...initialData,
      ...nonNullProfile,
      companyServices: safeParseArray(profile.companyServices, initialData.companyServices),
      companyICP: safeParseArray(profile.companyICP, initialData.companyICP),
      competitors: safeParseArray(profile.competitors, initialData.competitors),
    }
    setFormData(profileData)
    setIsEditing(false)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Brand Profile</h1>
        <p className="text-white/60">Manage your company information and AI visibility settings</p>
      </div>
      
      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        {isEditing ? (
          <>
            <Button 
              variant="outline" 
              onClick={handleCancel}
              className="border-white/[0.04] bg-white/[0.03] text-white hover:bg-white/[0.06] hover:border-white/[0.08]"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              className="bg-white text-black hover:bg-white/90"
            >
              Save Changes
            </Button>
          </>
        ) : (
          <Button 
            onClick={() => setIsEditing(true)}
            className="bg-white/[0.05] text-white border-0 hover:bg-white/[0.08]"
          >
            Edit Profile
          </Button>
        )}
      </div>

      {/* Company Information Section */}
      <Card className="bg-[#161616] border-0 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-white text-lg font-semibold">Company Information</CardTitle>
          <CardDescription className="text-white/50 text-sm">
            Basic information about your company
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-white/[0.04] p-4 space-y-2">
              <Label htmlFor="companyName" className="text-white/80 text-sm">Company Name</Label>
              <Input
                id="companyName"
                value={formData.companyName}
                onChange={(e) => handleInputChange("companyName", e.target.value)}
                disabled={!isEditing}
                className="bg-white/[0.03] border-0 text-white placeholder-white/30 focus:bg-white/[0.05] disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div className="rounded-lg border border-white/[0.04] p-4 space-y-2">
              <Label htmlFor="companyWebsite" className="text-white/80 text-sm">Company Website</Label>
              <Input
                id="companyWebsite"
                value={formData.companyWebsite}
                onChange={(e) => handleInputChange("companyWebsite", e.target.value)}
                disabled={!isEditing}
                placeholder="https://yourcompany.com"
                className="bg-white/[0.03] border-0 text-white placeholder-white/30 focus:bg-white/[0.05] disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div className="rounded-lg border border-white/[0.04] p-4 space-y-2">
              <Label htmlFor="companyLinkedIn" className="text-white/80 text-sm">LinkedIn URL</Label>
              <Input
                id="companyLinkedIn"
                value={formData.companyLinkedIn}
                onChange={(e) => handleInputChange("companyLinkedIn", e.target.value)}
                disabled={!isEditing}
                placeholder="https://linkedin.com/company/yourcompany"
                className="bg-white/[0.03] border-0 text-white placeholder-white/30 focus:bg-white/[0.05] disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div className="rounded-lg border border-white/[0.04] p-4 space-y-2">
              <Label htmlFor="companyTwitter" className="text-white/80 text-sm">Twitter/X URL</Label>
              <Input
                id="companyTwitter"
                value={formData.companyTwitter}
                onChange={(e) => handleInputChange("companyTwitter", e.target.value)}
                disabled={!isEditing}
                placeholder="https://twitter.com/yourcompany"
                className="bg-white/[0.03] border-0 text-white placeholder-white/30 focus:bg-white/[0.05] disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Information Section */}
      <Card className="bg-[#161616] border-0 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-white text-lg font-semibold">Personal Information</CardTitle>
          <CardDescription className="text-white/50 text-sm">
            Your profile information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-6">
            <div className="rounded-lg border border-white/[0.04] p-4 flex flex-col items-center gap-2">
              <Avatar className="h-20 w-20">
                <AvatarImage src={formData.userAvatar || undefined} />
                <AvatarFallback className="text-lg">
                  {(formData.userName || '').split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              {isEditing && (
                <Button variant="outline" size="sm">
                  Change Avatar
                </Button>
              )}
            </div>
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-white/[0.04] p-4 space-y-2">
                <Label htmlFor="userName">Full Name</Label>
                <Input
                  id="userName"
                  value={formData.userName}
                  onChange={(e) => handleInputChange("userName", e.target.value)}
                  disabled={!isEditing}
                  className={inputStyles}
                />
              </div>
              <div className="rounded-lg border border-white/[0.04] p-4 space-y-2">
                <Label htmlFor="userRole">Role</Label>
                <Input
                  id="userRole"
                  value={formData.userRole}
                  onChange={(e) => handleInputChange("userRole", e.target.value)}
                  disabled={!isEditing}
                  className={inputStyles}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Company Profile Section */}
      <Card className="bg-[#161616] border-0 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-white text-lg font-semibold">Company Profile</CardTitle>
          <CardDescription className="text-white/50 text-sm">
            Detailed information about your business
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-white/[0.04] p-4 space-y-2">
            <Label htmlFor="companyDescription">Company Description</Label>
            <Textarea
              id="companyDescription"
              value={formData.companyDescription}
              onChange={(e) => handleInputChange("companyDescription", e.target.value)}
              disabled={!isEditing}
              rows={3}
              placeholder="Describe what your company does..."
              className={inputStyles}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-white/[0.04] p-4 space-y-2">
              <Label htmlFor="companyIndustry">Industry</Label>
              <Input
                id="companyIndustry"
                value={formData.companyIndustry}
                onChange={(e) => handleInputChange("companyIndustry", e.target.value)}
                disabled={!isEditing}
                className={inputStyles}
              />
            </div>
            <div className="rounded-lg border border-white/[0.04] p-4 space-y-2">
              <Label>Services / Products</Label>
              {(formData.companyServices as string[]).map((v, i) => (
                <div key={`svc-${i}`} className="flex items-center gap-2">
                  <Input
                    value={v}
                    onChange={(e) => updateMultiRow("companyServices", i, e.target.value)}
                    disabled={!isEditing}
                    placeholder="e.g. Web design, AI tools, Consulting"
                    className={inputStyles}
                  />
                  {isEditing && (formData.companyServices as string[]).length > 1 && (
                    <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-full" onClick={() => removeRow("companyServices", i)}>×</Button>
                  )}
                </div>
              ))}
              {isEditing && (
                <Button type="button" variant="outline" size="sm" className="h-9 rounded-full" onClick={() => addRow("companyServices")}>Add another</Button>
              )}
            </div>
          </div>
          <div className="rounded-lg border border-white/[0.04] p-4 space-y-2">
            <Label>Ideal Customer Profiles</Label>
            {(formData.companyICP as string[]).map((v, i) => (
              <div key={`icp-${i}`} className="flex items-center gap-2">
                <Input
                  value={v}
                  onChange={(e) => updateMultiRow("companyICP", i, e.target.value)}
                  disabled={!isEditing}
                  placeholder="e.g. Startup founders, SMB marketers, Enterprise IT"
                  className={inputStyles}
                />
                {isEditing && (formData.companyICP as string[]).length > 1 && (
                  <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-full" onClick={() => removeRow("companyICP", i)}>×</Button>
                )}
              </div>
            ))}
            {isEditing && (
              <Button type="button" variant="outline" size="sm" className="h-9 rounded-full" onClick={() => addRow("companyICP")}>Add another</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Website Platform Section */}
      <Card className="bg-[#161616] border-0 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-white text-lg font-semibold">Website Platform</CardTitle>
          <CardDescription className="text-white/50 text-sm">
            Select your website platform for tailored code instructions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-white/[0.04] p-4 space-y-2">
            <Label htmlFor="websitePlatform" className={labelStyles}>Platform</Label>
            <Select
              value={formData.websitePlatform || undefined}
              onValueChange={(value) => handleInputChange("websitePlatform", value === "__none__" ? "" : value)}
              disabled={!isEditing}
            >
              <SelectTrigger className={inputStyles}>
                <SelectValue placeholder="Select if you use a no-code platform" />
              </SelectTrigger>
              <SelectContent className="bg-[#161616] border-white/[0.06]">
                <SelectItem value="__none__">None</SelectItem>
                <SelectItem value="framer">Framer</SelectItem>
                <SelectItem value="webflow">Webflow</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Competitors Section */}
      <Card className="bg-[#161616] border-0 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-white text-lg font-semibold">Competitors</CardTitle>
          <CardDescription className="text-white/50 text-sm">
            Your main competitors for AI visibility tracking
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.competitors.map((competitor, index) => (
            <div key={index} className="rounded-lg border border-white/[0.04] p-4 space-y-2">
              <Label htmlFor={`competitor${index + 1}`} className={labelStyles}>
                Competitor {index + 1}
              </Label>
              <div className="flex gap-2">
                <Input
                  id={`competitor${index + 1}`}
                  value={competitor}
                  onChange={(e) => {
                    const newCompetitors = [...formData.competitors]
                    newCompetitors[index] = e.target.value
                    setFormData(prev => ({ ...prev, competitors: newCompetitors }))
                  }}
                  disabled={!isEditing}
                  placeholder="https://competitor-website.com"
                  className={inputStyles}
                />
                {isEditing && formData.competitors.length > 1 && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const newCompetitors = formData.competitors.filter((_, i) => i !== index)
                      setFormData(prev => ({ ...prev, competitors: newCompetitors }))
                    }}
                    className="border-white/[0.04] bg-white/[0.03] text-white hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-400"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </Button>
                )}
              </div>
            </div>
          ))}
          {isEditing && (
            <Button
              variant="outline"
              onClick={() => {
                setFormData(prev => ({
                  ...prev,
                  competitors: [...prev.competitors, ""]
                }))
              }}
              className="border-white/[0.04] bg-white/[0.03] text-white hover:bg-white/[0.06] hover:border-white/[0.08]"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-2"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Competitor
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Knowledge Base Uploader */}
      <Card className="bg-[#161616] border-0 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-white text-lg font-semibold">Knowledge Base</CardTitle>
          <CardDescription className="text-white/50 text-sm">Upload documents to use as context (optional)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-white/[0.04] p-4">
            <input id="kb-files-dash" type="file" multiple accept={accepted} onChange={handleKBFiles} className="hidden" />
            {isEditing && (
              <label htmlFor="kb-files-dash">
                <Button type="button" variant="outline" className="h-9 rounded-full gap-2">
                  <Upload className="size-4" /> Select files
                </Button>
              </label>
            )}
            {kbFiles.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-white/80">
                {kbFiles.map((f, i) => (
                  <li key={i} className="truncate">{f.name}</li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 