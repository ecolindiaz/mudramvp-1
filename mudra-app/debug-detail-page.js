console.log('=== DEBUG: Checking if detail page is loading real data ===')

// Run this in your browser console when on the prompt detail page
// Example: http://localhost:3000/dashboard/tracked-prompts/319

console.log('1. Current URL:', window.location.href)

// Check if BrandProfile context is available
console.log('2. Checking localStorage for brandProfile...')
console.log('   localStorage items:', {
  siteId: localStorage.getItem('mudra:siteId'),
  brandProfileId: localStorage.getItem('mudra:brandProfileId'),
})

// Check React DevTools for useBrandProfile state
console.log('3. Open React DevTools and look for BrandProfileProvider')
console.log('   It should show profile.id value')

// Monitor fetch calls
console.log('4. Monitoring fetch calls...')
const originalFetch = window.fetch
window.fetch = function(...args) {
  console.log('📡 FETCH CALL:', args[0])
  return originalFetch.apply(this, args).then(response => {
    console.log('📥 FETCH RESPONSE:', args[0], response.status)
    return response
  })
}

console.log('5. Now reload the page and watch for fetch calls')
console.log('   Expected: /api/prompts/[id]?brandProfileId=1')
