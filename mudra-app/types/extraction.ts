export interface ExtractedCompanyInfo {
  companyDescription: string
  industry: string
  servicesProducts: string[]
  idealCustomerProfiles: string[]
  competitorUrls: string[]
  competitorSource?: 'extracted' | 'ai_suggested' | 'merged'
}
