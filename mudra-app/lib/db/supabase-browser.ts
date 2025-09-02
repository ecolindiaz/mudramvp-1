import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cachedBrowserClient: SupabaseClient | null = null

export function getBrowserClient(): SupabaseClient {
  if (typeof window === 'undefined') {
    throw new Error('getBrowserClient() must be called in the browser')
  }

  if (cachedBrowserClient) return cachedBrowserClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
  }
  if (!anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable')
  }

  cachedBrowserClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  })

  return cachedBrowserClient
}


