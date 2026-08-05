import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Capture, CaptureSummary, SearchResult, Store } from "@amber/domain";

/** 从正文里抽一句命中上下文（去 markdown 噪声）。 */
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

/** 基于本地文件的 Store 实现（无数据库模式）：每条 Capture 存一个 JSON 文件。 */
export class FileStore implements Store {
  private readonly dir: string;

  constructor(dataDir: string) {
    this.dir = join(dataDir, "captures");
  }

  private file(id: string): string {
    return join(this.dir, `${id}.json`);
  }

  private async readAll(): Promise<Capture[]> {
    let names: string[] = [];
    try {
      names = await readdir(this.dir);
    } catch {
      return [];
    }
    const captures: Capture[] = [];
    for (const name of names) {
      if (!name.endsWith(".json")) continue;
      const text = await readFile(join(this.dir, name), "utf8");
      try {
        captures.push(JSON.parse(text) as Capture);
      } catch {
        // 跳过损坏的 JSON 文件
      }
    }
    return captures;
  }

  async insert(capture: Capture): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    // flag "wx" 在文件已存在时抛 EEXIST，使 insert 语义与 PostgresStore 一致（重复 id 即报错）
    await writeFile(this.file(capture.id), JSON.stringify(capture, null, 2), {
      encoding: "utf8",
      flag: "wx",
    });
  }

  async list(): Promise<CaptureSummary[]> {
    const all = await this.readAll();
    all.sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1));
    return all.map((c) => ({
      id: c.id,
      title: c.title,
      sourceUrl: c.sourceUrl,
      capturedAt: c.capturedAt,
      publishedAt: c.publishedAt,
      coverImage: c.coverImage,
      excerpt: c.excerpt,
      wordCount: c.wordCount,
      hasCode: c.hasCode,
      tags: c.tags,
      readProgress: c.readProgress,
      readAt: c.readAt,
    }));
  }

  /** 全库搜索：内存实现，title/content/source/tag 子串匹配（不区分大小写）。 */
  async search(query: string): Promise<SearchResult[]> {
    const q = query.trim();
    if (!q) return [];
    const ql = q.toLowerCase();
    const all = await this.readAll();
    const matched = all
      .filter(
        (c) =>
          c.title.toLowerCase().includes(ql) ||
          c.content.toLowerCase().includes(ql) ||
          c.sourceUrl.toLowerCase().includes(ql) ||
          (c.tags ?? []).some((tag) => tag === q),

      )
      .sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1))
      .slice(0, 50);
    return matched.map((c) => ({
      id: c.id,
      title: c.title,
      sourceUrl: c.sourceUrl,
      capturedAt: c.capturedAt,
      publishedAt: c.publishedAt,
      coverImage: c.coverImage,
      excerpt: c.excerpt,
      wordCount: c.wordCount,
      hasCode: c.hasCode,
      tags: c.tags,
      readProgress: c.readProgress,
      readAt: c.readAt,
      snippet: makeSnippet(c.content, q) || c.excerpt,
    }));
  }

  async get(id: string): Promise<Capture | null> {
    try {
      const text = await readFile(this.file(id), "utf8");
      return JSON.parse(text) as Capture;
    } catch {
      return null;
    }
  }

  async findBySourceUrl(url: string): Promise<Capture | null> {
    const all = await this.readAll();
    return all.find((c) => c.sourceUrl === url) ?? null;
  }

  async delete(id: string): Promise<void> {
    await unlink(this.file(id)).catch(() => {});
  }

  async updateReadStatus(
    id: string,
    status: { readProgress: number; readAt?: string }
  ): Promise<void> {
    const capture = await this.get(id);
    if (!capture) return;
    capture.readProgress = status.readProgress;
    if (status.readAt && !capture.readAt) {
      capture.readAt = status.readAt;
    }
    await writeFile(this.file(id), JSON.stringify(capture, null, 2), "utf8");
  }

  async updateTags(id: string, tags: string[]): Promise<void> {
    const capture = await this.get(id);
    if (!capture) return;
    capture.tags = tags;
    await writeFile(this.file(id), JSON.stringify(capture, null, 2), "utf8");
  }

  // TODO: read-modify-write race — two concurrent visits may lose one readCount increment.
  // Acceptable for file-store v1; fix when migrating to a database with atomic updates.
  async recordVisit(id: string, visitedAt: string): Promise<void> {
    const capture = await this.get(id);
    if (!capture) return;
    capture.lastOpenedAt = visitedAt;
    capture.readCount = (capture.readCount ?? 0) + 1;
    await writeFile(this.file(id), JSON.stringify(capture, null, 2), "utf8");
  }
}
