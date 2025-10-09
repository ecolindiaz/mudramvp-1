# Fix: setProfile Not Defined & Proper User/Brand Profile ID Assignment

## Problems Fixed

### 1. ReferenceError: setProfile is not defined
**Location:** `components/brand-profile-form.tsx`

**Error:**
```
ReferenceError: setProfile is not defined
    at handleSave (brand-profile-form.tsx:110:9)
```

**Root Cause:**
The component was calling `setProfile()` but wasn't importing it from the `useBrandProfile()` hook.

### 2. Brand Profile ID Not Available During Onboarding
**Location:** `components/onboarding/prompts-form.tsx`

**Issue:**
- Analysis pipeline was starting with `brandProfileId: 0`
- Profile was being saved but analysis didn't wait for the ID
- Race condition between profile save and analysis start

---

## Solutions Implemented

### 1. Fixed Brand Profile Form

#### Before (Broken)
```typescript
export function BrandProfileForm() {
  const [formData, setFormData] = useState(initialData)
  // ❌ setProfile not imported
  
  const handleSave = () => {
    setProfile(formData) // ❌ ReferenceError!
    setIsEditing(false)
  }
}
```

#### After (Fixed)
```typescript
export function BrandProfileForm() {
  const { profile, setProfile } = useBrandProfile() // ✅ Import both
  const [formData, setFormData] = useState(initialData)
  
  // ✅ Load profile data from context on mount
  useEffect(() => {
    if (profile && profile.companyName) {
      setFormData(profile)
    }
  }, [profile])
  
  const handleSave = async () => {
    console.log('💾 Saving brand profile:', formData)
    await setProfile(formData) // ✅ Now defined and async
    setIsEditing(false)
  }
  
  const handleCancel = () => {
    setFormData(profile) // ✅ Reset to saved profile
    setIsEditing(false)
  }
}
```

### 2. Fixed Onboarding Profile ID Assignment

#### Before (Race Condition)
```typescript
// prompts-form.tsx
useEffect(() => {
  if (analysisStarted && onboardingData.companyName) {
    const config = {
      brandProfileId: profile?.id || 0, // ❌ Often 0, causes error
      brandName: onboardingData.companyName,
      // ...
    }
    runPipeline(config) // ❌ Runs immediately, doesn't wait for ID
  }
}, [analysisStarted]) // ❌ Doesn't watch for profile.id changes
```

#### After (Proper Wait)
```typescript
// prompts-form.tsx
useEffect(() => {
  // ✅ Wait for BOTH analysisStarted AND valid profile ID
  if (analysisStarted && onboardingData.companyName && profile?.id && profile.id > 0) {
    console.log("✅ TRIGGERING ANALYSIS WITH PROFILE ID:", profile.id)
    
    const config = {
      brandProfileId: profile.id, // ✅ Always has valid ID
      brandName: onboardingData.companyName,
      website: onboardingData.companyWebsite || '',
      industry: onboardingData.companyIndustry || undefined,
      description: onboardingData.companyDescription || undefined,
      competitors: onboardingData.competitors || [],
    }
    
    runPipeline(config)
  } else {
    console.log("⏳ Waiting for:", {
      analysisStarted,
      hasCompanyName: !!onboardingData.companyName,
      profileId: profile?.id,
      profileIdValid: profile?.id && profile.id > 0
    })
  }
}, [analysisStarted, profile?.id]) // ✅ Watches for profile.id changes
```

---

## User & Brand Profile Assignment Flow

### Complete Onboarding Flow

```
Step 1: User completes onboarding forms
  ↓
  - Collects: companyName, website, description, etc.
  - Stores in onboardingContext

Step 2: User reaches final step (PromptsForm)
  ↓
  - Calls saveToProfile()
  - Converts onboarding data to brand profile format

Step 3: Brand Profile Creation (saveBrandProfile in prisma-brand-profile.ts)
  ↓
  ┌─────────────────────────────────────┐
  │ Check if profile exists             │
  └──────────┬──────────────────────────┘
             │
             ├─ IF EXISTS:
             │    └─ Update existing profile
             │       Return updated profile with ID
             │
             └─ IF NEW:
                  ├─ Create User record
                  │   - email: user@company.com
                  │   - name: from profile
                  │   - Returns userId ✅
                  │
                  ├─ Create BrandProfile record
                  │   - All company data
                  │   - userId: linked to User ✅
                  │   - Returns brandProfileId ✅
                  │
                  └─ Return complete profile with IDs

Step 4: Profile Context Updates
  ↓
  - BrandProfileContext receives saved profile
  - profile.id is now > 0
  - userId is linked in database

Step 5: Analysis Triggers (when profile.id > 0)
  ↓
  - PromptsForm detects profile.id change
  - Starts analysis with valid brandProfileId ✅
  - All database records linked to this brandProfileId
```

