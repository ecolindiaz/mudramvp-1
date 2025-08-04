// 6. User Output Display
// This component displays campaign cards and user actions (save, copy, rate, etc.)

import React from "react"
import { Campaign } from "@/lib/llm/post-process-campaigns"

interface CampaignCardsProps {
  campaigns: (Campaign & { type?: string })[]
}

export default function CampaignCards({ campaigns }: CampaignCardsProps) {
  if (!campaigns || campaigns.length === 0) {
    return <div className="text-white/60">No campaigns to display.</div>
  }

  const handleCopy = (campaign: Campaign) => {
    navigator.clipboard.writeText(
      `${campaign.title}\n${campaign.objective}\n${campaign.description}`
    )
  }

  // Placeholder for save and rate actions
  const handleSave = (campaign: Campaign) => {
    // TODO: Implement save logic
    alert(`Saved: ${campaign.title}`)
  }
  const handleRate = (campaign: Campaign, rating: 'up' | 'down') => {
    // TODO: Implement rating logic
    alert(`Rated ${rating}: ${campaign.title}`)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {campaigns.map((c, i) => (
        <div key={i} className="bg-black/70 border border-white/10 rounded-lg p-6 shadow-lg flex flex-col gap-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold text-white">{c.title || `Campaign ${i + 1}`}</h2>
            <span className="text-xs px-2 py-1 rounded bg-white/10 text-white/70 border border-white/20">{c.type}</span>
          </div>
          <div className="text-white/80 text-sm mb-2">{c.objective}</div>
          <div className="text-white/60 text-xs mb-2">{c.description}</div>
          <div className="flex flex-wrap gap-2 text-xs text-white/60 mb-2">
            <span>Channel: <b>{c.channel}</b></span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-white/60 mb-2">
            {c.kpis && <span>KPIs: <b>{c.kpis}</b></span>}
            {c.tools && <span>Tools: <b>{c.tools}</b></span>}
          </div>
          <div className="flex gap-3 mt-auto">
            <button
              className="px-3 py-1 bg-white/10 text-white rounded hover:bg-white/20 border border-white/20"
              onClick={() => handleCopy(c)}
              title="Copy to clipboard"
            >Copy</button>
            <button
              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
              onClick={() => handleSave(c)}
              title="Save to dashboard"
            >Save</button>
            <button
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={() => handleRate(c, 'up')}
              title="Thumbs up"
            >👍</button>
            <button
              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
              onClick={() => handleRate(c, 'down')}
              title="Thumbs down"
            >👎</button>
          </div>
        </div>
      ))}
    </div>
  )
}
