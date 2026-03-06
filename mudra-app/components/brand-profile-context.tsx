"use client"
import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react"

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
const ACTIVE_PROFILE_ID_KEY = "mudra_active_profile_id";
const ACTIVE_COUNTRY_KEY = "mudra_active_country";

const BrandProfileContext = createContext({
  brandProfile: defaultProfile,
  profile: defaultProfile,
  setProfile: async (profile: typeof defaultProfile) => defaultProfile,
  refreshBrandProfile: async () => {},
  switchProfile: async (profileId: number) => {},
  selectedCountry: "US",
  setSelectedCountry: (country: string) => {},
})

export function useBrandProfile() {
  return useContext(BrandProfileContext)
}

async function fetchWithRetryOn429(
  url: string,
  options?: RequestInit,
  maxRetries = 1
): Promise<Response> {
  const response = await fetch(url, options);
  if (response.status === 429 && maxRetries > 0) {
    const retryAfterHeader = response.headers.get('Retry-After');
    const retryAfterMs = Math.min((retryAfterHeader ? parseInt(retryAfterHeader, 10) : 5) * 1000, 30000);
    console.log(`[BrandProfileContext] 429 received, retrying in ${retryAfterMs}ms...`);
    await new Promise(resolve => setTimeout(resolve, retryAfterMs));
    return fetchWithRetryOn429(url, options, maxRetries - 1);
  }
  return response;
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

  // Track the active profile ID so refreshBrandProfile always fetches the correct one
  const profileIdRef = useRef<number>((() => {
    if (typeof window !== 'undefined') {
      const storedId = localStorage.getItem(ACTIVE_PROFILE_ID_KEY);
      if (storedId) return parseInt(storedId, 10) || 0;
    }
    return 0;
  })());

  // Initialize selectedCountry as "US" for SSR, then hydrate from localStorage
  const [selectedCountry, setSelectedCountryState] = useState("US");
  const [isLoading, setIsLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Hydrate selectedCountry from localStorage after mount (avoids SSR mismatch)
  const hasHydratedCountry = useRef(false);
  useEffect(() => {
    if (!hasHydratedCountry.current) {
      hasHydratedCountry.current = true;
      const stored = localStorage.getItem(ACTIVE_COUNTRY_KEY);
      if (stored) {
        setSelectedCountryState(stored);
      }
    }
  }, []);

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

  // Keep profileIdRef in sync with profile state
  useEffect(() => {
    if (profile.id > 0) {
      profileIdRef.current = profile.id;
      localStorage.setItem(ACTIVE_PROFILE_ID_KEY, String(profile.id));
    }
  }, [profile.id]);

  // Wrap setSelectedCountry to also persist to localStorage
  const setSelectedCountry = useCallback((country: string) => {
    setSelectedCountryState(country);
    try { localStorage.setItem(ACTIVE_COUNTRY_KEY, country); } catch {}
  }, []);

  // Sync selectedCountry to profile's primaryCountry ONLY on initial load
  // when localStorage doesn't have a user-chosen country.
  // This prevents page navigation from resetting the user's region selection.
  const profileCountry: string | undefined = (profile as any).primaryCountry;
  const hasInitializedCountry = useRef(false);
  useEffect(() => {
    if (profile.id > 0 && profileCountry && !hasInitializedCountry.current) {
      hasInitializedCountry.current = true;
      const storedCountry = localStorage.getItem(ACTIVE_COUNTRY_KEY);
      if (!storedCountry) {
        setSelectedCountry(profileCountry);
      }
    }
  }, [profile.id, profileCountry, setSelectedCountry]);

  // Use a ref to track loading state without causing re-renders of the callback
  const isLoadingRef = useRef(false);

  // Load profile from API with timeout and retry
  const refreshBrandProfile = useCallback(async () => {
    // Don't refetch if already loading
    if (isLoadingRef.current) {
      console.log("⏭️ [BrandProfileContext] Skipping refresh - already loading");
      return;
    }

    try {
      isLoadingRef.current = true;
      setIsLoading(true);
      // Use the tracked profile ID so we always fetch the user's selected profile
      const activeId = profileIdRef.current || (() => {
        try {
          const stored = localStorage.getItem(ACTIVE_PROFILE_ID_KEY);
          return stored ? parseInt(stored, 10) || 0 : 0;
        } catch { return 0; }
      })();

      const url = activeId > 0
        ? `/api/brand-profile?profileId=${activeId}`
        : "/api/brand-profile";

      console.log("🔄 [BrandProfileContext] Refreshing brand profile...", activeId > 0 ? `(profileId=${activeId})` : "(default)")

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetchWithRetryOn429(url, {
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
          setProfileState((prev: typeof defaultProfile) => {
            if (JSON.stringify(data) !== JSON.stringify(prev)) {
              console.log("✅ [BrandProfileContext] Profile updated:", data.companyName, "id:", data.id);
              return data;
            }
            console.log("✨ [BrandProfileContext] Profile unchanged");
            return prev;
          });
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
        setRetryCount((prev: number) => {
          if (prev < 3) {
            const delay = Math.pow(2, prev) * 1000; // 1s, 2s, 4s
            console.log(`🔄 [BrandProfileContext] Retrying in ${delay}ms... (attempt ${prev + 1}/3)`);
            return prev + 1;
          }
          return prev;
        });
      }
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, []);

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

  // Switch to a different brand profile by ID
  const switchProfile = useCallback(async (profileId: number) => {
    try {
      // Persist the active profile ID immediately so navigation doesn't reset it
      profileIdRef.current = profileId;
      localStorage.setItem(ACTIVE_PROFILE_ID_KEY, String(profileId));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(`/api/brand-profile?profileId=${profileId}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        const data = await response.json();
        if (data && data.id) {
          setProfileState(data);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          const country = data.primaryCountry || "US";
          setSelectedCountry(country);
        }
      }
    } catch (error) {
      console.error("[BrandProfileContext] Error switching profile:", error);
    }
  }, [setSelectedCountry]);

  // Save profile to API and update state
  const setProfile = useCallback(async (newProfile: typeof defaultProfile) => {
    console.log("🟡 [BrandProfileContext] setProfile called with:", newProfile)
    
    // Update state immediately for optimistic UI
    setProfileState(newProfile);
    
    try {
      console.log("🟡 [BrandProfileContext] Sending POST to /api/brand-profile...")
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetchWithRetryOn429("/api/brand-profile", {
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
        return data.profile;
      }
      return newProfile;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error("🔴 [BrandProfileContext] Save request timed out");
        throw new Error("Request timed out - please try again");
      }
      console.error("🔴 [BrandProfileContext] Error saving brand profile:", error.message || error);
      throw error;
    }
  }, []);

  const contextValue = useMemo(() => ({
    brandProfile: profile,
    profile,
    setProfile,
    refreshBrandProfile,
    switchProfile,
    selectedCountry,
    setSelectedCountry,
  }), [profile, setProfile, refreshBrandProfile, switchProfile, selectedCountry]);

  return (
    <BrandProfileContext.Provider value={contextValue}>
      {children}
    </BrandProfileContext.Provider>
  );
}