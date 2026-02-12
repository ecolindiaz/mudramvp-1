'use client'

import { createContext, useContext } from 'react'

const NonceContext = createContext<string>('')

/**
 * Provides the per-request CSP nonce to client components that need to
 * render inline `<style>` or `<script>` tags (e.g. Recharts chart theming).
 */
export function NonceCspProvider({
  nonce,
  children,
}: {
  nonce: string
  children: React.ReactNode
}) {
  return <NonceContext.Provider value={nonce}>{children}</NonceContext.Provider>
}

/** Read the current CSP nonce inside a client component. */
export function useCspNonce(): string {
  return useContext(NonceContext)
}
