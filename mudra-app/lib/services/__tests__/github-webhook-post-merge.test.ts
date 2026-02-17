/**
 * GitHub Webhook Post-Merge Reanalysis Tests
 *
 * Verifies:
 * 1) merged PR events return affected brandProfileIds
 * 2) post-merge reanalysis runs unified analysis for those brands
 * 3) backgroundWork is awaited when returned by runUnifiedAnalysis
 *
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
	issueFindMany,
	issueUpdate,
	brandProfileFindUnique,
	runUnifiedAnalysis,
} = vi.hoisted(() => ({
	issueFindMany: vi.fn(),
	issueUpdate: vi.fn(),
	brandProfileFindUnique: vi.fn(),
	runUnifiedAnalysis: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
	prisma: {
		issue: {
			findMany: issueFindMany,
			update: issueUpdate,
		},
		brandProfile: {
			findUnique: brandProfileFindUnique,
		},
	},
}));

vi.mock("../unified-analysis.service", () => ({
	runUnifiedAnalysis,
}));

import {
	handlePullRequestEvent,
	triggerPostMergeReanalysis,
} from "../github-webhook.service";

function makePullRequestEvent(overrides: Record<string, unknown> = {}) {
	return {
		action: "closed",
		number: 123,
		pull_request: {
			id: 999,
			number: 123,
			title: "Test PR",
			state: "closed",
			merged: true,
			merged_at: "2026-02-17T00:00:00.000Z",
			html_url: "https://github.com/acme/app/pull/123",
			head: { ref: "feature/test", sha: "abc" },
			base: { ref: "main", repo: { full_name: "acme/app" } },
			user: { login: "dev" },
		},
		repository: {
			id: 1,
			full_name: "acme/app",
			name: "app",
			owner: { login: "acme" },
		},
		installation: { id: 1 },
		...overrides,
	};
}

describe("GitHub webhook post-merge reanalysis", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns merged brand profile IDs from merged PR issues", async () => {
		issueFindMany
			.mockResolvedValueOnce([
				{
					id: 1,
					title: "Issue A",
					status: "completed",
					prUrl: "https://github.com/acme/app/pull/123",
					prNumber: 123,
					prStatus: "open",
					brandProfileId: 10,
				},
				{
					id: 2,
					title: "Issue B",
					status: "completed",
					prUrl: "https://github.com/acme/app/pull/123",
					prNumber: 123,
					prStatus: "open",
					brandProfileId: 10,
				},
				{
					id: 3,
					title: "Issue C",
					status: "completed",
					prUrl: "https://github.com/acme/app/pull/123",
					prNumber: 123,
					prStatus: "open",
					brandProfileId: 11,
				},
			]);

		issueUpdate.mockImplementation(async ({ where, data }) => ({
			id: where.id,
			...data,
		}));

		const result = await handlePullRequestEvent(makePullRequestEvent());

		expect(result.processed).toBe(true);
		expect(result.isMerged).toBe(true);
		expect(result.issuesUpdated).toBe(3);
		expect(result.mergedBrandProfileIds).toEqual([10, 11]);
		expect(issueUpdate).toHaveBeenCalledTimes(3);
		expect(issueUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ prStatus: "merged", status: "merged" }),
			})
		);
	});

	it("triggers reanalysis and waits for background work", async () => {
		brandProfileFindUnique.mockImplementation(async ({ where }: { where: { id: number } }) => {
			if (where.id === 10) {
				return {
					id: 10,
					companyName: "Acme",
					companyWebsite: "https://acme.com",
					companyDescription: "B2B SaaS",
					companyIndustry: "Software",
					competitors: "CompA, CompB",
					trackingCountries: ["US", "ES"],
				};
			}
			if (where.id === 11) {
				return {
					id: 11,
					companyName: "Beta",
					companyWebsite: "https://beta.com",
					companyDescription: "Security tooling",
					companyIndustry: "Cybersecurity",
					competitors: null,
					trackingCountries: [],
				};
			}
			return null;
		});

		let releaseBackground!: () => void;
		const backgroundWork = new Promise<void>((resolve) => {
			releaseBackground = resolve;
		});

		runUnifiedAnalysis
			.mockResolvedValueOnce({
				success: true,
				scores: { technical: 80, aiVisibility: 62 },
				backgroundWork,
			})
			.mockResolvedValueOnce({
				success: false,
				error: "analysis failed",
				scores: {},
			});

		const pending = triggerPostMergeReanalysis([10, 10, 11, 999]);
		const settledImmediately = await Promise.race([
			pending.then(() => true),
			Promise.resolve(false),
		]);

		// Should still be waiting because backgroundWork is unresolved
		expect(settledImmediately).toBe(false);

		releaseBackground();
		const result = await pending;

		expect(runUnifiedAnalysis).toHaveBeenCalledTimes(2);
		expect(runUnifiedAnalysis).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				brandProfileId: 10,
				brandName: "Acme",
				website: "https://acme.com",
				countries: ["US", "ES"],
				skipCooldown: true,
				generateReport: false,
			})
		);
		expect(runUnifiedAnalysis).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				brandProfileId: 11,
				brandName: "Beta",
				website: "https://beta.com",
				countries: ["US"],
				skipCooldown: true,
				generateReport: false,
			})
		);

		// ID 10 succeeded, IDs 11 + 999 failed
		expect(result.triggered).toBe(1);
		expect(result.failed).toBe(2);
		expect(result.errors.length).toBe(2);
	});
});
