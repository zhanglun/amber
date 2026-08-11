import { Prisma, PrismaClient } from "@prisma/client";
import type { Capture, CaptureSummary, SearchResult, Store } from "@amber/domain";

// Prisma inferred types for the two query shapes used below
type SummaryRow = Prisma.CaptureGetPayload<{
  select: {
    id: true; title: true; sourceUrl: true; capturedAt: true;
    publishedAt: true; coverImage: true; excerpt: true; wordCount: true;
    hasCode: true; tags: true; readProgress: true; readAt: true; inboxAt: true;
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
    inboxAt: row.inboxAt?.toISOString() ?? undefined,
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
    inboxAt: row.inboxAt?.toISOString() ?? undefined,
  };
}

/** 从正文里抽一句命中上下文（去 markdown 噪声），给“找到了”一个可读片段。 */
function makeSnippet(content: string, query: string, radius = 60): string {
  const lower = content.toLowerCase();
  const i = lower.indexOf(query.toLowerCase());
  if (i < 0) return "";
  const start = Math.max(0, i - radius);
  const end = Math.min(content.length, i + query.length + radius);
  const slice = content
    .slice(start, end)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#*`>_~-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return (start > 0 ? "…" : "") + slice + (end < content.length ? "…" : "");
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
        inboxAt: capture.inboxAt ? new Date(capture.inboxAt) : null,
      },
    });
  }

  async list(): Promise<CaptureSummary[]> {
    const rows = await this.prisma.capture.findMany({
      orderBy: { capturedAt: "desc" },
      select: {
        id: true, title: true, sourceUrl: true, capturedAt: true,
        publishedAt: true, coverImage: true, excerpt: true, wordCount: true,
        hasCode: true, tags: true, readProgress: true, readAt: true, inboxAt: true,
      },
    });
    return rows.map(rowToSummary);
  }

  /** 全库搜索：ILIKE 命中 title/content/source，或精确命中 tag（中文友好，无需分词扩展）。 */
  async search(query: string): Promise<SearchResult[]> {
    const q = query.trim();
    if (!q) return [];
    const rows = await this.prisma.capture.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { content: { contains: q, mode: "insensitive" } },
          { sourceUrl: { contains: q, mode: "insensitive" } },
          // 标签用精确匹配；导入与编辑时会保留用户输入的标签文本。
          { tags: { has: q } },
        ],
      },
      orderBy: { capturedAt: "desc" },
      take: 50,
      select: {
        id: true, title: true, sourceUrl: true, capturedAt: true,
        publishedAt: true, coverImage: true, excerpt: true, wordCount: true,
        hasCode: true, tags: true, readProgress: true, readAt: true, inboxAt: true,
        content: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      sourceUrl: r.sourceUrl,
      capturedAt: r.capturedAt.toISOString(),
      publishedAt: r.publishedAt ?? undefined,
      coverImage: r.coverImage ?? undefined,
      excerpt: r.excerpt ?? undefined,
      wordCount: r.wordCount ?? undefined,
      hasCode: r.hasCode ?? undefined,
      tags: r.tags,
      readProgress: r.readProgress ?? undefined,
      readAt: r.readAt?.toISOString() ?? undefined,
      inboxAt: r.inboxAt?.toISOString() ?? undefined,
      // 标题、来源或标签命中时，正文未必包含 query；用已有摘要避免结果“空一行”。
      snippet: makeSnippet(r.content, q) || r.excerpt || undefined,
    }));
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

  async updateInboxAt(id: string, inboxAt?: string): Promise<void> {
    await this.prisma.capture
      .update({ where: { id }, data: { inboxAt: inboxAt ? new Date(inboxAt) : null } })
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
