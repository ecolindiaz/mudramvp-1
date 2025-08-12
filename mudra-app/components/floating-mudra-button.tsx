"use client"

interface FloatingMudraButtonProps {
  onClick?: () => void
  imageSrc?: string
  altText?: string
  ariaLabel?: string
}

export function FloatingMudraButton({ 
  onClick,
  imageSrc = "/images/mudra-logo.png",
  altText = "Mudra AI Assistant",
  ariaLabel = "Open Mudra AI Chat Assistant"
}: FloatingMudraButtonProps) {
  return (
    <button 
      onClick={onClick}
      aria-label={ariaLabel}
      className="fixed bottom-6 right-6 w-16 h-16 bg-black hover:bg-black/90 border border-white/20 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-lg z-50 group p-2"
      type="button"
    >
      <img 
        src={imageSrc} 
        alt={altText} 
        className="w-10 h-10 group-hover:scale-110 transition-transform duration-200 drop-shadow-sm"
      />
    </button>
  )
} 