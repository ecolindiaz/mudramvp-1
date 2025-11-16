import { Button } from "@/components/ui/button"
import { Bot } from "lucide-react"

interface BrowserWindowEmptyProps {
  text: string
  url?: string
  onAction?: () => void
}

export function BrowserWindowEmpty({ 
  text, 
  url = "trymudra.com",
  onAction
}: BrowserWindowEmptyProps) {
  return (
    <div className="relative w-[380px] h-[280px]">
      {/* Back card - deepest layer with opacity */}
      <div 
        className="absolute bg-neutral-950/50 h-[224px] w-[304px] 
                   left-[38px] top-0 rounded-2xl 
                   shadow-[0px_0px_0px_1px_rgba(255,255,255,0.14),0px_2px_4px_0px_rgba(0,0,0,0.16)]"
      />
      
      {/* Middle card */}
      <div 
        className="absolute bg-neutral-950 h-[252px] w-[342px] 
                   left-[19px] top-[22px] rounded-2xl 
                   shadow-[0px_0px_0px_1px_rgba(255,255,255,0.14),0px_2px_4px_0px_rgba(0,0,0,0.16)]"
      />
      
      {/* Front card - main browser window */}
      <div 
        className="absolute bg-neutral-950 h-[240px] w-full 
                   left-0 top-[44px] rounded-2xl overflow-hidden
                   shadow-[0px_0px_0px_1px_rgba(255,255,255,0.14),0px_2px_4px_0px_rgba(0,0,0,0.16)]"
      >
        {/* Browser chrome - top bar */}
        <div className="h-10 px-4 flex items-center gap-3 border-b border-white/5">
          {/* macOS-style window controls */}
          <div className="flex gap-2">
            <span className="w-3 h-3 rounded-full bg-white/80" />
            <span className="w-3 h-3 rounded-full bg-white/80" />
            <span className="w-3 h-3 rounded-full bg-white/80" />
          </div>
          
          {/* URL bar */}
          <div className="flex items-center gap-2.5 ml-6">
            {/* Lock icon */}
            <svg 
              width="18" 
              height="18" 
              viewBox="0 0 16 16" 
              fill="none"
              className="text-neutral-500"
            >
              <path 
                d="M12 7V5C12 2.79 10.21 1 8 1C5.79 1 4 2.79 4 5V7C2.9 7 2 7.9 2 9V13C2 14.1 2.9 15 4 15H12C13.1 15 14 14.1 14 13V9C14 7.9 13.1 7 12 7ZM5.5 5C5.5 3.62 6.62 2.5 8 2.5C9.38 2.5 10.5 3.62 10.5 5V7H5.5V5Z" 
                fill="currentColor"
              />
            </svg>
            
            {/* URL text */}
            <span className="text-sm text-neutral-500 font-mono">
              {url}
            </span>
          </div>
        </div>
        
        {/* Browser content area */}
        <div className="h-[190px] flex flex-col items-center justify-center relative gap-7 px-6 bg-gradient-to-b from-black/5 to-transparent">
          {/* Subtle vignette effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/10 pointer-events-none" />
          
          {/* Main text */}
          <h3 className="relative text-3xl font-bold text-white/90 tracking-tight text-center leading-tight antialiased">
            {text}
          </h3>
          
          {/* Deploy Button */}
          <Button 
            onClick={onAction}
            size="sm"
            className="relative h-8 px-4 rounded-md bg-white text-black hover:bg-white/90 text-xs font-medium shadow-sm hover:shadow transition-shadow gap-2"
          >
            <Bot className="h-3.5 w-3.5" />
            Deploy Droid
          </Button>
        </div>
      </div>
    </div>
  )
}

