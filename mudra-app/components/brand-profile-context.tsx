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
  brandProfile: defaultProfile,
  profile: defaultProfile,
  setProfile: (profile: typeof defaultProfile) => {},
  refreshBrandProfile: async () => {}
})

export function useBrandProfile() {
  return useContext(BrandProfileContext)
}

export function BrandProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfileState] = useState(defaultProfile);
  const [retryCount, setRetryCount] = useState(0);

  // Load profile from API with timeout and retry
  const refreshBrandProfile = async () => {
    try {
      console.log("🔄 [BrandProfileContext] Refreshing brand profile...")
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout (increased for slow DB queries)
      
      const response = await fetch("/api/brand-profile", {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        if (data && typeof data === "object") {
          console.log("✅ [BrandProfileContext] Profile refreshed:", data);
          setProfileState(data);
          setRetryCount(0); // Reset retry count on success
        }
      } else {
        console.warn("⚠️ [BrandProfileContext] API returned non-OK status:", response.status);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error("🔴 [BrandProfileContext] Request timed out after 10s");
        // Don't retry on timeout - the backend already has its own timeout handling
      } else {
        console.error("🔴 [BrandProfileContext] Error refreshing profile:", error);
        
        // Retry logic - max 3 attempts with exponential backoff
        if (retryCount < 3) {
          const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
          console.log(`🔄 [BrandProfileContext] Retrying in ${delay}ms... (attempt ${retryCount + 1}/3)`);
          setTimeout(() => {
            setRetryCount((prev: number) => prev + 1);
          }, delay);
        }
      }
    }
  };

  // Load profile from API on mount with initial delay
  useEffect(() => {
    // Wait 2 seconds after mount to let Next.js fully initialize
    const initialDelay = setTimeout(() => {
      console.log("🔄 [BrandProfileContext] Starting initial profile fetch...");
      refreshBrandProfile();
    }, 2000);

    return () => clearTimeout(initialDelay);
  }, []);

  // Retry effect
  useEffect(() => {
    if (retryCount > 0 && retryCount <= 3) {
      refreshBrandProfile();
    }
  }, [retryCount]);

  // Save profile to API and update state
  const setProfile = async (newProfile: typeof defaultProfile) => {
    console.log("🟡 [BrandProfileContext] setProfile called with:", newProfile)
    setProfileState(newProfile);
    
    try {
      console.log("🟡 [BrandProfileContext] Sending POST to /api/brand-profile...")
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch("/api/brand-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProfile),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const data = await response.json();
      
      if (!response.ok) {
        const errorMessage = data.error?.message || "Unknown error";
        console.error("🔴 [BrandProfileContext] Failed to save brand profile:", errorMessage);
        throw new Error(errorMessage);
      }
      
      console.log("🟡 [BrandProfileContext] ✅ Brand profile saved successfully, response:", data);
      
      // Update state with the saved profile including the ID
      if (data.profile) {
        console.log("🟡 [BrandProfileContext] Updating state with profile ID:", data.profile.id)
        setProfileState(data.profile);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error("🔴 [BrandProfileContext] Save request timed out");
        throw new Error("Request timed out - please try again");
      }
      console.error("🔴 [BrandProfileContext] Error saving brand profile:", error.message || error);
      throw error;
    }
  };

  return (
    <BrandProfileContext.Provider value={{ 
      brandProfile: profile,
      profile,
      setProfile, 
      refreshBrandProfile 
    }}>
      {children}
    </BrandProfileContext.Provider>
  );
}