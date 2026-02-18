/**
 * Issue Script Generation API
 *
 * POST /api/issues/[id]/generate-script
 * Generates a copy/paste-ready code snippet for manual implementation.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
	generateScriptForIssue,
	isScriptGenerationSupported,
} from "@/lib/services/issue-script-generator.service";

export const maxDuration = 60;

export async function POST(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json(
				{ success: false, error: { message: "Unauthorized" } },
				{ status: 401 }
			);
		}

		const { id } = await params;
		const issueId = parseInt(id, 10);
		if (Number.isNaN(issueId)) {
			return NextResponse.json(
				{ success: false, error: { message: "Invalid issue ID" } },
				{ status: 400 }
			);
		}

		const issue = await prisma.issue.findUnique({
			where: { id: issueId },
			include: {
				brandProfile: {
					select: {
						userId: true,
						companyName: true,
						companyWebsite: true,
						companyDescription: true,
					},
				},
			},
		});

		if (!issue) {
			return NextResponse.json(
				{ success: false, error: { message: "Issue not found" } },
				{ status: 404 }
			);
		}
		if (issue.brandProfile.userId !== session.user.id) {
			return NextResponse.json(
				{ success: false, error: { message: "Unauthorized" } },
				{ status: 403 }
			);
		}
		if (!isScriptGenerationSupported(issue.agentType)) {
			return NextResponse.json(
				{
					success: false,
					error: {
						message:
							"This issue type does not have an injectable script template.",
					},
				},
				{ status: 400 }
			);
		}

		const generated = generateScriptForIssue(
			{
				id: issue.id,
				title: issue.title,
				description: issue.description,
				agentType: issue.agentType,
				checkCode: issue.checkCode,
				affectedUrl: issue.affectedUrl,
			},
			{
				companyName: issue.brandProfile.companyName,
				companyWebsite: issue.brandProfile.companyWebsite,
				companyDescription: issue.brandProfile.companyDescription,
			}
		);

		const updated = await prisma.issue.update({
			where: { id: issueId },
			data: {
				generatedOutput: generated.generatedOutput,
				outputType: generated.outputType,
			},
			select: {
				id: true,
				generatedOutput: true,
				outputType: true,
				updatedAt: true,
			},
		});

		return NextResponse.json({
			success: true,
			data: updated,
		});
	} catch (error) {
		console.error("[Issue Generate Script API] Error:", error);
		return NextResponse.json(
			{
				success: false,
				error: { message: "Failed to generate script" },
			},
			{ status: 500 }
		);
	}
}
