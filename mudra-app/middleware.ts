import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { nanoid } from 'nanoid'

// Routes that require CSRF protection
const PROTECTED_ROUTES = [
    '/api/auth/login',
    '/api/auth/signup',
    '/api/auth/reset-password',
]

export async function middleware(request: NextRequest) {
    const response = NextResponse.next()

    // Add security headers
    const headers = response.headers
    headers.set('X-DNS-Prefetch-Control', 'on')
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    headers.set('X-Frame-Options', 'SAMEORIGIN')
    headers.set('X-Content-Type-Options', 'nosniff')
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    headers.set('X-Permitted-Cross-Domain-Policies', 'none')
    headers.set(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
    )

    // Handle CSRF protection for protected routes
    if (PROTECTED_ROUTES.includes(request.nextUrl.pathname)) {
        const csrfToken = request.cookies.get('csrf_token')?.value

        if (request.method !== 'GET') {
            const headerToken = request.headers.get('x-csrf-token')

            // Validate CSRF token
            if (!csrfToken || !headerToken || csrfToken !== headerToken) {
                return new NextResponse(
                    JSON.stringify({ error: 'Invalid CSRF token' }),
                    { status: 403 }
                )
            }
        } else {
            // Generate new CSRF token for GET requests
            const newToken = nanoid()
            response.cookies.set('csrf_token', newToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                path: '/',
            })
        }
    }

    return response
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public (public files)
         */
        '/((?!_next/static|_next/image|favicon.ico|public).*)',
    ],
} 