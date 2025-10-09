"use client"
import { createContext, useContext, useState, useEffect } from "react"

const defaultProfile = {
  // ID from database
  id: 0,
  
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
    console.log("🟡 [BrandProfileContext] setProfile called with:", newProfile)
    setProfileState(newProfile);
    
    try {
      console.log("🟡 [BrandProfileContext] Sending POST to /api/brand-profile...")
      const response = await fetch("/api/brand-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProfile)
      });
      
      if (!response.ok) {
        console.error("🔴 [BrandProfileContext] Failed to save brand profile:", await response.text());
      } else {
        const data = await response.json();
        console.log("🟡 [BrandProfileContext] ✅ Brand profile saved successfully, response:", data);
        
        // Update state with the saved profile including the ID
        if (data.profile) {
          console.log("🟡 [BrandProfileContext] Updating state with profile ID:", data.profile.id)
          setProfileState(data.profile);
        }
      }
    } catch (error) {
      console.error("🔴 [BrandProfileContext] Error saving brand profile:", error);
    }
  };

  return (
    <BrandProfileContext.Provider value={{ profile, setProfile }}>
      {children}
    </BrandProfileContext.Provider>
  );
}
