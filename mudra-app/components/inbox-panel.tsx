"use client"

import * as React from "react"
import { RefreshCw, Bell, CheckCheck, X } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface Notification {
  id: string
  icon: React.ReactNode
  message: string
  timestamp: string
  isRead?: boolean
}

interface InboxPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

export function InboxPanel({ open, onOpenChange, children }: InboxPanelProps) {
  // Mock notifications data - replace with real data later
  const [notifications, setNotifications] = React.useState<Notification[]>([
    {
      id: "1",
      icon: <RefreshCw className="w-3.5 h-3.5" />,
      message: "Backsync complete: nano@trymudra.com synced back to December 18, 2025",
      timestamp: "20h ago",
      isRead: false,
    },
  ])

  const unreadCount = notifications.filter(n => !n.isRead).length

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
  }

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, isRead: true } : n
    ))
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={8}
        className="w-[380px] p-0 bg-dark-grey border border-white/[0.06] shadow-2xl shadow-black/50 rounded-xl overflow-hidden"
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
                className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            ) : (
              <button
                onClick={() => onOpenChange(false)}
                className="p-1 rounded-md hover:bg-white/[0.05] transition-colors"
              >
                <X className="w-4 h-4 text-white/40 hover:text-white/70" />
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="max-h-[360px] overflow-y-auto">
          {notifications.length > 0 ? (
            <div>
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => markAsRead(notification.id)}
                  className={`
                    relative px-4 py-3 cursor-pointer transition-colors
                    hover:bg-white/[0.03] border-b border-white/[0.04] last:border-b-0
                    ${!notification.isRead ? 'bg-white/[0.02]' : ''}
                  `}
                >
                  <div className="flex items-start gap-3">
                    {/* Unread indicator + Icon container */}
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 flex-shrink-0">
                        {!notification.isRead && (
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        )}
                      </div>
                      <div className="flex-shrink-0 p-1.5 rounded-md bg-white/[0.05] text-white/50">
                        {notification.icon}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] leading-relaxed ${notification.isRead ? 'text-white/50' : 'text-white/80'}`}>
                        {notification.message}
                      </p>
                      <span className="text-[11px] text-white/30 mt-1 block">
                        {notification.timestamp}
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
