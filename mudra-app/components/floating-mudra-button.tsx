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
  siteId: string
}

export function FloatingMudraButton({
  onClick,
  imageSrc = "/images/MudraMainLogo.png",
  altText = "Mudra AI Assistant",
  ariaLabel = "Open Mudra AI Chat Assistant",
  taskContext,
  siteId,
}: FloatingMudraButtonProps) {
  const [open, setOpen] = useState(false)

  // Listen for global event to programmatically open chat
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { initialMessage?: string } | undefined
      if (detail?.initialMessage) {
        try {
          const inputEl = document.querySelector<HTMLTextAreaElement>('textarea[placeholder="Ask me anything..."]')
          if (inputEl) {
            inputEl.value = detail.initialMessage
            inputEl.dispatchEvent(new Event('input', { bubbles: true }))
          }
        } catch {}
      }
      setOpen(true)
    }
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
        className="fixed bottom-6 right-6 w-14 h-14 bg-dark-grey hover:bg-white/10 border border-white/[0.08] hover:border-white/[0.12] rounded-lg flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl z-50 group"
        type="button"
      >
        <img
          src={imageSrc}
          alt={altText}
          className="w-8 h-8 transition-all duration-200 opacity-90 group-hover:opacity-100"
        />
      </button>

      <AIChatInterface open={open} onOpenChange={setOpen} siteId={siteId} taskContext={taskContext} />
    </>
  )
}