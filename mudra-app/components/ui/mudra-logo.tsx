import Image from "next/image"

export function MudraLogo() {
  return (
    <div className="flex items-center justify-center py-8">
      <Image
        src="/images/mudra-logo.png"
        alt="Mudra Logo"
        width={120}
        height={120}
        className="object-contain"
      />
    </div>
  )
} 