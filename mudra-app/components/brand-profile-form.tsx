"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

// Mock data - will be replaced with actual data from backend
const initialData = {
  // Company Information
  companyName: "Mudra Inc.",
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
  companyServices: "GEO Platform, AI Optimization, Content Strategy",
  companyICP: "Startups, Marketing teams, GEO Specialists",
  
  // Competitors
  competitors: [
    "https://competitor1.com",
    "https://competitor2.com",
    "https://competitor3.com"
  ],
  
  // Visibility Metrics
  monthlySearchVolume: "5,000",
  aiRecommendations: "Sometimes"
}

export function BrandProfileForm() {
  const [formData, setFormData] = useState(initialData)
  const [isEditing, setIsEditing] = useState(false)

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSave = () => {
    // TODO: Implement save functionality with backend
    console.log("Saving:", formData)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setFormData(initialData)
    setIsEditing(false)
  }

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        {isEditing ? (
          <>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Changes
            </Button>
          </>
        ) : (
          <Button onClick={() => setIsEditing(true)}>
            Edit Profile
          </Button>
        )}
      </div>

      {/* Company Information Section */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground">Company Information</CardTitle>
          <CardDescription className="text-muted-foreground">
            Basic information about your company
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                value={formData.companyName}
                onChange={(e) => handleInputChange("companyName", e.target.value)}
                disabled={!isEditing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyWebsite">Company Website</Label>
              <Input
                id="companyWebsite"
                value={formData.companyWebsite}
                onChange={(e) => handleInputChange("companyWebsite", e.target.value)}
                disabled={!isEditing}
                placeholder="https://yourcompany.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyLinkedIn">LinkedIn URL</Label>
              <Input
                id="companyLinkedIn"
                value={formData.companyLinkedIn}
                onChange={(e) => handleInputChange("companyLinkedIn", e.target.value)}
                disabled={!isEditing}
                placeholder="https://linkedin.com/company/yourcompany"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyTwitter">Twitter/X URL</Label>
              <Input
                id="companyTwitter"
                value={formData.companyTwitter}
                onChange={(e) => handleInputChange("companyTwitter", e.target.value)}
                disabled={!isEditing}
                placeholder="https://twitter.com/yourcompany"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Information Section */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground">Personal Information</CardTitle>
          <CardDescription className="text-muted-foreground">
            Your profile information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <Avatar className="h-20 w-20">
                <AvatarImage src={formData.userAvatar} />
                <AvatarFallback className="text-lg">
                  {formData.userName.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              {isEditing && (
                <Button variant="outline" size="sm">
                  Change Avatar
                </Button>
              )}
            </div>
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="userName">Full Name</Label>
                <Input
                  id="userName"
                  value={formData.userName}
                  onChange={(e) => handleInputChange("userName", e.target.value)}
                  disabled={!isEditing}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="userRole">Role</Label>
                <Input
                  id="userRole"
                  value={formData.userRole}
                  onChange={(e) => handleInputChange("userRole", e.target.value)}
                  disabled={!isEditing}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Company Profile Section */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground">Company Profile</CardTitle>
          <CardDescription className="text-muted-foreground">
            Detailed information about your business
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="companyDescription">Company Description</Label>
            <Textarea
              id="companyDescription"
              value={formData.companyDescription}
              onChange={(e) => handleInputChange("companyDescription", e.target.value)}
              disabled={!isEditing}
              rows={3}
              placeholder="Describe what your company does..."
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="companyIndustry">Industry</Label>
              <Input
                id="companyIndustry"
                value={formData.companyIndustry}
                onChange={(e) => handleInputChange("companyIndustry", e.target.value)}
                disabled={!isEditing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyServices">Services/Products</Label>
              <Input
                id="companyServices"
                value={formData.companyServices}
                onChange={(e) => handleInputChange("companyServices", e.target.value)}
                disabled={!isEditing}
                placeholder="Main services or products"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyICP">Target Audience (ICP)</Label>
            <Input
              id="companyICP"
              value={formData.companyICP}
              onChange={(e) => handleInputChange("companyICP", e.target.value)}
              disabled={!isEditing}
              placeholder="Who are your ideal customers?"
            />
          </div>
        </CardContent>
      </Card>

      {/* Competitors Section */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground">Competitors</CardTitle>
          <CardDescription className="text-muted-foreground">
            Your main competitors for AI visibility tracking
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.competitors.map((competitor, index) => (
            <div key={index} className="space-y-2">
              <Label htmlFor={`competitor${index + 1}`}>Competitor {index + 1}</Label>
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
              />
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
            >
              Add Competitor
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Visibility Metrics Section */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground">Current Visibility</CardTitle>
          <CardDescription className="text-muted-foreground">
            Current metrics and AI recommendation status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="monthlySearchVolume">Monthly Search Volume</Label>
              <Input
                id="monthlySearchVolume"
                value={formData.monthlySearchVolume}
                onChange={(e) => handleInputChange("monthlySearchVolume", e.target.value)}
                disabled={!isEditing}
                placeholder="e.g., 5,000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aiRecommendations">Do AI Models Recommend You?</Label>
              {isEditing ? (
                <Select
                  value={formData.aiRecommendations}
                  onValueChange={(value) => handleInputChange("aiRecommendations", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Never">Never</SelectItem>
                    <SelectItem value="Rarely">Rarely</SelectItem>
                    <SelectItem value="Sometimes">Sometimes</SelectItem>
                    <SelectItem value="Often">Often</SelectItem>
                    <SelectItem value="Always">Always</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={formData.aiRecommendations}
                  disabled
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 