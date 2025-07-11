"use client"

interface MetricWidgetProps {
  label: string
  value: string
  variant?: "period" | "current"
  className?: string
}

export function MetricWidget({ label, value, variant = "period", className }: MetricWidgetProps) {
  const baseClasses = "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200"
  
  const variantClasses = {
    period: "bg-muted/30 text-muted-foreground border border-muted-foreground/20 hover:bg-muted/40",
    current: "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/15"
  }

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      <span className="text-muted-foreground/80">{label}:</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
} 