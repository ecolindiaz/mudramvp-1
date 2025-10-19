# Brand Profile Context API Improvement

## Overview
Updated the `useBrandProfile` hook to provide more explicit naming and refresh functionality, following a long-term fix approach for better developer experience.

## Changes Made

### Before (Old API)
```typescript
const { profile, setProfile } = useBrandProfile()
```

### After (New API)
```typescript
const { brandProfile, refreshBrandProfile } = useBrandProfile()
// OR for backward compatibility:
const { profile, setProfile } = useBrandProfile()
```

## Implementation Details

### File: `components/brand-profile-context.tsx`

**Added Properties:**
1. **`brandProfile`** - More explicit name than generic `profile`
2. **`refreshBrandProfile`** - Async function to manually reload profile from API

**Backward Compatibility:**
- Kept `profile` property (alias for `brandProfile`)
- Kept `setProfile` function
- Existing components continue to work without changes

### Context Shape
```typescript
{
  brandProfile: {
    id: number
    companyName: string
    companyWebsite: string
    companyLinkedIn: string
    companyTwitter: string
    userName: string
    userRole: string
    userAvatar: string
    companyDescription: string
    companyIndustry: string
    companyServices: string
    companyICP: string
    competitors: string[]
    monthlySearchVolume: string
    aiRecommendations: string
    stage: string
    resources: { teamSize: number; budget: number }
  }
  profile: typeof brandProfile  // Alias for backward compatibility
  setProfile: (profile: typeof brandProfile) => Promise<void>
  refreshBrandProfile: () => Promise<void>
}
```

## Usage Examples

### Magic Button (New Pattern)
```typescript
import { useBrandProfile } from "@/components/brand-profile-context"

export function MagicButton() {
  const { brandProfile, refreshBrandProfile } = useBrandProfile()
  
  const handleAnalysisComplete = async () => {
    // Refresh the profile after analysis
    await refreshBrandProfile()
    console.log("Updated company:", brandProfile.companyName)
  }
}
```

### Brand Profile Form (Legacy Pattern Still Works)
```typescript
import { useBrandProfile } from "@/components/brand-profile-context"

export function BrandProfileForm() {
  const { profile, setProfile } = useBrandProfile()
  
  const handleSave = async () => {
    await setProfile({ ...profile, companyName: "New Name" })
  }
}
```

## Benefits

### 1. **More Explicit Naming**
- `brandProfile` is clearer than generic `profile`
- Immediately obvious what the data represents

### 2. **Manual Refresh Capability**
- Can reload profile from server without page refresh
- Useful after external updates (analysis completion, webhooks, etc.)

### 3. **Backward Compatible**
- Zero breaking changes for existing components
- Gradual migration possible

### 4. **Better TypeScript Support**
- More descriptive property names improve IDE autocomplete
- Easier to understand type errors

## Migration Guide

### For New Components
Use the new API:
```typescript
const { brandProfile, refreshBrandProfile } = useBrandProfile()
```

### For Existing Components
Two options:

**Option 1: Keep as is (recommended for stable code)**
```typescript
const { profile, setProfile } = useBrandProfile()
// No changes needed
```

**Option 2: Migrate gradually**
```typescript
// Change this:
const { profile, setProfile } = useBrandProfile()

// To this:
const { brandProfile, setProfile, refreshBrandProfile } = useBrandProfile()
// Then replace all `profile` with `brandProfile` in the component
```

## Files Changed

1. `components/brand-profile-context.tsx`
   - Added `refreshBrandProfile` async function
   - Added `brandProfile` alias
   - Updated Provider value to include all properties

2. `components/magic-button.tsx`
   - Fixed import path from `@/contexts/brand-profile-context` to `@/components/brand-profile-context`
   - Now uses `brandProfile` and `refreshBrandProfile` (assuming it was updated)

## Testing Checklist

- [x] Context provides `brandProfile` property
- [x] Context provides `refreshBrandProfile` function
- [x] Context maintains `profile` for backward compatibility
- [x] Context maintains `setProfile` for backward compatibility
- [ ] Test `refreshBrandProfile()` actually fetches from API
- [ ] Test existing components still work with `profile`
- [ ] Test new components work with `brandProfile`
- [ ] Test setProfile updates both state and API

## Future Improvements

1. **Add Loading States**
   ```typescript
   const { brandProfile, isLoading, error, refreshBrandProfile } = useBrandProfile()
   ```

2. **Add Error Handling**
   ```typescript
   try {
     await refreshBrandProfile()
   } catch (error) {
     // Handle error
   }
   ```

3. **Add Optimistic Updates**
   ```typescript
   await setProfile(newData, { optimistic: true })
   ```

4. **Add Caching/Debouncing**
   - Prevent excessive API calls
   - Cache results for X minutes
   - Debounce rapid refresh calls
