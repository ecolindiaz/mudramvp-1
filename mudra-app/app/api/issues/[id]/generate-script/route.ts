/**
 * Issue Script Generation API
 *
 * POST /api/issues/[id]/generate-script
 * Generates a copy/paste-ready code snippet for manual implementation.
 * Uses LLM-first approach with template fallback.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
	generateScriptWithLlm,
	isScriptGenerationSupported,
} from "@/lib/services/issue-script-generator.service";

export const maxDuration = 120;

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
						companyServices: true,
						companyICP: true,
						companyIndustry: true,
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

		// For llms.txt issues, pull real FAQ data from sibling issues (extracted by the scorer)
		let faqData: Array<{ question: string; answer: string }> | undefined;
		if (issue.agentType === "llms_txt" || issue.agentType === "llms_txt_missing") {
			const siblingWithFaq = await prisma.issue.findFirst({
				where: {
					brandProfileId: issue.brandProfileId,
					description: { contains: "FAQ_DATA" },
				},
				select: { description: true },
			});
			if (siblingWithFaq?.description) {
				const match = siblingWithFaq.description.match(/<!-- FAQ_DATA: (\[[\s\S]*?\]) -->/);
				if (match) {
					try {
						const raw = match[1].replace(/--\\>/g, "-->");
						// Cap parsed length to prevent oversized payloads
						if (raw.length > 10_000) throw new Error("FAQ_DATA too large");
						const parsed = JSON.parse(raw);
						if (Array.isArray(parsed)) {
							faqData = parsed
								.filter(
									(item: unknown): item is { question: string; answer: string } =>
										typeof item === "object" && item !== null &&
										typeof (item as Record<string, unknown>).question === "string" &&
										typeof (item as Record<string, unknown>).answer === "string"
								)
								.slice(0, 10) // Hard cap on FAQ count
								.map((item: { question: string; answer: string }) => ({
									question: item.question.slice(0, 300),
									answer: item.answer.slice(0, 500),
								}));
						}
					} catch {
						// ignore malformed FAQ_DATA
					}
				}
			}
		}

		const generated = await generateScriptWithLlm(
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
				companyServices: issue.brandProfile.companyServices,
				companyICP: issue.brandProfile.companyICP,
				companyIndustry: issue.brandProfile.companyIndustry,
			},
			faqData ? { faqData } : undefined
		);

		const updated = await prisma.issue.update({
			where: { id: issueId },
			data: {
				generatedOutput: generated.generatedOutput,
				outputType: generated.outputType,
				scriptSource: generated.source,
			},
			select: {
				id: true,
				generatedOutput: true,
				outputType: true,
				scriptSource: true,
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
