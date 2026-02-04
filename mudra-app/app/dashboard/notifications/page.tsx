"use client"

import React, { useState, useEffect } from "react"
import { BrandProfileProvider } from "@/components/brand-profile-context"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Bell, 
  BellOff, 
  Check, 
  CheckCheck,
  Mail, 
  MessageSquare, 
  Slack, 
  TrendingDown, 
  TrendingUp,
  AlertTriangle,
  Target,
  FileText,
  X
} from "lucide-react"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"

interface NotificationSettings {
  email: {
    analysisComplete: boolean
    weeklyReport: boolean
    visibilityChanges: boolean
    competitorAlerts: boolean
    systemUpdates: boolean
  }
  inApp: {
    analysisComplete: boolean
    weeklyReport: boolean
    visibilityChanges: boolean
    competitorAlerts: boolean
  }
  slack: {
    enabled: boolean
    analysisComplete: boolean
    visibilityChanges: boolean
    competitorAlerts: boolean
  }
}

interface Notification {
  id: string
  type: "success" | "warning" | "info" | "error"
  title: string
  message: string
  timestamp: Date
  read: boolean
  actionUrl?: string
}

function NotificationsPageInner() {
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("notifications")
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [settings, setSettings] = useState<NotificationSettings>({
    email: {
      analysisComplete: true,
      weeklyReport: true,
      visibilityChanges: true,
      competitorAlerts: false,
      systemUpdates: true,
    },
    inApp: {
      analysisComplete: true,
      weeklyReport: true,
      visibilityChanges: true,
      competitorAlerts: true,
    },
    slack: {
      enabled: false,
      analysisComplete: false,
      visibilityChanges: false,
      competitorAlerts: false,
    },
  })

  useEffect(() => {
    fetchNotifications()
    fetchSettings()
  }, [])

  const fetchNotifications = async () => {
    try {
      const response = await fetch("/api/notifications")
      const result = await response.json()
      
      if (response.ok && result.data) {
        setNotifications(result.data.map((notif: any) => ({
          ...notif,
          timestamp: new Date(notif.timestamp)
        })))
      }
    } catch (error) {
      console.error("Error fetching notifications:", error)
    }
  }

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/notifications/settings")
      const result = await response.json()
      
      if (response.ok && result.data) {
        setSettings(result.data)
      }
    } catch (error) {
      console.error("Error fetching settings:", error)
    }
  }

  const handleSettingChange = async (
    category: keyof NotificationSettings,
    setting: string,
    value: boolean
  ) => {
    const newSettings = {
      ...settings,
      [category]: {
        ...settings[category],
        [setting]: value,
      },
    }

    setSettings(newSettings)

    try {
      const response = await fetch("/api/notifications/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSettings),
      })

      if (!response.ok) {
        // Revert on error
        setSettings(settings)
        toast.error("Failed to update settings")
      } else {
        toast.success("Settings updated")
      }
    } catch (error) {
      setSettings(settings)
      console.error("Error updating settings:", error)
      toast.error("An error occurred")
    }
  }

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: "PATCH",
      })

      if (response.ok) {
        setNotifications(notifications.map(n => 
          n.id === notificationId ? { ...n, read: true } : n
        ))
      }
    } catch (error) {
      console.error("Error marking notification as read:", error)
    }
  }

  const handleMarkAllAsRead = async () => {
    setLoading(true)
    
    try {
      const response = await fetch("/api/notifications/read-all", {
        method: "POST",
      })

      if (response.ok) {
        setNotifications(notifications.map(n => ({ ...n, read: true })))
        toast.success("All notifications marked as read")
      } else {
        toast.error("Failed to mark notifications as read")
      }
    } catch (error) {
      console.error("Error marking all as read:", error)
      toast.error("An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setNotifications(notifications.filter(n => n.id !== notificationId))
        toast.success("Notification deleted")
      }
    } catch (error) {
      console.error("Error deleting notification:", error)
      toast.error("Failed to delete notification")
    }
  }

  const handleConnectSlack = async () => {
    setLoading(true)

    try {
      const response = await fetch("/api/integrations/slack/connect", {
        method: "POST",
      })

      const result = await response.json()

      if (response.ok && result.authUrl) {
        window.location.href = result.authUrl
      } else {
        toast.error("Failed to connect Slack")
      }
    } catch (error) {
      console.error("Error connecting Slack:", error)
      toast.error("An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "success":
        return <Check className="h-5 w-5 text-emerald-400" />
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-amber-400" />
      case "error":
        return <X className="h-5 w-5 text-red-400" />
      default:
        return <Bell className="h-5 w-5 text-blue-400" />
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length

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
                  <h1 className="text-2xl font-bold tracking-tight text-white">Notifications</h1>
                  <p className="text-sm text-white/60 mt-1">
                    Manage your notification preferences and view recent alerts
                  </p>
                </div>
                {unreadCount > 0 && (
                  <Badge className="bg-white/10 text-white border-white/20">
                    {unreadCount} Unread
                  </Badge>
                )}
              </div>
            </div>

            {/* Divider Line */}
            <div className="h-[0.25px] bg-white/10"></div>

            {/* Content */}
            <div className="flex-1 px-4 lg:px-6 py-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full max-w-4xl">
                <TabsList className="grid w-full grid-cols-2 bg-white/5">
                  <TabsTrigger value="notifications" className="relative">
                    Notifications
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                        {unreadCount}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>

                {/* Notifications Tab */}
                <TabsContent value="notifications" className="space-y-4 mt-6">
                  {unreadCount > 0 && (
                    <div className="flex items-center justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleMarkAllAsRead}
                        disabled={loading}
                        className="text-white hover:bg-white/5"
                      >
                        <CheckCheck className="h-4 w-4 mr-2" />
                        Mark all as read
                      </Button>
                    </div>
                  )}

                  {notifications.length > 0 ? (
                    <div className="space-y-2">
                      {notifications.map((notification) => (
                        <Card
                          key={notification.id}
                          className={`bg-transparent transition-all ${
                            notification.read
                              ? "border-white/[0.06] opacity-60"
                              : "border-white/[0.12]"
                          }`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-4">
                              <div className="mt-0.5">
                                {getNotificationIcon(notification.type)}
                              </div>
                              <div className="flex-1 space-y-1">
                                <div className="flex items-start justify-between gap-4">
                                  <div>
                                    <p className="text-white font-medium">{notification.title}</p>
                                    <p className="text-sm text-white/60 mt-1">{notification.message}</p>
                                    <p className="text-xs text-white/40 mt-2">
                                      {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {!notification.read && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleMarkAsRead(notification.id)}
                                        className="text-white hover:bg-white/5"
                                      >
                                        <Check className="h-4 w-4" />
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteNotification(notification.id)}
                                      className="text-white hover:bg-white/5"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                                {notification.actionUrl && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => window.location.href = notification.actionUrl!}
                                    className="border-white/10 text-white hover:bg-white/5 mt-3"
                                  >
                                    View Details
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card className="bg-transparent border-white/[0.04]">
                      <CardContent className="py-12 text-center">
                        <BellOff className="h-12 w-12 mx-auto mb-4 text-white/30" />
                        <h3 className="text-lg font-semibold text-white mb-2">No notifications yet</h3>
                        <p className="text-sm text-white/60">
                          When something important happens, you'll see it here
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Settings Tab */}
                <TabsContent value="settings" className="space-y-6 mt-6">
                  {/* Email Notifications */}
                  <Card className="bg-transparent border-white/[0.04]">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Mail className="h-5 w-5 text-white" />
                        <CardTitle className="text-white">Email Notifications</CardTitle>
                      </div>
                      <CardDescription className="text-white/60">
                        Receive notifications via email
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-white">Analysis Complete</Label>
                          <p className="text-sm text-white/50">
                            Get notified when your analysis is finished
                          </p>
                        </div>
                        <Switch
                          checked={settings.email.analysisComplete}
                          onCheckedChange={(checked) =>
                            handleSettingChange("email", "analysisComplete", checked)
                          }
                        />
                      </div>
                      <Separator className="border-white/10" />
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-white">Weekly Report</Label>
                          <p className="text-sm text-white/50">
                            Receive your weekly performance summary
                          </p>
                        </div>
                        <Switch
                          checked={settings.email.weeklyReport}
                          onCheckedChange={(checked) =>
                            handleSettingChange("email", "weeklyReport", checked)
                          }
                        />
                      </div>
                      <Separator className="border-white/10" />
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-white">Visibility Changes</Label>
                          <p className="text-sm text-white/50">
                            Alert when your AI visibility score changes significantly
                          </p>
                        </div>
                        <Switch
                          checked={settings.email.visibilityChanges}
                          onCheckedChange={(checked) =>
                            handleSettingChange("email", "visibilityChanges", checked)
                          }
                        />
                      </div>
                      <Separator className="border-white/10" />
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-white">Competitor Alerts</Label>
                          <p className="text-sm text-white/50">
                            Get notified about competitor activity
                          </p>
                        </div>
                        <Switch
                          checked={settings.email.competitorAlerts}
                          onCheckedChange={(checked) =>
                            handleSettingChange("email", "competitorAlerts", checked)
                          }
                        />
                      </div>
                      <Separator className="border-white/10" />
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-white">System Updates</Label>
                          <p className="text-sm text-white/50">
                            Receive news about new features and improvements
                          </p>
                        </div>
                        <Switch
                          checked={settings.email.systemUpdates}
                          onCheckedChange={(checked) =>
                            handleSettingChange("email", "systemUpdates", checked)
                          }
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* In-App Notifications */}
                  <Card className="bg-transparent border-white/[0.04]">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Bell className="h-5 w-5 text-white" />
                        <CardTitle className="text-white">In-App Notifications</CardTitle>
                      </div>
                      <CardDescription className="text-white/60">
                        Show notifications in the app
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-white">Analysis Complete</Label>
                          <p className="text-sm text-white/50">
                            Show banner when analysis is finished
                          </p>
                        </div>
                        <Switch
                          checked={settings.inApp.analysisComplete}
                          onCheckedChange={(checked) =>
                            handleSettingChange("inApp", "analysisComplete", checked)
                          }
                        />
                      </div>
                      <Separator className="border-white/10" />
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-white">Weekly Report</Label>
                          <p className="text-sm text-white/50">
                            Show notification when report is ready
                          </p>
                        </div>
                        <Switch
                          checked={settings.inApp.weeklyReport}
                          onCheckedChange={(checked) =>
                            handleSettingChange("inApp", "weeklyReport", checked)
                          }
                        />
                      </div>
                      <Separator className="border-white/10" />
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-white">Visibility Changes</Label>
                          <p className="text-sm text-white/50">
                            Show alerts for visibility score changes
                          </p>
                        </div>
                        <Switch
                          checked={settings.inApp.visibilityChanges}
                          onCheckedChange={(checked) =>
                            handleSettingChange("inApp", "visibilityChanges", checked)
                          }
                        />
                      </div>
                      <Separator className="border-white/10" />
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-white">Competitor Alerts</Label>
                          <p className="text-sm text-white/50">
                            Show competitor activity notifications
                          </p>
                        </div>
                        <Switch
                          checked={settings.inApp.competitorAlerts}
                          onCheckedChange={(checked) =>
                            handleSettingChange("inApp", "competitorAlerts", checked)
                          }
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Slack Integration */}
                  <Card className="bg-transparent border-white/[0.04]">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Slack className="h-5 w-5 text-white" />
                        <CardTitle className="text-white">Slack Integration</CardTitle>
                      </div>
                      <CardDescription className="text-white/60">
                        Send notifications to your Slack workspace
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {settings.slack.enabled ? (
                        <>
                          <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 bg-white rounded-lg flex items-center justify-center">
                                <Slack className="h-5 w-5 text-[#4A154B]" />
                              </div>
                              <div>
                                <p className="text-white font-medium">Connected to Slack</p>
                                <p className="text-sm text-white/50">#mudra-notifications</p>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSettingChange("slack", "enabled", false)}
                              className="border-white/10 text-white hover:bg-white/5"
                            >
                              Disconnect
                            </Button>
                          </div>
                          <Separator className="border-white/10" />
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label className="text-white">Analysis Complete</Label>
                              <p className="text-sm text-white/50">
                                Post to Slack when analysis is done
                              </p>
                            </div>
                            <Switch
                              checked={settings.slack.analysisComplete}
                              onCheckedChange={(checked) =>
                                handleSettingChange("slack", "analysisComplete", checked)
                              }
                            />
                          </div>
                          <Separator className="border-white/10" />
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label className="text-white">Visibility Changes</Label>
                              <p className="text-sm text-white/50">
                                Post visibility score changes
                              </p>
                            </div>
                            <Switch
                              checked={settings.slack.visibilityChanges}
                              onCheckedChange={(checked) =>
                                handleSettingChange("slack", "visibilityChanges", checked)
                              }
                            />
                          </div>
                          <Separator className="border-white/10" />
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label className="text-white">Competitor Alerts</Label>
                              <p className="text-sm text-white/50">
                                Post competitor activity updates
                              </p>
                            </div>
                            <Switch
                              checked={settings.slack.competitorAlerts}
                              onCheckedChange={(checked) =>
                                handleSettingChange("slack", "competitorAlerts", checked)
                              }
                            />
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-8">
                          <Slack className="h-12 w-12 mx-auto mb-4 text-white/30" />
                          <h3 className="text-lg font-semibold text-white mb-2">
                            Connect Slack
                          </h3>
                          <p className="text-sm text-white/60 mb-6">
                            Get real-time notifications in your Slack workspace
                          </p>
                          <Button
                            onClick={handleConnectSlack}
                            disabled={loading}
                            className="bg-white text-black hover:bg-white/90"
                          >
                            <Slack className="h-4 w-4 mr-2" />
                            Connect to Slack
                          </Button>
                        </div>
                      )}
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

export default function NotificationsPage() {
  return (
    <BrandProfileProvider>
      <NotificationsPageInner />
    </BrandProfileProvider>
  )
}
