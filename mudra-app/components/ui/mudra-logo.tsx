import Image from "next/image"

export function MudraLogo({ size = 140, className = "" }: { size?: number; className?: string }) {
  return (
    <div className={`flex items-center justify-center py-8 ${className}`}>
      <Image
        src="/images/MudraMainLogo.png"
        alt="Mudra main logo"
        width={size}
        height={size}
        className="object-contain"
      />
    </div>
  )
} 