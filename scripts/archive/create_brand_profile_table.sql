-- Create BrandProfile table in Supabase
CREATE TABLE IF NOT EXISTS "BrandProfile" (
    "id" SERIAL NOT NULL,
    "companyName" TEXT,
    "companyWebsite" TEXT,
    "companyLinkedIn" TEXT,
    "companyTwitter" TEXT,
    "userName" TEXT,
    "userRole" TEXT,
    "userAvatar" TEXT,
    "companyDescription" TEXT,
    "companyIndustry" TEXT,
    "companyServices" TEXT,
    "companyICP" TEXT,
    "competitors" TEXT,
    "monthlySearchVolume" TEXT,
    "aiRecommendations" TEXT,
    "stage" TEXT,
    "resources" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BrandProfile_pkey" PRIMARY KEY ("id")
);

-- Create trigger to automatically update the updatedAt column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_brand_profile_updated_at 
    BEFORE UPDATE ON "BrandProfile" 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
