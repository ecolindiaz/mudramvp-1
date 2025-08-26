"use client"

 import { useEffect, useState } from "react"
import { AIChatInterface } from "@/components/ai-chat-interface"

interface TaskContext {
  id: number
  header: string
  type: string
  status: string
  description: string
  detailedSteps: { id: number; title: string; description: string; completed: boolean; estimatedTime: string }[]
  resources: { title: string; url: string; type: string }[]
  estimatedTime: string
  difficulty: string
}

interface FloatingMudraButtonProps {
  onClick?: () => void
  imageSrc?: string
  altText?: string
  ariaLabel?: string
  taskContext?: TaskContext[]
}

export function FloatingMudraButton({
  onClick,
  imageSrc = "/images/mudra-logo.png",
  altText = "Mudra AI Assistant",
  ariaLabel = "Open Mudra AI Chat Assistant",
  taskContext,
}: FloatingMudraButtonProps) {
  const [open, setOpen] = useState(false)

  // Listen for global event to programmatically open chat
  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener('mudra:open-chat', handler)
    return () => window.removeEventListener('mudra:open-chat', handler)
  }, [])

  const handleClick = () => {
    if (onClick) return onClick()
    setOpen((v) => !v)
  }

  return (
    <>
      <button
        onClick={handleClick}
        aria-label={ariaLabel}
        className="fixed bottom-6 right-6 w-14 h-14 bg-black hover:bg-black/90 border border-white/20 rounded flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-lg z-50 group"
        type="button"
      >
        <img
          src={imageSrc}
          alt={altText}
          className="w-8 h-8 group-hover:scale-110 transition-transform duration-200 drop-shadow-sm"
        />
      </button>

      <AIChatInterface open={open} onOpenChange={setOpen} taskContext={taskContext} />
    </>
  )
}