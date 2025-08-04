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

// Consistent styles for Mudra theme
const inputStyles = "bg-white/5 border-white/10 text-white placeholder-white/30 focus:bg-white/10 focus:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
const labelStyles = "text-white/80 text-sm font-medium"

export function BrandProfileForm() {
  const { profile, setProfile } = useBrandProfile();
  const [formData, setFormData] = useState(profile);
  const [isEditing, setIsEditing] = useState(false);

  // Sync formData with context profile when not editing
  useEffect(() => {
    if (!isEditing) {
      setFormData(profile);
    }
  }, [profile, isEditing]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = () => {
    setProfile(formData); // Persist to context
    // TODO: Optionally, send to backend API here
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData(profile); // Reset to last saved context
    setIsEditing(false);
  };

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
              className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:border-white/30"
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
            className="bg-white/10 text-white border border-white/20 hover:bg-white/20"
          >
            Edit Profile
          </Button>
        )}
      </div>

      {/* Company Information Section */}
      <Card className="bg-black/50 border-white/10 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white text-lg font-semibold">Company Information</CardTitle>
          <CardDescription className="text-white/50 text-sm">
            Basic information about your company
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="companyName" className="text-white/80 text-sm">Company Name</Label>
              <Input
                id="companyName"
                value={formData.companyName}
                onChange={(e) => handleInputChange("companyName", e.target.value)}
                disabled={!isEditing}
                className="bg-white/5 border-white/10 text-white placeholder-white/30 focus:bg-white/10 focus:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyWebsite" className="text-white/80 text-sm">Company Website</Label>
              <Input
                id="companyWebsite"
                value={formData.companyWebsite}
                onChange={(e) => handleInputChange("companyWebsite", e.target.value)}
                disabled={!isEditing}
                placeholder="https://yourcompany.com"
                className="bg-white/5 border-white/10 text-white placeholder-white/30 focus:bg-white/10 focus:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyLinkedIn" className="text-white/80 text-sm">LinkedIn URL</Label>
              <Input
                id="companyLinkedIn"
                value={formData.companyLinkedIn}
                onChange={(e) => handleInputChange("companyLinkedIn", e.target.value)}
                disabled={!isEditing}
                placeholder="https://linkedin.com/company/yourcompany"
                className="bg-white/5 border-white/10 text-white placeholder-white/30 focus:bg-white/10 focus:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyTwitter" className="text-white/80 text-sm">Twitter/X URL</Label>
              <Input
                id="companyTwitter"
                value={formData.companyTwitter}
                onChange={(e) => handleInputChange("companyTwitter", e.target.value)}
                disabled={!isEditing}
                placeholder="https://twitter.com/yourcompany"
                className="bg-white/5 border-white/10 text-white placeholder-white/30 focus:bg-white/10 focus:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Information Section */}
      <Card className="bg-black/50 border-white/10 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white text-lg font-semibold">Personal Information</CardTitle>
          <CardDescription className="text-white/50 text-sm">
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
      <Card className="bg-black/50 border-white/10 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white text-lg font-semibold">Company Profile</CardTitle>
          <CardDescription className="text-white/50 text-sm">
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
      <Card className="bg-black/50 border-white/10 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white text-lg font-semibold">Competitors</CardTitle>
          <CardDescription className="text-white/50 text-sm">
            Your main competitors for AI visibility tracking
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.competitors.map((competitor, index) => (
            <div key={index} className="space-y-2">
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
                    className="border-white/20 bg-transparent text-white hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-400"
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
              className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:border-white/30"
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

      {/* Visibility Metrics Section */}
      <Card className="bg-black/50 border-white/10 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white text-lg font-semibold">Current Visibility</CardTitle>
          <CardDescription className="text-white/50 text-sm">
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