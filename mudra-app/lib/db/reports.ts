import { Prisma, WeeklyReport, WeeklyReportSection } from "@prisma/client";
import { prisma } from '@/lib/prisma';

export type WeeklyReportWithRelations = WeeklyReport & {
  sections: WeeklyReportSection[];
};

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Fetch a weekly report for a brand profile and week (UTC), including sections.
 */
export async function getWeeklyReportByWeek(
  brandProfileId: number,
  weekStartUtc: Date | string
): Promise<WeeklyReportWithRelations | null> {
  const weekStart = toDate(weekStartUtc);
  return prisma.weeklyReport.findUnique({
    where: {
      brandProfileId_weekStartUtc: { brandProfileId, weekStartUtc: weekStart },
    },
    include: {
      sections: {
        orderBy: { order: "asc" },
      },
    },
  });
}

export interface UpsertWeeklyReportSectionInput {
  key: string;
  title?: string | null;
  order?: number;
  bodyMarkdown?: string | null;
  bodyJson?: Prisma.InputJsonValue | null;
}

export interface UpsertWeeklyReportInput {
  brandProfileId: number;
  companyId?: string | null;
  weekStartUtc: Date | string;
  status?: string;
  model?: string | null;
  summaryMarkdown?: string | null;
  summaryJson?: Prisma.InputJsonValue | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  costCents?: number | null;
  sections?: UpsertWeeklyReportSectionInput[];
}

/**
 * Create or update a weekly report and optionally replace its sections atomically.
 */
export async function upsertWeeklyReport(
  input: UpsertWeeklyReportInput
): Promise<WeeklyReportWithRelations> {
  const weekStart = toDate(input.weekStartUtc);

  return prisma.$transaction(async (tx) => {
    // Upsert core report row
    const report = await tx.weeklyReport.upsert({
      where: {
        brandProfileId_weekStartUtc: {
          brandProfileId: input.brandProfileId,
          weekStartUtc: weekStart,
        },
      },
      update: {
        status: input.status,
        model: input.model,
        summaryMarkdown: input.summaryMarkdown,
        summaryJson: input.summaryJson === null ? Prisma.JsonNull : input.summaryJson,
        tokensIn: input.tokensIn ?? undefined,
        tokensOut: input.tokensOut ?? undefined,
        costCents: input.costCents ?? undefined,
        companyId: input.companyId ?? undefined,
      },
      create: {
        brandProfileId: input.brandProfileId,
        companyId: input.companyId ?? null,
        weekStartUtc: weekStart,
        status: input.status ?? "queued",
        model: input.model ?? null,
        summaryMarkdown: input.summaryMarkdown ?? null,
        summaryJson: input.summaryJson === null ? Prisma.JsonNull : input.summaryJson,
        tokensIn: input.tokensIn ?? undefined,
        tokensOut: input.tokensOut ?? undefined,
        costCents: input.costCents ?? undefined,
      },
    });

    // Replace sections if provided
    if (input.sections) {
      await tx.weeklyReportSection.deleteMany({
        where: { reportId: report.id },
      });

      for (const [index, section] of input.sections.entries()) {
        await tx.weeklyReportSection.create({
          data: {
            reportId: report.id,
            key: section.key,
            title: section.title ?? null,
            order: section.order ?? index,
            bodyMarkdown: section.bodyMarkdown ?? null,
            bodyJson: section.bodyJson ?? undefined,
          },
        });
      }
    }

    // Return final state with relations
    const full = await tx.weeklyReport.findUnique({
      where: { id: report.id },
      include: {
        sections: { orderBy: { order: "asc" } },
      },
    });
    if (!full) throw new Error("Failed to read back weekly report after upsert");
    return full as WeeklyReportWithRelations;
  });
}

/**
 * List most recent weekly reports for a brand profile.
 */
export async function listReports(
  brandProfileId: number,
  limit = 10
): Promise<WeeklyReport[]> {
  return prisma.weeklyReport.findMany({
    where: { brandProfileId },
    orderBy: { weekStartUtc: "desc" },
    take: limit,
  });
}
