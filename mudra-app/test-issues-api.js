/**
 * Test Issues API
 * Quick script to test the /api/issues endpoint
 */

async function testIssuesAPI() {
  try {
    console.log('Testing /api/issues endpoint...\n')

    const response = await fetch('http://localhost:3000/api/issues', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    console.log('Status:', response.status)
    console.log('Status Text:', response.statusText)
    console.log('Headers:', Object.fromEntries(response.headers))

    const data = await response.json()
    console.log('\nResponse:', JSON.stringify(data, null, 2))

    if (data.success) {
      console.log('\n✅ API call successful!')
      console.log(`Found ${data.data?.issues?.length || 0} issues`)
    } else {
      console.log('\n❌ API call failed:', data.error)
    }
  } catch (error) {
    console.error('\n❌ Error calling API:', error)
  }
}

testIssuesAPI()
