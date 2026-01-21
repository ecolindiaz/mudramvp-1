import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { nanoid } from 'nanoid'
import { getToken } from 'next-auth/jwt'

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
    '/',
    '/login',
    '/signup',
    '/api/auth',
    '/api/health',
    '/api/track',
    '/images',
    '/_next',
    '/favicon.ico',
]

// Routes that require CSRF protection
const PROTECTED_ROUTES = [
    '/api/auth/login',
    '/api/auth/signup',
    '/api/auth/reset-password',
]

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl
    const response = NextResponse.next()

    // Check if route is public
    // Use exact match for '/' to prevent all routes from being treated as public
    const isPublicRoute = PUBLIC_ROUTES.some(route => 
        route === '/' 
            ? pathname === '/' 
            : pathname.startsWith(route)
    )
    
    // Get session token
    const token = await getToken({ 
        req: request, 
        secret: process.env.NEXTAUTH_SECRET 
    })

    // Redirect to login if accessing protected route without auth
    if (!isPublicRoute && !token) {
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('callbackUrl', pathname)
        return NextResponse.redirect(loginUrl)
    }

    // Redirect to dashboard if accessing login/signup while authenticated
    if ((pathname === '/login' || pathname === '/signup') && token) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
    }

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
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://accounts.google.com https://*.supabase.co; frame-src 'self' https://accounts.google.com;"
    )

    // Handle CSRF protection for protected routes
    if (PROTECTED_ROUTES.includes(pathname)) {
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