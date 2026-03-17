"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { RefreshCw, Bell, CheckCheck, X, Check, AlertTriangle } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface Notification {
  id: string
  type: "success" | "warning" | "info" | "error"
  title: string
  message: string
  timestamp: string
  read: boolean
  actionUrl?: string
}

interface InboxPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

function getNotificationIcon(type: string) {
  switch (type) {
    case "success":
      return <Check className="w-3.5 h-3.5" />
    case "warning":
      return <AlertTriangle className="w-3.5 h-3.5" />
    case "error":
      return <X className="w-3.5 h-3.5" />
    default:
      return <Bell className="w-3.5 h-3.5" />
  }
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDays = Math.floor(diffHr / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return `${Math.floor(diffDays / 7)}w ago`
}

export function InboxPanel({ open, onOpenChange, children }: InboxPanelProps) {
  const router = useRouter()
  const [notifications, setNotifications] = React.useState<Notification[]>([])
  const [loading, setLoading] = React.useState(false)
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [hasMore, setHasMore] = React.useState(false)
  const nextCursorRef = React.useRef<string | null>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const fetchNotifications = React.useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=20")
      if (!res.ok) return
      const result = await res.json()
      if (result.data) {
        setNotifications(result.data)
        setHasMore(result.hasMore ?? false)
        nextCursorRef.current = result.nextCursor ?? null
      }
    } catch (e) {
      console.error("Error fetching notifications:", e)
    }
  }, [])

  const loadMore = React.useCallback(async () => {
    if (loadingMore || !hasMore || !nextCursorRef.current) return
    setLoadingMore(true)
    try {
      const res = await fetch(`/api/notifications?limit=20&cursor=${nextCursorRef.current}`)
      if (!res.ok) return
      const result = await res.json()
      if (result.data) {
        setNotifications(prev => [...prev, ...result.data])
        setHasMore(result.hasMore ?? false)
        nextCursorRef.current = result.nextCursor ?? null
      }
    } catch (e) {
      console.error("Error loading more notifications:", e)
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMore])

  // Fetch on mount so the unread badge is visible even before opening
  React.useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // Poll every 60s when open
  React.useEffect(() => {
    if (open) {
      fetchNotifications()
      const interval = setInterval(fetchNotifications, 60000)
      return () => clearInterval(interval)
    }
  }, [open, fetchNotifications])

  // Also refetch on window focus
  React.useEffect(() => {
    const onFocus = () => fetchNotifications()
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [fetchNotifications])

  // Refetch when analysis or other background tasks complete
  React.useEffect(() => {
    const refetch = () => fetchNotifications()
    const events = [
      "mudra:analysis-complete",
      "mudra:website-analyzed",
      "mudra:nlr-refresh",
    ]
    events.forEach((e) => window.addEventListener(e, refetch))
    return () => {
      events.forEach((e) => window.removeEventListener(e, refetch))
    }
  }, [fetchNotifications])

  // Infinite scroll: load more when near bottom
  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
        loadMore()
      }
    }
    el.addEventListener("scroll", onScroll)
    return () => el.removeEventListener("scroll", onScroll)
  }, [loadMore])

  const unreadCount = notifications.filter(n => !n.read).length

  const markAllAsRead = async () => {
    setLoading(true)
    try {
      await fetch("/api/notifications/read-all", { method: "POST" })
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } catch (e) {
      console.error("Error marking all as read:", e)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "PATCH" })
      setNotifications(prev => prev.map(n =>
        n.id === id ? { ...n, read: true } : n
      ))
    } catch (e) {
      console.error("Error marking as read:", e)
    }
  }

  const handleClick = (notification: Notification) => {
    if (!notification.read) markAsRead(notification.id)
    if (notification.actionUrl) {
      onOpenChange(false)
      router.push(notification.actionUrl)
    }
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <div className="relative">
          {children}
          <span
            className={`absolute top-1/2 -translate-y-1/2 right-2 w-2 h-2 bg-blue-500 rounded-full transition-all duration-200 ${
              unreadCount > 0 && !open
                ? 'opacity-100 scale-100'
                : 'opacity-0 scale-0'
            }`}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={8}
        className="w-[380px] p-0 bg-dark-grey border border-white/[0.06] shadow-2xl shadow-black/50 rounded-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="border-b border-white/[0.06] px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-white">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1.5 text-[10px] font-medium text-white bg-white/10 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 ? (
              <button
                onClick={markAllAsRead}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors disabled:opacity-50"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            ) : (
              <button
                onClick={() => onOpenChange(false)}
                className="p-1 rounded-full hover:bg-white/[0.05] transition-colors"
              >
                <X className="w-4 h-4 text-white/40 hover:text-white/70" />
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div ref={scrollRef} className="max-h-[360px] overflow-y-auto">
          {notifications.length > 0 ? (
            <div>
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleClick(notification)}
                  className={`
                    relative px-4 py-3 cursor-pointer transition-all duration-200
                    hover:bg-white/[0.03] border-b border-white/[0.04] last:border-b-0
                    ${!notification.read ? 'bg-white/[0.02]' : ''}
                  `}
                >
                  <div className="flex items-start gap-3">
                    {/* Unread indicator + Icon container */}
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 flex-shrink-0">
                        <div
                          className={`w-1.5 h-1.5 rounded-full bg-blue-500 transition-all duration-200 ${
                            !notification.read ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
                          }`}
                        />
                      </div>
                      <div className="flex-shrink-0 p-1.5 rounded-lg bg-white/[0.05] text-white/50">
                        {getNotificationIcon(notification.type)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-medium leading-relaxed transition-colors duration-200 ${notification.read ? 'text-white/50' : 'text-white/90'}`}>
                        {notification.title}
                      </p>
                      <p className={`text-[12px] leading-relaxed mt-0.5 ${notification.read ? 'text-white/30' : 'text-white/60'}`}>
                        {notification.message}
                      </p>
                      <span className="text-[11px] text-white/30 mt-1 block">
                        {timeAgo(notification.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="p-3 rounded-full bg-white/[0.03] mb-3">
                <Bell className="w-5 h-5 text-white/20" />
              </div>
              <p className="text-white/40 text-sm">No notifications</p>
              <p className="text-white/20 text-xs mt-1">You're all caught up</p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
