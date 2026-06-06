import { PrismaClient } from "@prisma/client";
import type { Capture, CaptureSummary, Store } from "@amber/domain";

// Prisma returns DateTime fields as JS Date objects; null means optional field not set
type SummaryRow = {
  id: string; title: string; sourceUrl: string; capturedAt: Date;
  publishedAt: string | null; coverImage: string | null; excerpt: string | null;
  wordCount: number | null; hasCode: boolean | null; tags: string[];
  readProgress: number | null; readAt: Date | null;
};

type FullRow = SummaryRow & {
  content: string; sourceType: string; author: string | null;
  lastOpenedAt: Date | null; readCount: number;
};

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
    tags: row.tags.length > 0 ? row.tags : undefined,
    readProgress: row.readProgress ?? undefined,
    readAt: row.readAt?.toISOString() ?? undefined,
  };
}

function rowToCapture(row: FullRow): Capture {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    sourceUrl: row.sourceUrl,
    sourceType: "url",
    author: row.author ?? undefined,
    capturedAt: row.capturedAt.toISOString(),
    publishedAt: row.publishedAt ?? undefined,
    coverImage: row.coverImage ?? undefined,
    excerpt: row.excerpt ?? undefined,
    wordCount: row.wordCount ?? undefined,
    hasCode: row.hasCode ?? undefined,
    tags: row.tags.length > 0 ? row.tags : undefined,
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
    return rows.map((r) => rowToSummary(r as SummaryRow));
  }

  async get(id: string): Promise<Capture | null> {
    const row = await this.prisma.capture.findUnique({ where: { id } });
    return row ? rowToCapture(row as unknown as FullRow) : null;
  }

  async findBySourceUrl(url: string): Promise<Capture | null> {
    const row = await this.prisma.capture.findUnique({
      where: { sourceUrl: url },
    });
    return row ? rowToCapture(row as unknown as FullRow) : null;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.capture.delete({ where: { id } }).catch(() => {});
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
      .catch(() => {});
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
      .catch(() => {});
  }
}
