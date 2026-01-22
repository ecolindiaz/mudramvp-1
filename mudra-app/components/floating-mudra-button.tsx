"use client"

interface TaskContext {
  id: number
  header: string
  type: string
  status: string
  description: string
  detailedSteps: {
    id: number
    title: string
    description: string
    completed: boolean
    estimatedTime: string
  }[]
  resources: {
    title: string
    url: string
    type: string
  }[]
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
  ariaLabel = "Open Mudra AI Insights"
}: FloatingMudraButtonProps) {
  const handleClick = () => {
    if (onClick) {
      onClick()
    } else {
      // Redirect to insights page
      window.location.href = '/dashboard/insights'
    }
  }

  return (
    <>
      <button 
        onClick={handleClick}
        aria-label={ariaLabel}
        className="fixed bottom-6 right-6 w-14 h-14 bg-black hover:bg-black/90 border border-gray-800 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-lg hover:shadow-xl z-50 group"
        type="button"
      >
        <img 
          src={imageSrc} 
          alt={altText} 
          className="w-8 h-8 group-hover:scale-110 transition-transform duration-200"
        />
      </button>
    </>
  )
} 