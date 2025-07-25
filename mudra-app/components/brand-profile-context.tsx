import { createContext, useContext, useState } from "react"

const defaultProfile = {
  companyName: "Mudra Inc.",
  companyWebsite: "https://trymudra.com",
  companyDescription: "A Generative Engine Optimization platform helping startups get mentioned by AI.",
  companyIndustry: "AI/Technology",
  companyServices: "GEO Platform, AI Optimization, Content Strategy",
  companyICP: "Startups, Marketing teams, GEO Specialists",
  competitors: [
    "https://competitor1.com",
    "https://competitor2.com",
    "https://competitor3.com"
  ],
  stage: "MVP",
  resources: { teamSize: 3, budget: 10000 }
}

const BrandProfileContext = createContext({
  profile: defaultProfile,
  setProfile: (profile: typeof defaultProfile) => {}
})

export function useBrandProfile() {
  return useContext(BrandProfileContext)
}

export function BrandProfileProvider({ children }) {
  const [profile, setProfile] = useState(defaultProfile)
  return (
    <BrandProfileContext.Provider value={{ profile, setProfile }}>
      {children}
    </BrandProfileContext.Provider>
  )
}
