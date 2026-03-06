/**
 * Analysis Job Queue Tests
 *
 * Simulates the production scenario where:
 * 1) USA completes successfully (synchronous, not queued)
 * 2) Argentina completes successfully (queued job)
 * 3) Mexico gets stuck in "running" (serverless timeout)
 * 4) recoverOrphanedJobs() detects and resets the stuck job
 * 5) processNextJob() retries the recovered job
 *
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks (vi.mock factories are hoisted — variables must use vi.hoisted)
// ---------------------------------------------------------------------------

const {
  mockJobs,
  nextIdRef,
  runUnifiedAnalysisMock,
} = vi.hoisted(() => {
  const mockJobs: Record<number, any> = {};
  const nextIdRef = { value: 1 };
  const runUnifiedAnalysisMock = vi.fn();
  return { mockJobs, nextIdRef, runUnifiedAnalysisMock };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    analysisJob: {
      create: vi.fn((args: any) => {
        const job = {
          id: nextIdRef.value++,
          ...args.data,
          attempts: args.data.attempts ?? 0,
          maxAttempts: args.data.maxAttempts ?? 3,
          startedAt: args.data.startedAt ?? null,
          completedAt: args.data.completedAt ?? null,
          error: args.data.error ?? null,
          createdAt: new Date(),
        };
        mockJobs[job.id] = job;
        return Promise.resolve(job);
      }),
      findFirst: vi.fn((args: any) => {
        const jobs = Object.values(mockJobs).filter((j: any) => {
          if (args.where.brandProfileId && j.brandProfileId !== args.where.brandProfileId) return false;
          if (args.where.status && j.status !== args.where.status) return false;
          return true;
        });
        if (args.orderBy?.priority === "asc") {
          jobs.sort((a: any, b: any) => a.priority - b.priority);
        }
        // Return a shallow copy (like real Prisma) so updates don't mutate the queried object
        return Promise.resolve(jobs[0] ? { ...jobs[0] } : null);
      }),
      findMany: vi.fn((args: any) => {
        const jobs = Object.values(mockJobs).filter((j: any) => {
          if (args.where.brandProfileId && j.brandProfileId !== args.where.brandProfileId) return false;
          if (args.where.status) {
            if (typeof args.where.status === "string" && j.status !== args.where.status) return false;
            if (args.where.status.in && !args.where.status.in.includes(j.status)) return false;
          }
          if (args.where.startedAt?.lt && (!j.startedAt || j.startedAt >= args.where.startedAt.lt)) return false;
          return true;
        });
        if (args.orderBy?.priority === "asc") {
          jobs.sort((a: any, b: any) => a.priority - b.priority);
        }
        return Promise.resolve(
          args.select
            ? jobs.map((j: any) => {
                const result: any = {};
                for (const key of Object.keys(args.select)) result[key] = j[key];
                return result;
              })
            : jobs
        );
      }),
      update: vi.fn((args: any) => {
        const job = mockJobs[args.where.id];
        if (!job) throw new Error(`Job ${args.where.id} not found`);
        if (args.data.attempts?.increment) {
          job.attempts = (job.attempts || 0) + args.data.attempts.increment;
        }
        for (const [k, v] of Object.entries(args.data)) {
          if (k === "attempts" && typeof v === "object") continue;
          (job as any)[k] = v;
        }
        return Promise.resolve(job);
      }),
      count: vi.fn((args: any) => {
        const jobs = Object.values(mockJobs).filter((j: any) => {
          if (args.where.brandProfileId && j.brandProfileId !== args.where.brandProfileId) return false;
          if (args.where.status) {
            if (typeof args.where.status === "string" && j.status !== args.where.status) return false;
            if (args.where.status.in && !args.where.status.in.includes(j.status)) return false;
          }
          if (args.where.createdAt?.lt && j.createdAt >= args.where.createdAt.lt) return false;
          return true;
        });
        return Promise.resolve(jobs.length);
      }),
      deleteMany: vi.fn(() => Promise.resolve({ count: 0 })),
    },
    brandProfile: {
      findUnique: vi.fn(() =>
        Promise.resolve({
          companyName: "TestBrand",
          companyWebsite: "https://test.com",
          companyDescription: "Test desc",
          companyIndustry: "Tech",
          competitors: "Comp1,Comp2",
        })
      ),
    },
    $transaction: vi.fn((ops: any[]) => Promise.all(ops)),
  },
}));

vi.mock("@/lib/geo/country-config", () => ({
  getLanguageForCountry: (c: string) =>
    c === "US" ? "en" : c === "AR" ? "es" : c === "MX" ? "es" : "en",
  isAllowedCountry: () => true,
}));

vi.mock("../unified-analysis.service", () => ({
  runUnifiedAnalysis: (...args: any[]) => runUnifiedAnalysisMock(...args),
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks are registered)
// ---------------------------------------------------------------------------

import {
  createAnalysisJobs,
  processNextJob,
  recoverOrphanedJobs,
  hasActiveJobs,
} from "../analysis-job-queue";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BRAND_PROFILE_ID = 42;

function resetJobs() {
  for (const k of Object.keys(mockJobs)) delete mockJobs[Number(k)];
  nextIdRef.value = 1;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("analysis-job-queue", () => {
  beforeEach(() => {
    resetJobs();
    vi.clearAllMocks();
    runUnifiedAnalysisMock.mockResolvedValue({ success: true });
  });

  describe("createAnalysisJobs", () => {
    it("creates jobs for remaining countries with correct priority", async () => {
      const ids = await createAnalysisJobs({
        brandProfileId: BRAND_PROFILE_ID,
        countries: ["AR", "MX"],
        jobType: "geo",
      });

      expect(ids).toHaveLength(2);
      expect(mockJobs[ids[0]]).toMatchObject({
        country: "AR",
        priority: 1,
        status: "pending",
        language: "es",
      });
      expect(mockJobs[ids[1]]).toMatchObject({
        country: "MX",
        priority: 2,
        status: "pending",
        language: "es",
      });
    });
  });

  describe("processNextJob — normal flow", () => {
    it("processes pending jobs sequentially and marks them completed", async () => {
      await createAnalysisJobs({
        brandProfileId: BRAND_PROFILE_ID,
        countries: ["AR", "MX"],
        jobType: "geo",
      });

      // Process Argentina
      const hasMore1 = await processNextJob(BRAND_PROFILE_ID);
      expect(hasMore1).toBe(true);
      expect(mockJobs[1].status).toBe("completed");
      expect(mockJobs[2].status).toBe("pending");

      // Process Mexico
      const hasMore2 = await processNextJob(BRAND_PROFILE_ID);
      expect(hasMore2).toBe(false);
      expect(mockJobs[2].status).toBe("completed");
    });

    it("does not affect already-completed jobs", async () => {
      await createAnalysisJobs({
        brandProfileId: BRAND_PROFILE_ID,
        countries: ["AR", "MX"],
        jobType: "geo",
      });

      // Complete both
      await processNextJob(BRAND_PROFILE_ID);
      await processNextJob(BRAND_PROFILE_ID);

      expect(mockJobs[1].status).toBe("completed");
      expect(mockJobs[2].status).toBe("completed");

      // Calling again should be a no-op
      const hasMore = await processNextJob(BRAND_PROFILE_ID);
      expect(hasMore).toBe(false);
      expect(mockJobs[1].status).toBe("completed");
      expect(mockJobs[2].status).toBe("completed");
    });
  });

  describe("recoverOrphanedJobs — THE BUG SCENARIO", () => {
    it("recovers a job stuck in 'running' for > 5 minutes", async () => {
      await createAnalysisJobs({
        brandProfileId: BRAND_PROFILE_ID,
        countries: ["AR", "MX"],
        jobType: "geo",
      });

      // AR completed normally
      mockJobs[1].status = "completed";
      mockJobs[1].completedAt = new Date();

      // MX is stuck in "running" — started 10 minutes ago (simulating serverless timeout)
      mockJobs[2].status = "running";
      mockJobs[2].startedAt = new Date(Date.now() - 10 * 60 * 1000);
      mockJobs[2].attempts = 1;

      expect(mockJobs[2].status).toBe("running");

      const recovered = await recoverOrphanedJobs(BRAND_PROFILE_ID);
      expect(recovered).toBe(1);
      expect(mockJobs[2].status).toBe("pending");
      expect(mockJobs[2].error).toContain("Recovered from orphaned");
    });

    it("does NOT touch a job running for less than 5 minutes", async () => {
      await createAnalysisJobs({
        brandProfileId: BRAND_PROFILE_ID,
        countries: ["MX"],
        jobType: "geo",
      });

      // MX just started 2 minutes ago — still legitimately running
      mockJobs[1].status = "running";
      mockJobs[1].startedAt = new Date(Date.now() - 2 * 60 * 1000);
      mockJobs[1].attempts = 1;

      const recovered = await recoverOrphanedJobs(BRAND_PROFILE_ID);
      expect(recovered).toBe(0);
      expect(mockJobs[1].status).toBe("running");
    });

    it("marks orphaned job as 'failed' if max attempts reached", async () => {
      await createAnalysisJobs({
        brandProfileId: BRAND_PROFILE_ID,
        countries: ["MX"],
        jobType: "geo",
      });

      mockJobs[1].status = "running";
      mockJobs[1].startedAt = new Date(Date.now() - 10 * 60 * 1000);
      mockJobs[1].attempts = 3;
      mockJobs[1].maxAttempts = 3;

      const recovered = await recoverOrphanedJobs(BRAND_PROFILE_ID);
      expect(recovered).toBe(1);
      expect(mockJobs[1].status).toBe("failed");
      expect(mockJobs[1].error).toContain("max attempts reached");
    });

    it("does NOT touch completed or pending jobs", async () => {
      await createAnalysisJobs({
        brandProfileId: BRAND_PROFILE_ID,
        countries: ["AR", "MX"],
        jobType: "geo",
      });

      mockJobs[1].status = "completed";
      mockJobs[2].status = "pending";

      const recovered = await recoverOrphanedJobs(BRAND_PROFILE_ID);
      expect(recovered).toBe(0);
      expect(mockJobs[1].status).toBe("completed");
      expect(mockJobs[2].status).toBe("pending");
    });
  });

  describe("processNextJob with recovery — full production scenario", () => {
    it("simulates USA→AR→MX where MX gets stuck, then recovers and completes", async () => {
      // Step 1: Create jobs for AR and MX (USA ran synchronously, not queued)
      await createAnalysisJobs({
        brandProfileId: BRAND_PROFILE_ID,
        countries: ["AR", "MX"],
        jobType: "geo",
      });

      // Step 2: AR processes fine
      const hasMore1 = await processNextJob(BRAND_PROFILE_ID);
      expect(hasMore1).toBe(true);
      expect(mockJobs[1].status).toBe("completed");

      // Step 3: MX starts but the serverless function dies mid-execution
      mockJobs[2].status = "running";
      mockJobs[2].startedAt = new Date(Date.now() - 10 * 60 * 1000);
      mockJobs[2].attempts = 1;

      // Step 4: 30 min later, user opens sidebar → triggers processNextJob()
      // processNextJob now calls recoverOrphanedJobs first, which resets MX to "pending"
      const hasMore2 = await processNextJob(BRAND_PROFILE_ID);

      // MX should have been recovered, retried, and completed
      expect(mockJobs[2].status).toBe("completed");
      expect(hasMore2).toBe(false);

      // Verify the analysis was actually run for MX
      expect(runUnifiedAnalysisMock).toHaveBeenCalledTimes(2); // AR + MX
      const mxCall = runUnifiedAnalysisMock.mock.calls[1][0];
      expect(mxCall.country).toBe("MX");
    });
  });

  describe("hasActiveJobs", () => {
    it("returns true when pending or running jobs exist", async () => {
      await createAnalysisJobs({
        brandProfileId: BRAND_PROFILE_ID,
        countries: ["MX"],
        jobType: "geo",
      });

      expect(await hasActiveJobs(BRAND_PROFILE_ID)).toBe(true);
    });

    it("returns false when all jobs are completed", async () => {
      await createAnalysisJobs({
        brandProfileId: BRAND_PROFILE_ID,
        countries: ["MX"],
        jobType: "geo",
      });
      mockJobs[1].status = "completed";

      expect(await hasActiveJobs(BRAND_PROFILE_ID)).toBe(false);
    });
  });

  describe("processNextJob — failure and retry", () => {
    it("retries on failure then permanently fails after maxAttempts", async () => {
      await createAnalysisJobs({
        brandProfileId: BRAND_PROFILE_ID,
        countries: ["MX"],
        jobType: "geo",
      });

      runUnifiedAnalysisMock.mockRejectedValue(new Error("API timeout"));

      // Attempt 1 — fails, goes back to pending
      await processNextJob(BRAND_PROFILE_ID);
      expect(mockJobs[1].status).toBe("pending");
      expect(mockJobs[1].attempts).toBe(1);

      // Attempt 2 — fails, goes back to pending
      await processNextJob(BRAND_PROFILE_ID);
      expect(mockJobs[1].status).toBe("pending");
      expect(mockJobs[1].attempts).toBe(2);

      // Attempt 3 — fails, permanently failed (maxAttempts=3)
      await processNextJob(BRAND_PROFILE_ID);
      expect(mockJobs[1].status).toBe("failed");
      expect(mockJobs[1].attempts).toBe(3);
    });
  });
});
