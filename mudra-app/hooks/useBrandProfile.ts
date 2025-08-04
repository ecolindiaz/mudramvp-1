import { useState, useEffect } from 'react';

interface BrandProfile {
  id?: number;
  companyName?: string;
  companyWebsite?: string;
  companyLinkedIn?: string;
  companyTwitter?: string;
  userName?: string;
  userRole?: string;
  userAvatar?: string;
  companyDescription?: string;
  companyIndustry?: string;
  companyServices?: string;
  companyICP?: string;
  competitors?: string;
  monthlySearchVolume?: string;
  aiRecommendations?: string;
  stage?: string;
  resources?: string;
}

export function useBrandProfile() {
  const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBrandProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/brand-profile');
      if (!response.ok) {
        throw new Error('Failed to fetch brand profile');
      }
      const data = await response.json();
      setBrandProfile(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load brand profile');
      setBrandProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrandProfile();
  }, []);

  return {
    brandProfile,
    loading,
    error,
    refetch: fetchBrandProfile,
    hasWebsite: Boolean(brandProfile?.companyWebsite),
  };
}
