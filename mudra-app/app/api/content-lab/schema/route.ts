import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { applyRateLimitAsync } from "@/lib/auth/rate-limiter-redis";
import { prisma } from "@/lib/prisma";
import { getBrandProfileByUserId } from "@/lib/prisma-brand-profile";
import { generateContentLabSchema } from "@/lib/services/content-lab-schema.service";
import type { Prisma } from "@prisma/client";

export async function POST(req: NextRequest) {
	const rateLimited = await applyRateLimitAsync(req, "aiGeneration");
	if (rateLimited) return rateLimited;

	const authResult = await requireAuth();
	if (!authResult.success) {
		return authResult.response;
	}

	try {
		const body = await req.json();
		const campaignId = body?.campaignId;

		if (!campaignId || typeof campaignId !== "string") {
			return NextResponse.json(
				{ success: false, error: "campaignId is required" },
				{ status: 400 }
			);
		}

		const campaign = await prisma.campaign.findUnique({
			where: { id: campaignId },
			select: {
				id: true,
				userId: true,
				brandProfileId: true,
				title: true,
				body: true,
				slug: true,
				createdAt: true,
				updatedAt: true,
				metadata: true,
			},
		});

		if (!campaign) {
			return NextResponse.json(
				{ success: false, error: "Campaign not found" },
				{ status: 404 }
			);
		}

		if (!campaign.userId || campaign.userId !== authResult.user.id) {
			return NextResponse.json(
				{ success: false, error: "Unauthorized" },
				{ status: 403 }
			);
		}

		// Use the campaign's own brandProfileId to get the correct brand profile
		let brandProfile = campaign.brandProfileId
			? await prisma.brandProfile.findFirst({
					where: { id: campaign.brandProfileId },
					select: {
						id: true,
						companyName: true,
						companyWebsite: true,
						userName: true,
						userRole: true,
					},
			  })
			: null;

		// Fall back to the user's most-recently-updated brand profile if campaign has none
		if (!brandProfile) {
			brandProfile = await getBrandProfileByUserId(authResult.user.id);
		}

		if (!brandProfile) {
			return NextResponse.json(
				{ success: false, error: "Brand profile not found" },
				{ status: 404 }
			);
		}

		const metadata =
			campaign.metadata && typeof campaign.metadata === "object"
				? (campaign.metadata as Record<string, unknown>)
				: {};

		const author = (metadata.author as { name?: string; title?: string } | undefined) || {};

		const schema = await generateContentLabSchema({
			title: campaign.title,
			body: campaign.body,
			slug: campaign.slug,
			createdAt: campaign.createdAt,
			updatedAt: new Date(),
			author: {
				name: author.name || brandProfile.userName || "Content Team",
				title: author.title || brandProfile.userRole || "Editor",
			},
			publisher: {
				name: brandProfile.companyName || "Unknown Brand",
				website: brandProfile.companyWebsite || undefined,
			},
			userId: campaign.userId,
			brandProfileId: campaign.brandProfileId ?? null,
		});

		const nextMetadata: Record<string, unknown> = {
			...metadata,
			contentLabSchema: schema,
			schemaStatus: "ready",
			schemaError: null,
		};

		await prisma.campaign.update({
			where: { id: campaign.id },
			data: {
				metadata: nextMetadata as Prisma.InputJsonValue,
			},
		});

		return NextResponse.json({
			success: true,
			campaignId: campaign.id,
			schema,
		});
	} catch (error: any) {
		console.error("[API /content-lab/schema] Error:", error);
		return NextResponse.json(
			{
				success: false,
				error: error?.message || "Failed to regenerate schema",
			},
			{ status: 500 }
		);
	}
}