### Database Relationships

```sql
User Table
├─ id (userId) ✅
├─ email
├─ name
└─ createdAt

BrandProfile Table
├─ id (brandProfileId) ✅
├─ userId → User.id ✅ (Foreign Key)
├─ companyName
├─ companyWebsite
└─ ... (all company data)

GeoAnalysisResult Table
├─ id
├─ brandProfileId → BrandProfile.id ✅ (Foreign Key)
├─ overallScore
└─ analyses

TechnicalStructureAnalysis Table
├─ id
├─ brandProfileId → BrandProfile.id ✅ (Foreign Key)
├─ overallScore
└─ recommendations

NaturalLanguageReport Table
├─ id
├─ brandProfileId → BrandProfile.id ✅ (Foreign Key)
├─ title
└─ content
```

---

## Testing Scenarios

### Scenario 1: New User Onboarding

**Steps:**
1. User starts onboarding at `/welcome`
2. Fills in: Company name, website, description, etc.
3. Completes all steps
4. Reaches "PromptsForm" (final step)

**Expected Behavior:**
```
📝 Saving onboarding data to brand profile
🟢 Creating new brand profile...
🟢 Created user with ID: 1 ✅
🟢 Created brand profile with ID: 1 linked to user: 1 ✅
✅ Profile saved, waiting for ID to be available...
🟢 Profile ID check - profile.id: 1 ✅
🟢 ✅✅✅ TRIGGERING ANALYSIS WITH PROFILE ID: 1
[Unified Analysis] Starting for: Company Name
```

**Database Records Created:**
- ✅ User: `id=1, email=user@company.com`
- ✅ BrandProfile: `id=1, userId=1`
- ✅ GeoAnalysisResult: `brandProfileId=1`
- ✅ TechnicalStructureAnalysis: `brandProfileId=1`
- ✅ NaturalLanguageReport: `brandProfileId=1`

### Scenario 2: Existing User Updates Profile

**Steps:**
1. User navigates to `/dashboard/brand-profile`
2. Clicks "Edit" button
3. Updates company information
4. Clicks "Save Changes"

**Expected Behavior:**
```
💾 Saving brand profile: { id: 1, companyName: "Updated Name", ... }
🟢 Updating existing profile with ID: 1 ✅
✅ Brand profile updated successfully
```

**Database:**
- ✅ BrandProfile: `id=1` updated with new data
- ✅ userId remains unchanged

---

## Files Modified

### Fixed
- 📝 `components/brand-profile-form.tsx`
  - Added `const { profile, setProfile } = useBrandProfile()`
  - Added `useEffect` to load profile data on mount
  - Made `handleSave` async and await `setProfile()`
  - Fixed `handleCancel` to reset from profile

- 📝 `components/onboarding/prompts-form.tsx`
  - Updated condition to require `profile?.id && profile.id > 0`
  - Changed `profile?.id || 0` to always use valid `profile.id`
  - Added `profile?.id` to dependency array
  - Enhanced logging for debugging

### Already Working
- ✅ `lib/prisma-brand-profile.ts` - Properly creates User + BrandProfile
- ✅ `components/brand-profile-context.tsx` - Loads and updates profile
- ✅ `components/onboarding/onboarding-context.tsx` - Saves to profile

---

## Validation Checks

Each account now has:

1. ✅ **User ID** (`userId`)
   - Created during first profile save
   - Email: `user@{company-domain}`
   - Name: From profile

2. ✅ **Brand Profile ID** (`brandProfileId`)
   - Created with user
   - Linked to userId via foreign key
   - Used for all analysis records

3. ✅ **Analysis Records** linked to brandProfileId
   - GeoAnalysisResult
   - TechnicalStructureAnalysis  
   - NaturalLanguageReport
   - Prompts

---

## Error Prevention

### Before Fix
```
❌ setProfile is not defined → ReferenceError
❌ brandProfileId: 0 → Analysis fails
❌ Race condition → Inconsistent state
❌ No user tracking → Can't link records
```

### After Fix
```
✅ setProfile imported → No errors
✅ brandProfileId: {valid ID} → Analysis succeeds
✅ Waits for profile.id → Consistent state
✅ User + BrandProfile created → All records linked
```

---

## Summary

✅ **Fixed ReferenceError** in brand-profile-form by importing `setProfile`  
✅ **Fixed race condition** in prompts-form by waiting for `profile.id > 0`  
✅ **User ID assignment** happens automatically during profile creation  
✅ **Brand Profile ID assignment** returned immediately after creation  
✅ **All analysis records** properly linked via `brandProfileId` foreign key  
✅ **Onboarding flow** now waits for IDs before starting analysis  
✅ **Profile updates** work correctly in dashboard
