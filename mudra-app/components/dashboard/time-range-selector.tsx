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

export type TimeRange = "7d" | "14d" | "1m"

interface TimeRangeSelectorProps {
  value?: TimeRange
  onValueChange?: (value: TimeRange) => void
}

export function TimeRangeSelector({ value = "7d", onValueChange }: TimeRangeSelectorProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger 
        className="w-[160px] bg-black hover:bg-black/90 border border-white/20 rounded-full transition-all duration-200 hover:scale-110 shadow-lg group"
      >
        <SelectValue 
          placeholder="Select time range" 
          className="group-hover:scale-110 transition-transform duration-200"
        />
      </SelectTrigger>
      <SelectContent className="rounded-lg border border-white/20 bg-black">
        <SelectGroup>
          <SelectLabel className="text-white/70">Time Range</SelectLabel>
          <SelectItem value="7d">Last 7 days</SelectItem>
          <SelectItem value="14d">Last 14 days</SelectItem>
          <SelectItem value="1m">Last month</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  )
} 