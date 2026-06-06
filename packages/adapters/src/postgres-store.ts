import { Prisma, PrismaClient } from "@prisma/client";
import type { Capture, CaptureSummary, Store } from "@amber/domain";

// Prisma inferred types for the two query shapes used below
type SummaryRow = Prisma.CaptureGetPayload<{
  select: {
    id: true; title: true; sourceUrl: true; capturedAt: true;
    publishedAt: true; coverImage: true; excerpt: true; wordCount: true;
    hasCode: true; tags: true; readProgress: true; readAt: true;
  };
}>;

type FullRow = Prisma.CaptureGetPayload<object>;

function rowToSummary(row: SummaryRow): CaptureSummary {
  return {
    id: row.id,
    title: row.title,
    sourceUrl: row.sourceUrl,
    capturedAt: row.capturedAt.toISOString(),
    publishedAt: row.publishedAt ?? undefined,
    coverImage: row.coverImage ?? undefined,
    excerpt: row.excerpt ?? undefined,
    wordCount: row.wordCount ?? undefined,
    hasCode: row.hasCode ?? undefined,
    tags: row.tags,
    readProgress: row.readProgress ?? undefined,
    readAt: row.readAt?.toISOString() ?? undefined,
  };
}

function rowToCapture(row: NonNullable<FullRow>): Capture {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    sourceUrl: row.sourceUrl,
    sourceType: row.sourceType as Capture["sourceType"],
    author: row.author ?? undefined,
    capturedAt: row.capturedAt.toISOString(),
    publishedAt: row.publishedAt ?? undefined,
    coverImage: row.coverImage ?? undefined,
    excerpt: row.excerpt ?? undefined,
    wordCount: row.wordCount ?? undefined,
    hasCode: row.hasCode ?? undefined,
    tags: row.tags,
    readProgress: row.readProgress ?? undefined,
    readAt: row.readAt?.toISOString() ?? undefined,
    lastOpenedAt: row.lastOpenedAt?.toISOString() ?? undefined,
    readCount: row.readCount > 0 ? row.readCount : undefined,
  };
}

export class PostgresStore implements Store {
  private readonly prisma: PrismaClient;

  constructor(databaseUrl: string) {
    this.prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }

  /** For tests only: delete all records. */
  async deleteAll(): Promise<void> {
    await this.prisma.capture.deleteMany();
  }

  async insert(capture: Capture): Promise<void> {
    await this.prisma.capture.create({
      data: {
        id: capture.id,
        title: capture.title,
        content: capture.content,
        sourceUrl: capture.sourceUrl,
        sourceType: capture.sourceType,
        author: capture.author ?? null,
        capturedAt: new Date(capture.capturedAt),
        publishedAt: capture.publishedAt ?? null,
        coverImage: capture.coverImage ?? null,
        excerpt: capture.excerpt ?? null,
        wordCount: capture.wordCount ?? null,
        hasCode: capture.hasCode ?? null,
        tags: capture.tags ?? [],
        readProgress: capture.readProgress ?? null,
        readAt: capture.readAt ? new Date(capture.readAt) : null,
        lastOpenedAt: capture.lastOpenedAt ? new Date(capture.lastOpenedAt) : null,
        readCount: capture.readCount ?? 0,
      },
    });
  }

  async list(): Promise<CaptureSummary[]> {
    const rows = await this.prisma.capture.findMany({
      orderBy: { capturedAt: "desc" },
      select: {
        id: true, title: true, sourceUrl: true, capturedAt: true,
        publishedAt: true, coverImage: true, excerpt: true, wordCount: true,
        hasCode: true, tags: true, readProgress: true, readAt: true,
      },
    });
    return rows.map(rowToSummary);
  }

  async get(id: string): Promise<Capture | null> {
    const row = await this.prisma.capture.findUnique({ where: { id } });
    return row ? rowToCapture(row) : null;
  }

  async findBySourceUrl(url: string): Promise<Capture | null> {
    const row = await this.prisma.capture.findUnique({
      where: { sourceUrl: url },
    });
    return row ? rowToCapture(row) : null;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.capture.delete({ where: { id } }).catch((e: unknown) => { if ((e as { code?: string })?.code !== "P2025") throw e; });
  }

  async updateReadStatus(
    id: string,
    status: { readProgress: number; readAt?: string }
  ): Promise<void> {
    const current = await this.prisma.capture.findUnique({
      where: { id },
      select: { readAt: true },
    });
    if (!current) return;
    await this.prisma.capture.update({
      where: { id },
      data: {
        readProgress: status.readProgress,
        ...(status.readAt && !current.readAt
          ? { readAt: new Date(status.readAt) }
          : {}),
      },
    });
  }

  async updateTags(id: string, tags: string[]): Promise<void> {
    await this.prisma.capture
      .update({ where: { id }, data: { tags } })
      .catch((e: unknown) => { if ((e as { code?: string })?.code !== "P2025") throw e; });
  }

  async recordVisit(id: string, visitedAt: string): Promise<void> {
    await this.prisma.capture
      .update({
        where: { id },
        data: {
          lastOpenedAt: new Date(visitedAt),
          readCount: { increment: 1 },
        },
      })
      .catch((e: unknown) => { if ((e as { code?: string })?.code !== "P2025") throw e; });
  }
}
