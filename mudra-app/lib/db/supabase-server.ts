import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cachedServiceClient: SupabaseClient | null = null

function assertServerOnly(): void {
  if (typeof window !== 'undefined') {
    throw new Error('getServiceClient() must be called on the server only')
  }
}

export function getServiceClient(): SupabaseClient {
  assertServerOnly()

  if (cachedServiceClient) return cachedServiceClient

  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error('Missing SUPABASE_URL environment variable')
  }
  if (!serviceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
  }

  cachedServiceClient = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return cachedServiceClient
}


