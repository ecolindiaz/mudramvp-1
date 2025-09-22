"use client"
import { createContext, useContext, useState, useEffect } from "react"

const defaultProfile = {
  // Company Information
  companyName: "",
  companyWebsite: "",
  companyLinkedIn: "",
  companyTwitter: "",

  // Personal Information
  userName: "",
  userRole: "",
  userAvatar: "",

  // Company Profile
  companyDescription: "",
  companyIndustry: "",
  companyServices: "",
  companyICP: "",

  // Competitors
  competitors: [] as string[],

  // Visibility Metrics
  monthlySearchVolume: "",
  aiRecommendations: "",

  // Extra fields for compatibility
  stage: "",
  resources: { teamSize: 0, budget: 0 }
};

const BrandProfileContext = createContext({
  profile: defaultProfile,
  setProfile: (profile: typeof defaultProfile) => {}
})

export function useBrandProfile() {
  return useContext(BrandProfileContext)
}

export function BrandProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfileState] = useState(defaultProfile);

  // Load profile from API on mount
  useEffect(() => {
    fetch("/api/brand-profile")
      .then(res => res.json())
      .then(data => {
        if (data && typeof data === "object") setProfileState(data);
      })
      .catch(() => {});
  }, []);

  // Save profile to API and update state
  const setProfile = async (newProfile: typeof defaultProfile) => {
    setProfileState(newProfile);
    
    try {
      const response = await fetch("/api/brand-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProfile)
      });
      
      if (!response.ok) {
        console.error("Failed to save brand profile:", await response.text());
      } else {
        console.log("✅ Brand profile saved successfully");
      }
    } catch (error) {
      console.error("Error saving brand profile:", error);
    }
  };

  return (
    <BrandProfileContext.Provider value={{ profile, setProfile }}>
      {children}
    </BrandProfileContext.Provider>
  );
}
