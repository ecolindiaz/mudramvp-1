import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuthWithBrandAccess } from '@/lib/auth/require-auth'
import { applyRateLimitAsync } from '@/lib/auth/rate-limiter-redis'

type VerifyResponse = {
	success: boolean
	data?: {
		verified: boolean
		location?: string
		method?: 'visit-detected' | 'status-detected' | 'live-site-scan' | 'github-repo-scan'
	}
	error?: {
		message: string
		filesChecked?: string[]
	}
}

const REQUEST_TIMEOUT_MS = 8000

function normalizeWebsiteUrls(rawWebsite: string | null): string[] {
	if (!rawWebsite) return []

	const trimmed = rawWebsite.trim()
	if (!trimmed) return []

	const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

	try {
		const parsed = new URL(withProtocol)
		const host = parsed.hostname.replace(/\/$/, '')
		const pathname = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '/'

		const variants = new Set<string>()
		variants.add(`https://${host}${pathname}`)

		if (host.startsWith('www.')) {
			variants.add(`https://${host.slice(4)}${pathname}`)
		} else {
			variants.add(`https://www.${host}${pathname}`)
		}

		variants.add(`http://${host}${pathname}`)

		return Array.from(variants)
	} catch {
		return []
	}
}

async function fetchPageHtml(url: string): Promise<{ html: string | null; reason?: string }> {
	const controller = new AbortController()
	const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

	try {
		const response = await fetch(url, {
			method: 'GET',
			redirect: 'follow',
			signal: controller.signal,
			headers: {
				'User-Agent': 'Mudra Verification Bot/1.0 (+https://app.trymudra.com)',
				'Accept': 'text/html,application/xhtml+xml'
			}
		})

		if (!response.ok) {
			return { html: null, reason: `HTTP ${response.status}` }
		}

		const html = await response.text()
		return { html }
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Request failed'
		return { html: null, reason: message }
	} finally {
		clearTimeout(timeoutId)
	}
}

function hasTrackingSnippet(html: string, siteId: string): boolean {
	const normalizedHtml = html.toLowerCase()
	const normalizedSiteId = siteId.toLowerCase()

	const hasSiteId = normalizedHtml.includes(normalizedSiteId)
	const hasTrackerReference =
		normalizedHtml.includes('tracker.js') ||
		normalizedHtml.includes('data-site-id') ||
		normalizedHtml.includes('/api/analytics/track')

	return hasSiteId && hasTrackerReference
}

/**
 * POST /api/analytics/verify-installation
 *
 * Verifies AI referral tracking installation with this priority:
 * 1) Existing tracked visits (already connected)
 * 2) Existing verified/connected status in DB
 * 3) Live site scan (for Webflow/Framer/manual installs)
 * 4) GitHub repo scan via /api/analytics/script fallback (for code repos)
 */
