"use client"

import { useState } from "react"
import { ThumbsUp, ThumbsDown, Star, MessageSquare, Send, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type FeedbackTargetType = "REPORT" | "PROMPT" | "TECHNICAL" | "CAMPAIGN" | "ISSUE" | "OPPORTUNITY" | "AGENT_TASK" | "GENERAL"
type ThumbValue = "UP" | "DOWN" | null

interface FeedbackWidgetProps {
  targetType: FeedbackTargetType
  targetId?: string
  brandProfileId?: number
  /** "inline" renders the full form inline. "compact" renders a small trigger button that opens a popover. */
  variant?: "inline" | "compact"
  /** Label shown above the widget */
  label?: string
  className?: string
}

export function FeedbackWidget({
  targetType,
  targetId,
  brandProfileId,
  variant = "inline",
  label = "Was this helpful?",
  className,
}: FeedbackWidgetProps) {
  const [thumb, setThumb] = useState<ThumbValue>(null)
  const [rating, setRating] = useState<number>(0)
  const [hoverRating, setHoverRating] = useState<number>(0)
  const [comment, setComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [showComment, setShowComment] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const handleSubmit = async () => {
    if (!thumb && !rating && !comment.trim()) return

    setIsSubmitting(true)
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandProfileId,
          targetType,
          targetId,
          thumb: thumb ?? undefined,
          rating: rating || undefined,
          comment: comment.trim() || undefined,
          pageUrl: window.location.pathname,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error?.message || "Failed to submit feedback")
      }

      setIsSubmitted(true)
      setIsOpen(false)
      toast.success("Thanks for your feedback!")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit feedback")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleThumb = (value: ThumbValue) => {
    setThumb((prev) => (prev === value ? null : value))
  }

  const reset = () => {
    setThumb(null)
    setRating(0)
    setComment("")
    setShowComment(false)
    setIsSubmitted(false)
  }

  if (isSubmitted) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <span className="text-green-500">✓</span> Thanks for your feedback!
        <button onClick={reset} className="text-xs underline hover:text-foreground">
          Submit more
        </button>
      </div>
    )
  }

  const feedbackForm = (
    <div className={cn("space-y-3", variant === "inline" && className)}>
      {variant === "inline" && (
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      )}

      {/* Thumbs up/down */}
      <div className="flex items-center gap-2">
        <Button
          variant={thumb === "UP" ? "default" : "outline"}
          size="sm"
          onClick={() => handleThumb("UP")}
          className={cn("h-8 w-8 p-0", thumb === "UP" && "bg-green-600 hover:bg-green-700 border-green-600")}
        >
          <ThumbsUp className="h-4 w-4" />
        </Button>
        <Button
          variant={thumb === "DOWN" ? "default" : "outline"}
          size="sm"
          onClick={() => handleThumb("DOWN")}
          className={cn("h-8 w-8 p-0", thumb === "DOWN" && "bg-red-600 hover:bg-red-700 border-red-600")}
        >
          <ThumbsDown className="h-4 w-4" />
        </Button>

        <div className="mx-2 h-4 w-px bg-border" />

        {/* Star rating */}
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating((prev) => (prev === star ? 0 : star))}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-0.5 transition-colors"
            >
              <Star
                className={cn(
                  "h-4 w-4 transition-colors",
                  (hoverRating || rating) >= star
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-muted-foreground/40"
                )}
              />
            </button>
          ))}
        </div>

        <div className="mx-2 h-4 w-px bg-border" />

        {/* Toggle comment */}
        <Button
          variant={showComment ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setShowComment(!showComment)}
          className="h-8 gap-1.5 text-xs"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Comment
        </Button>
      </div>

      {/* Comment textarea */}
      {showComment && (
        <Textarea
          placeholder="Tell us what you think..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          className="resize-none text-sm"
        />
      )}

      {/* Submit - only show when there's something to submit */}
      {(thumb || rating > 0 || comment.trim()) && (
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="gap-1.5"
          >
            <Send className="h-3.5 w-3.5" />
            {isSubmitting ? "Sending..." : "Send Feedback"}
          </Button>
        </div>
      )}
    </div>
  )

  if (variant === "compact") {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs", className)}>
            <MessageSquare className="h-3.5 w-3.5" />
            Feedback
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{label}</p>
              <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            {feedbackForm}
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  return feedbackForm
}
