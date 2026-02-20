"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { ArrowRight, Loader2, ChevronDown, Plus, X } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { CircleFlag } from "react-circle-flags"
import { useOnboarding, type DomainEntry } from "./onboarding-context"
import { useCompanyExtraction } from "@/hooks/use-company-extraction"

const REGIONS = [
  { code: "US", label: "USA" },
  { code: "GB", label: "United Kingdom" },
  { code: "ES", label: "Spain" },
  { code: "MX", label: "Mexico" },
  { code: "AR", label: "Argentina" },
  { code: "CO", label: "Colombia" },
  { code: "PE", label: "Peru" },
]

export function WelcomeForm() {
  const router = useRouter()
  const { data, updateData } = useOnboarding()
  const [isLoading, setIsLoading] = useState(false)
  const [companyName, setCompanyName] = useState(data.companyName)
  const [domainEntries, setDomainEntries] = useState<DomainEntry[]>(
    data.domainEntries?.length
      ? data.domainEntries
      : [{ domain: data.companyWebsite || "", regions: data.trackingRegions || [] }]
  )

  const { isExtracting, extractedData, failed, startExtraction } = useCompanyExtraction()
  const [startedExtractionThisSession, setStartedExtractionThisSession] = useState(false)

  useEffect(() => {
    if (extractedData && startedExtractionThisSession) {
      updateData({
        extractedCompanyInfo: extractedData,
        extractionStatus: 'completed',
      })
    }
  }, [extractedData, startedExtractionThisSession, updateData])

  useEffect(() => {
    if (isExtracting) {
      updateData({ extractionStatus: 'extracting' })
      setStartedExtractionThisSession(true)
    }
  }, [isExtracting, updateData])

  useEffect(() => {
    if (failed && startedExtractionThisSession) {
      updateData({ extractionStatus: 'failed' })
    }
  }, [failed, startedExtractionThisSession, updateData])

  const handleWebsiteBlur = (url: string) => {
    const trimmed = url.trim()
    if (trimmed) startExtraction(trimmed)
  }

  const updateEntry = (index: number, field: keyof DomainEntry, value: string | string[]) => {
    setDomainEntries(prev => prev.map((entry, i) =>
      i === index ? { ...entry, [field]: value } : entry
    ))
  }

  const toggleRegion = (entryIndex: number, code: string) => {
    setDomainEntries(prev => prev.map((entry, i) => {
      if (i !== entryIndex) return entry
      const regions = entry.regions.includes(code)
        ? entry.regions.filter(r => r !== code)
        : [...entry.regions, code]
      return { ...entry, regions }
    }))
  }

  const addDomain = () => {
    if (domainEntries.length < 3) {
      setDomainEntries(prev => [...prev, { domain: "", regions: [] }])
    }
  }

  const removeDomain = (index: number) => {
    if (domainEntries.length > 1) {
      setDomainEntries(prev => prev.filter((_, i) => i !== index))
    }
  }

  const handleNext = async () => {
    setIsLoading(true)
    try {
      updateData({
        companyName,
        companyWebsite: domainEntries[0]?.domain || "",
        domainEntries,
      })
      router.push("/welcome/profile")
    } catch (error) {
      console.error("Failed to save welcome form data", error)
    } finally {
      setIsLoading(false)
    }
  }

  const isFormValid =
    companyName.trim() !== "" &&
    domainEntries[0]?.domain.trim() !== "" &&
    domainEntries.every(e => e.regions.length > 0)

  const regionSummary = (regions: string[]) => {
    if (regions.length === 0) return null
    if (regions.length <= 2) {
      return REGIONS.filter(r => regions.includes(r.code)).map(r => r.label).join(", ")
    }
    return `${regions.length} regions selected`
  }

  return (
    <Card className="w-full max-w-[480px] mx-auto bg-[#161616] border border-white/[0.06] rounded-2xl shadow-2xl">
      <CardHeader className="text-center pb-6">
        <CardTitle className="text-2xl font-semibold text-white">
          Welcome
        </CardTitle>
        <CardDescription className="text-white/70">
          Let's start with your brand information
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="companyName" className="text-sm font-medium text-white/90">
            Company Name
          </Label>
          <Input
            id="companyName"
            type="text"
            placeholder="Enter your company name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full bg-white/[0.03] border-[1.5px] border-white/[0.06] text-white placeholder:text-white/40 rounded-lg focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:!border-blue-500"
          />
        </div>

        {domainEntries.map((entry, index) => (
          <div key={index} className="space-y-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-white/90">
                {index === 0 ? "Company Domain" : `Domain ${index + 1}`}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="url"
                  placeholder="https://yourcompany.com"
                  value={entry.domain}
                  onChange={(e) => updateEntry(index, "domain", e.target.value)}
                  onBlur={(e) => index === 0 && handleWebsiteBlur(e.target.value)}
                  className="w-full bg-white/[0.03] border-[1.5px] border-white/[0.06] text-white placeholder:text-white/40 rounded-lg focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:!border-blue-500"
                />
                {index === 0 && isExtracting && (
                  <div className="shrink-0 flex items-center gap-1.5 text-white/50">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="text-xs whitespace-nowrap">Analyzing...</span>
                  </div>
                )}
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => removeDomain(index)}
                    className="shrink-0 p-1.5 rounded-md text-white/30 hover:text-white/70 hover:bg-white/[0.04] transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-white/90">
                Tracking Regions
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border-[1.5px] bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm items-center justify-between bg-white/[0.03] border-white/[0.06] text-white rounded-lg focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:!border-blue-500"
                  >
                    <span className={`truncate ${entry.regions.length > 0 ? "text-white" : "text-white/40"}`}>
                      {regionSummary(entry.regions) || "Select regions"}
                    </span>
                    <ChevronDown className="w-4 h-4 text-white/40" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-[var(--radix-popover-trigger-width)] p-1 bg-[#1a1a1a] border border-white/[0.08] rounded-lg"
                >
                  {REGIONS.map(region => (
                    <label
                      key={region.code}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-pointer hover:bg-white/[0.04] transition-colors"
                    >
                      <Checkbox
                        checked={entry.regions.includes(region.code)}
                        onCheckedChange={() => toggleRegion(index, region.code)}
                      />
                      <CircleFlag countryCode={region.code.toLowerCase()} height="16" width="16" className="flex-shrink-0" style={{ width: 16, height: 16 }} />
                      <span className="text-sm text-white/80">{region.label}</span>
                    </label>
                  ))}
                </PopoverContent>
              </Popover>
            </div>

            {index < domainEntries.length - 1 && (
              <div className="border-t border-white/[0.06]" />
            )}
          </div>
        ))}

        {domainEntries.length < 3 && (
          <button
            type="button"
            onClick={addDomain}
            className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add another domain
          </button>
        )}

        <Button
          type="button"
          onClick={handleNext}
          disabled={!isFormValid || isLoading || isExtracting}
          className="w-full h-10 bg-white text-black border border-white hover:bg-white/90 shadow-none rounded-lg disabled:bg-white disabled:text-black disabled:border-white/60 disabled:cursor-not-allowed disabled:opacity-100"
        >
          <div className="flex items-center justify-center gap-2">
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Next
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </div>
        </Button>
      </CardContent>
    </Card>
  )
}
