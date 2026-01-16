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

const STORAGE_KEY = "mudra_brand_profile";

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
  // Initialize from localStorage immediately (prevents flicker)
  const [profile, setProfileState] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          console.log("💾 [BrandProfileContext] Loaded from cache:", parsed.companyName);
          return parsed;
        }
      } catch (error) {
        console.error("🔴 [BrandProfileContext] Error loading from cache:", error);
      }
    }
    return defaultProfile;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Save to localStorage whenever profile changes
  useEffect(() => {
    if (profile.id > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
        console.log("💾 [BrandProfileContext] Saved to cache:", profile.companyName);
      } catch (error) {
        console.error("🔴 [BrandProfileContext] Error saving to cache:", error);
      }
    }
  }, [profile]);

  // Load profile from API with timeout and retry
  const refreshBrandProfile = async () => {
    // Don't refetch if already loading
    if (isLoading) {
      console.log("⏭️ [BrandProfileContext] Skipping refresh - already loading");
      return;
    }

    try {
      setIsLoading(true);
      console.log("🔄 [BrandProfileContext] Refreshing brand profile...")
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch("/api/brand-profile", {
        signal: controller.signal,
        // Add cache headers for browser caching
        headers: {
          'Cache-Control': 'max-age=30' // Cache for 30 seconds
        }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        if (data && typeof data === "object" && data.id) {
          // Only update state if data actually changed and has a valid ID
          if (JSON.stringify(data) !== JSON.stringify(profile)) {
            console.log("✅ [BrandProfileContext] Profile updated:", data.companyName, "id:", data.id);
            setProfileState(data);
          } else {
            console.log("✨ [BrandProfileContext] Profile unchanged");
          }
          setRetryCount(0); // Reset retry count on success
        } else if (data === null) {
          // User is authenticated but has no brand profile yet (needs onboarding)
          console.log("⚠️ [BrandProfileContext] No brand profile found for user (needs onboarding)");
          setRetryCount(0);
        } else {
          console.warn("⚠️ [BrandProfileContext] API returned invalid data:", data);
        }
      } else {
        console.warn("⚠️ [BrandProfileContext] API returned non-OK status:", response.status);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error("🔴 [BrandProfileContext] Request timed out after 10s");
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
    } finally {
      setIsLoading(false);
    }
  };

  // Load profile from API on mount - ALWAYS fetch immediately for security
  // Cache is used for initial render (prevents flicker) but server is source of truth
  useEffect(() => {
    if (profile.id === 0) {
      console.log("🔄 [BrandProfileContext] No cache found, fetching profile...");
    } else {
      console.log("🔄 [BrandProfileContext] Cache exists, validating with server immediately...");
    }
    // Always fetch from server immediately to validate cached data
    // This prevents using stale/incorrect brandProfileId from a different user
    refreshBrandProfile();
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
    
    // Update state immediately for optimistic UI
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