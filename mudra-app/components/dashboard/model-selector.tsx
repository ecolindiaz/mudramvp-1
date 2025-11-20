"use client"

import * as React from "react"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectLabel,
} from "@/components/ui/select"

export type AIModel = "chatgpt" | "claude" | "perplexity" | "gemini" | "google-aio"

interface ModelSelectorProps {
  value?: AIModel
  onValueChange?: (value: AIModel) => void
}

const modelLabels = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  perplexity: "Perplexity",
  gemini: "Gemini",
  "google-aio": "Google AIO"
} as const

export function ModelSelector({ value = "chatgpt", onValueChange }: ModelSelectorProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger 
        className="w-[160px] bg-black hover:bg-black/90 border border-white/20 rounded-full transition-all duration-200 hover:scale-110 shadow-lg group ml-2"
      >
        <SelectValue 
          placeholder="Select AI model" 
          className="group-hover:scale-110 transition-transform duration-200"
        />
      </SelectTrigger>
      <SelectContent className="rounded-lg border border-white/20 bg-black">
        <SelectGroup>
          <SelectLabel className="text-white/70">AI Model</SelectLabel>
          {(Object.entries(modelLabels) as [AIModel, string][]).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
} 