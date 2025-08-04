// Semantic Search API Route for Relevant Case Study Sections
// Receives brand profile, queries Python FAISS API, returns top-N relevant sections

import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  // Accepts: { brandProfile, n_results }
  const { brandProfile, n_results = 20 } = await req.json()
  // Map frontend brandProfile to FastAPI BrandProfile
  const mappedProfile = {
    name: brandProfile.companyName || "",
    tagline: brandProfile.companyDescription || "",
    description: brandProfile.companyIndustry || "",
    target_audience: brandProfile.companyICP || "",
    tone: brandProfile.tone || "",
    stage: brandProfile.stage || "",
    goals: Array.isArray(brandProfile.goals) ? brandProfile.goals : []
  }
  const res = await fetch("http://localhost:8000/query-tweets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...mappedProfile, n_results })
  })
  if (!res.ok) {
    return NextResponse.json({ results: [], error: "Failed to query FAISS API" }, { status: 500 })
  }
  const json = await res.json()
  return NextResponse.json({ results: json.results })
}
