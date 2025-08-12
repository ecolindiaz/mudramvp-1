import Image from "next/image"

export function MudraLogo() {
  return (
    <div className="flex items-center justify-center py-12">
      <Image
        src="/images/mudra-logo.png"
        alt="Mudra Logo"
        width={140}
        height={140}
        className="object-contain drop-shadow-sm"
      />
    </div>
  )
} 