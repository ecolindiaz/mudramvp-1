import { NextResponse } from "next/server"

export async function GET() {
  try {
    console.log('[Issues Test] Test endpoint hit')
    return NextResponse.json({
      success: true,
      message: 'Test route working'
    })
  } catch (error) {
    console.error('[Issues Test] Error:', error)
    return NextResponse.json(
      { success: false, error: { message: String(error) } },
      { status: 500 }
    )
  }
}
