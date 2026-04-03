"use client"

import React, { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { BrandProfileProvider } from "@/components/brand-profile-context"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertCircle, Camera, Check, Key, Mail, Shield, Trash2, User as UserIcon, X } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { toast } from "sonner"
import { trackEvent } from "@/lib/analytics/posthog-events"

function AccountPageInner() {
  const { data: session, update } = useSession()
  
  // Handle loading state during server-side rendering
  if (!session) {
    return (
      <BrandProfileProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <SiteHeader />
            <div className="flex flex-1 flex-col gap-4 p-4">
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <p className="text-muted-foreground">Loading...</p>
                </div>
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </BrandProfileProvider>
    )
  }
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("profile")
  
  // Profile state
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  
  // Password state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  
  // Delete account state
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  useEffect(() => {
    if (session?.user) {
      setName(session.user.name || "")
      setEmail(session.user.email || "")
      setAvatarUrl(session.user.image || "")
    }
  }, [session])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      })

      const result = await response.json()

      if (response.ok) {
        trackEvent.profileUpdated()
        await update({ name, email })
        toast.success("Profile updated successfully")
      } else {
        toast.error(result.error?.message || "Failed to update profile")
      }
    } catch (error) {
      console.error("Error updating profile:", error)
      toast.error("An error occurred while updating your profile")
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (newPassword !== confirmPassword) {
      toast.error("New passwords don't match")
      return
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/user/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      const result = await response.json()

      if (response.ok) {
        trackEvent.passwordChanged()
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
        toast.success("Password changed successfully")
      } else {
        toast.error(result.error?.message || "Failed to change password")
      }
    } catch (error) {
      console.error("Error changing password:", error)
      toast.error("An error occurred while changing your password")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "DELETE") {
      toast.error("Please type DELETE to confirm")
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/user/delete", {
        method: "DELETE",
      })

      const result = await response.json()

      if (response.ok) {
        trackEvent.accountDeleted()
        toast.success("Account deleted successfully")
        window.location.href = "/login"
      } else {
        toast.error(result.error?.message || "Failed to delete account")
      }
    } catch (error) {
      console.error("Error deleting account:", error)
      toast.error("An error occurred while deleting your account")
    } finally {
      setLoading(false)
      setShowDeleteDialog(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be less than 2MB")
      return
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file")
      return
    }

    setLoading(true)

    try {
      const formData = new FormData()
      formData.append("avatar", file)

      const response = await fetch("/api/user/avatar", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()

      if (response.ok) {
        setAvatarUrl(result.avatarUrl)
        await update({ image: result.avatarUrl })
        toast.success("Avatar updated successfully")
      } else {
        toast.error(result.error?.message || "Failed to upload avatar")
      }
    } catch (error) {
      console.error("Error uploading avatar:", error)
      toast.error("An error occurred while uploading your avatar")
    } finally {
      setLoading(false)
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <SidebarProvider
      className="bg-dark-grey"
      style={
        {
          "--sidebar-width": "16rem",
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <Separator className="w-full border-border" />
        
        <div className="flex flex-1 flex-col overflow-auto">
          <div className="@container/main flex flex-1 flex-col">
            {/* Page Header */}
            <div className="px-4 lg:px-6 pt-6 pb-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold tracking-tight text-white">Account Settings</h1>
                  <p className="text-sm text-white/60 mt-1">
                    Keep your profile and security up to date.
                  </p>
                </div>
              </div>
            </div>

            {/* Divider Line */}
            <div className="h-[0.25px] bg-white/10"></div>

            {/* Content */}
            <div className="flex-1 px-4 lg:px-6 py-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full max-w-4xl">
                <TabsList className="grid w-full grid-cols-3 bg-white/5">
                  <TabsTrigger value="profile">Profile</TabsTrigger>
                  <TabsTrigger value="security">Security</TabsTrigger>
                  <TabsTrigger value="danger">Danger Zone</TabsTrigger>
                </TabsList>

                {/* Profile Tab */}
                <TabsContent value="profile" className="space-y-6 mt-6">
                  <Card className="bg-transparent border-white/[0.04]">
                    <CardHeader>
                      <CardTitle className="text-white">Profile Information</CardTitle>
                      <CardDescription className="text-white/60">
                        Basic info used across Morphiq.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Avatar Section */}
                      <div className="flex items-center gap-6">
                        <Avatar className="h-24 w-24 border-2 border-white/[0.04]">
                          <AvatarImage src={avatarUrl} alt={name} />
                          <AvatarFallback className="bg-white/10 text-white text-xl">
                            {getInitials(name || "User")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <Label htmlFor="avatar-upload" className="cursor-pointer">
                            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/[0.04] rounded-lg transition-colors w-fit">
                              <Camera className="h-4 w-4" />
                              <span className="text-sm">Update photo</span>
                            </div>
                            <input
                              id="avatar-upload"
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleAvatarUpload}
                              disabled={loading}
                            />
                          </Label>
                          <p className="text-xs text-white/50 mt-2">
                            JPG/PNG/GIF · Max 2MB.
                          </p>
                        </div>
                      </div>

                      <Separator className="border-white/[0.04]" />

                      {/* Profile Form */}
                      <form onSubmit={handleUpdateProfile} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="name" className="text-white">
                            <div className="flex items-center gap-2">
                              <UserIcon className="h-4 w-4" />
                              Full Name
                            </div>
                          </Label>
                          <Input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="bg-white/5 border-white/[0.04] text-white"
                            placeholder="Enter your full name"
                            disabled={loading}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="email" className="text-white">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              Email Address
                            </div>
                          </Label>
                          <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="bg-white/5 border-white/[0.04] text-white"
                            placeholder="Enter your email"
                            disabled={loading}
                          />
                          {session?.user?.emailVerified ? (
                            <div className="flex items-center gap-2 text-emerald-400 text-sm">
                              <Check className="h-4 w-4" />
                              Email verified
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-amber-400 text-sm">
                              <AlertCircle className="h-4 w-4" />
                              Email not verified
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-3 pt-4">
                          <Button
                            type="submit"
                            disabled={loading}
                            className="h-9 bg-white text-black hover:bg-white/90"
                          >
                            {loading ? "Saving..." : "Save Changes"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setName(session?.user?.name || "")
                              setEmail(session?.user?.email || "")
                            }}
                            disabled={loading}
                            className="h-9 border-white/[0.04] text-white hover:bg-white/5"
                          >
                            Reset
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>

                  {/* Connected Accounts */}
                  <Card className="bg-transparent border-white/[0.04]">
                    <CardHeader>
                      <CardTitle className="text-white">Connected Accounts</CardTitle>
                      <CardDescription className="text-white/60">
                        Manage sign-in methods.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/[0.04]">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center">
                            <svg className="h-5 w-5" viewBox="0 0 24 24">
                              <path
                                fill="#4285F4"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                              />
                              <path
                                fill="#34A853"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                              />
                              <path
                                fill="#FBBC05"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                              />
                              <path
                                fill="#EA4335"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                              />
                            </svg>
                          </div>
                          <div>
                            <p className="text-white font-medium">Google</p>
                            <p className="text-sm text-white/50">{email}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="border-emerald-500/20 text-emerald-400">
                          Connected
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Security Tab */}
                <TabsContent value="security" className="space-y-6 mt-6">
                  <Card className="bg-transparent border-white/[0.04]">
                    <CardHeader>
                      <CardTitle className="text-white">Change Password</CardTitle>
                      <CardDescription className="text-white/60">
                        Choose a strong password for your account.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleChangePassword} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="current-password" className="text-white">
                            <div className="flex items-center gap-2">
                              <Key className="h-4 w-4" />
                              Current Password
                            </div>
                          </Label>
                          <Input
                            id="current-password"
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="bg-white/5 border-white/[0.04] text-white"
                            placeholder="Enter current password"
                            disabled={loading}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="new-password" className="text-white">
                            New Password
                          </Label>
                          <Input
                            id="new-password"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="bg-white/5 border-white/[0.04] text-white"
                            placeholder="Enter new password"
                            disabled={loading}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="confirm-password" className="text-white">
                            Confirm New Password
                          </Label>
                          <Input
                            id="confirm-password"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="bg-white/5 border-white/[0.04] text-white"
                            placeholder="Confirm new password"
                            disabled={loading}
                          />
                        </div>

                        <div className="flex items-center gap-3 pt-4">
                          <Button
                            type="submit"
                            disabled={loading}
                            className="h-9 bg-white text-black hover:bg-white/90"
                          >
                            {loading ? "Changing..." : "Change Password"}
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>

                  <Card className="bg-transparent border-white/[0.04]">
                    <CardHeader>
                      <CardTitle className="text-white">Two-Factor Authentication</CardTitle>
                      <CardDescription className="text-white/60">
                        Add an extra layer of security.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/[0.04]">
                        <div>
                          <p className="text-white font-medium">Authenticator App</p>
                          <p className="text-sm text-white/50">Use an app to generate codes</p>
                        </div>
                        <Button variant="outline" size="sm" className="h-9 border-white/[0.04] text-white hover:bg-white/5">
                          Enable
                        </Button>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/[0.04]">
                        <div>
                          <p className="text-white font-medium">SMS Authentication</p>
                          <p className="text-sm text-white/50">Receive codes via text message</p>
                        </div>
                        <Button variant="outline" size="sm" className="h-9 border-white/[0.04] text-white hover:bg-white/5">
                          Enable
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Danger Zone Tab */}
                <TabsContent value="danger" className="space-y-6 mt-6">
                  <Card className="bg-transparent border-red-500/20">
                    <CardHeader>
                      <CardTitle className="text-red-400">Danger Zone</CardTitle>
                      <CardDescription className="text-white/60">
                        Irreversible actions that will permanently affect your account
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Alert className="bg-red-500/10 border-red-500/20">
                        <AlertCircle className="h-4 w-4 text-red-400" />
                        <AlertTitle className="text-red-400">Warning</AlertTitle>
                        <AlertDescription className="text-white/60">
                          Deleting your account is permanent and cannot be undone. All your data,
                          including brand profiles, analysis history, and settings will be permanently deleted.
                        </AlertDescription>
                      </Alert>

                      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                        <DialogTrigger asChild>
                          <Button
                            variant="destructive"
                            className="w-full bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Account
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-[#1a1a1a] border-white/[0.04]">
                          <DialogHeader>
                            <DialogTitle className="text-white">Are you absolutely sure?</DialogTitle>
                            <DialogDescription className="text-white/60">
                              This action cannot be undone. This will permanently delete your account
                              and remove all your data from our servers.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <Alert className="bg-red-500/10 border-red-500/20">
                              <AlertCircle className="h-4 w-4 text-red-400" />
                              <AlertTitle className="text-red-400">Final Warning</AlertTitle>
                              <AlertDescription className="text-white/60">
                                Type <strong>DELETE</strong> to confirm account deletion
                              </AlertDescription>
                            </Alert>
                            <Input
                              type="text"
                              value={deleteConfirmation}
                              onChange={(e) => setDeleteConfirmation(e.target.value)}
                              placeholder="Type DELETE to confirm"
                              className="bg-white/5 border-white/[0.04] text-white"
                            />
                          </div>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setShowDeleteDialog(false)
                                setDeleteConfirmation("")
                              }}
                              className="border-white/[0.04] text-white hover:bg-white/5"
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={handleDeleteAccount}
                              disabled={deleteConfirmation !== "DELETE" || loading}
                              className="bg-red-500 hover:bg-red-600"
                            >
                              {loading ? "Deleting..." : "Delete Account"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default function AccountPage() {
  return (
    <BrandProfileProvider>
      <AccountPageInner />
    </BrandProfileProvider>
  )
}
