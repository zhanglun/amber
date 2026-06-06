import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Capture, CaptureSummary, Store } from "@amber/domain";

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
      captures.push(JSON.parse(text) as Capture);
    }
    return captures;
  }

  async insert(capture: Capture): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.file(capture.id), JSON.stringify(capture, null, 2), "utf8");
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

  async recordVisit(id: string, visitedAt: string): Promise<void> {
    const capture = await this.get(id);
    if (!capture) return;
    capture.lastOpenedAt = visitedAt;
    capture.readCount = (capture.readCount ?? 0) + 1;
    await writeFile(this.file(id), JSON.stringify(capture, null, 2), "utf8");
  }
}
