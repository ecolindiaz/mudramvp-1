"use client"

interface GoalWidgetProps {
  goalText: string
  className?: string
}

export function GoalWidget({ goalText, className }: GoalWidgetProps) {
  return (
    <div className={className}>
      <div className="inline-block">
        <p className="text-sm font-semibold text-foreground px-4 py-2 bg-primary/10 border border-primary/30 rounded-full backdrop-blur-sm transition-all duration-200 hover:bg-primary/15 hover:border-primary/40">
          {goalText}
        </p>
      </div>
    </div>
  )
} 