export async function POST(request: NextRequest) {
	const rateLimited = await applyRateLimitAsync(request, 'standard')
	if (rateLimited) return rateLimited

	try {
		const body = await request.json().catch(() => ({}))
		const brandProfileIdRaw = body?.brandProfileId
		const profileId = Number(brandProfileIdRaw)

		if (!profileId || Number.isNaN(profileId)) {
			const payload: VerifyResponse = {
				success: false,
				error: { message: 'brandProfileId is required' }
			}
			return NextResponse.json(payload, { status: 400 })
		}

		const authResult = await requireAuthWithBrandAccess(profileId)
		if (!authResult.success) {
			return authResult.response
		}

		const profile = await prisma.brandProfile.findUnique({
			where: { id: profileId },
			select: {
				id: true,
				companyWebsite: true,
				websitePlatform: true,
				siteId: true,
				trackingSiteId: true,
				trackingStatus: true,
			}
		})

		if (!profile) {
			const payload: VerifyResponse = {
				success: false,
				error: { message: 'Brand profile not found' }
			}
			return NextResponse.json(payload, { status: 404 })
		}

		const siteId = profile.siteId || profile.trackingSiteId

		if (!siteId) {
			const payload: VerifyResponse = {
				success: false,
				error: {
					message: 'No tracking ID found. Copy your script again to generate a site ID.'
				}
			}
			return NextResponse.json(payload)
		}

		const visitsCount = await prisma.aIReferralVisit.count({
			where: { brandProfileId: profileId }
		})

		if (visitsCount > 0) {
			if (profile.trackingStatus !== 'connected') {
				await prisma.brandProfile.update({
					where: { id: profileId },
					data: {
						trackingStatus: 'connected',
						trackingInstalledAt: new Date()
					}
				})
			}

			const payload: VerifyResponse = {
				success: true,
				data: {
					verified: true,
					location: `Visit data detected (${visitsCount} tracked visits)`,
					method: 'visit-detected'
				}
			}
			return NextResponse.json(payload)
		}

		if (profile.trackingStatus === 'verified' || profile.trackingStatus === 'connected') {
			const payload: VerifyResponse = {
				success: true,
				data: {
					verified: true,
					location: `Tracking status is ${profile.trackingStatus}`,
					method: 'status-detected'
				}
			}
			return NextResponse.json(payload)
		}

		const urlsChecked: string[] = []
		const websiteCandidates = normalizeWebsiteUrls(profile.companyWebsite)

		for (const candidateUrl of websiteCandidates) {
			urlsChecked.push(candidateUrl)
			const { html } = await fetchPageHtml(candidateUrl)

			if (html && hasTrackingSnippet(html, siteId)) {
				await prisma.brandProfile.update({
					where: { id: profileId },
					data: {
						trackingStatus: 'verified',
						trackingInstalledAt: new Date()
					}
				})

				const payload: VerifyResponse = {
					success: true,
					data: {
						verified: true,
						location: `${candidateUrl}`,
						method: 'live-site-scan'
					}
				}
				return NextResponse.json(payload)
			}
		}

		const platform = (profile.websitePlatform || '').toLowerCase()
		const canUseGithubFallback = platform !== 'webflow' && platform !== 'framer'

		if (canUseGithubFallback) {
			const fallbackResponse = await fetch(new URL('/api/analytics/script', request.nextUrl.origin), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					cookie: request.headers.get('cookie') || ''
				},
				body: JSON.stringify({
					brandProfileId: profileId,
					siteId,
				})
			})

			const fallbackResult = await fallbackResponse.json().catch(() => null) as
				| { success?: boolean; data?: { connected?: boolean; repository?: string; filePath?: string; message?: string } }
				| null

			if (fallbackResult?.success && fallbackResult.data?.connected) {
				await prisma.brandProfile.update({
					where: { id: profileId },
					data: {
						trackingStatus: 'verified',
						trackingInstalledAt: new Date()
					}
				})

				const resolvedLocation =
					fallbackResult.data.filePath && fallbackResult.data.repository
						? `${fallbackResult.data.repository}/${fallbackResult.data.filePath}`
						: fallbackResult.data.message || 'GitHub repository scan'

				const payload: VerifyResponse = {
					success: true,
					data: {
						verified: true,
						location: resolvedLocation,
						method: 'github-repo-scan'
					}
				}
				return NextResponse.json(payload)
			}
		}

		const webflowMessage =
			'Script not detected on your published Webflow site yet. In Webflow, paste the script in Site Settings > Custom Code > Head Code, publish the site, then try again.'

		const defaultMessage =
			'Tracking script was not detected yet. Ensure the latest script is deployed and publicly accessible, then verify again.'

		const payload: VerifyResponse = {
			success: false,
			error: {
				message: platform === 'webflow' ? webflowMessage : defaultMessage,
				filesChecked: urlsChecked
			}
		}

		return NextResponse.json(payload)
	} catch (error) {
		console.error('[Verify Installation] Error:', error)
		const payload: VerifyResponse = {
			success: false,
			error: {
				message: 'Failed to verify tracking installation. Please try again.'
			}
		}
		return NextResponse.json(payload, { status: 500 })
	}
}
