import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import type { BlobStore } from "@amber/domain";
import type { ReadService } from "@amber/core";
import { renderArticle, renderLibrary, renderList } from "./render.js";
import { errorHandler, requestLogger } from "./request-log.js";

const MIME: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
  ".mp4": "video/mp4", ".webm": "video/webm", ".ogv": "video/ogg",
  ".mov": "video/quicktime",
};

export function contentTypeForPath(path: string): string {
  return MIME[extname(path).toLowerCase()] ?? "application/octet-stream";
}

export interface WebOptions {
  blobsDir: string;
  /** 用于把正文里的 amber-asset:<key> 解析成实际访问 URL。 */
  blob: BlobStore;
  deleteCapture: (id: string) => Promise<void>;
  onReady?: () => void;
  requestLog?: boolean;
}

export function createApp(readService: ReadService, options: WebOptions): Hono {
  const app = new Hono();

  if (options.requestLog) {
    app.use(requestLogger());
    app.onError(errorHandler());
  }

  app.get("/", async (c) => {
    const items = await readService.list();
    return c.html(renderList(items.filter((item) => item.inboxAt)));
  });

  /** 长期书架：已安顿内容的多重标签索引，不由标签顺序决定唯一位置。 */
  app.get("/library", async (c) => {
    const items = await readService.list();
    return c.html(renderLibrary(items.filter((item) => !item.inboxAt)));
  });

  /** 全库搜索：搜全部 Capture 的 title + content，返回命中 + 片段。 */
  app.get("/search", async (c) => {
    const q = c.req.query("q") ?? "";
    const results = q.trim() ? await readService.search(q) : [];
    return c.json({ query: q, count: results.length, results });
  });

  app.get("/captures/:id", async (c) => {
    const id = c.req.param("id");
    const [capture, all] = await Promise.all([readService.get(id), readService.list()]);
    if (!capture) return c.html("<p>Not found. <a href='/'>back</a></p>", 404);
    void readService.recordVisit(id, new Date().toISOString());
    // 阅读路径不跨越注意力边界：Inbox 文章只串联 Inbox，书架文章只串联书架。
    const sameView = all.filter((item) => Boolean(item.inboxAt) === Boolean(capture.inboxAt));
    const idx = sameView.findIndex((s) => s.id === id);
    const neighbors = idx === -1
      ? { prev: null, next: null }
      : {
          prev: idx > 0 ? sameView[idx - 1] : null,
          next: idx < sameView.length - 1 ? sameView[idx + 1] : null,
        };
    return c.html(await renderArticle(capture, neighbors, options.blob));
  });

  app.post("/captures/:id/delete", async (c) => {
    await options.deleteCapture(c.req.param("id"));
    return c.redirect("/", 303);
  });

  /** 显式安顿：内容永久保留，只是不再占据收件箱。 */
  app.post("/captures/:id/shelve", async (c) => {
    await readService.shelve(c.req.param("id"));
    return c.redirect("/library", 303);
  });

  /** 显式重新进入注意力队列，按当前时间排到收件箱顶部。 */
  app.post("/captures/:id/return-to-inbox", async (c) => {
    await readService.returnToInbox(c.req.param("id"), new Date().toISOString());
    return c.redirect("/", 303);
  });

  app.patch("/captures/:id/read", async (c) => {
    const id = c.req.param("id");
    const capture = await readService.get(id);
    if (!capture) return c.body(null, 404);
    const body = await c.req.json<{ readProgress: number; readAt?: string }>();
    await readService.updateReadStatus(id, body);
    return c.body(null, 204);
  });

  app.patch("/captures/:id/tags", async (c) => {
    const id = c.req.param("id");
    const capture = await readService.get(id);
    if (!capture) return c.body(null, 404);
    const body = await c.req.json<{ tags: string[] }>();
    await readService.updateTags(id, body.tags ?? []);
    return c.body(null, 204);
  });

  app.get("/blobs/*", async (c) => {
    const rel = normalize(c.req.path.slice("/blobs/".length));
    if (rel.startsWith("..")) return c.notFound();
    const file = join(options.blobsDir, rel);
    try {
      const info = await stat(file);
      if (!info.isFile()) return c.notFound();
    } catch {
      return c.notFound();
    }
    const stream = createReadStream(file) as unknown as ReadableStream;
    return new Response(stream, { headers: { "content-type": contentTypeForPath(rel) } });
  });

  return app;
}

export function startServer(readService: ReadService, options: WebOptions & { port: number; hostname?: string }): void {
  const app = createApp(readService, {
    blobsDir: options.blobsDir,
    blob: options.blob,
    deleteCapture: options.deleteCapture,
    requestLog: true,
  });
  serve({ fetch: app.fetch, port: options.port, hostname: options.hostname }, () => options.onReady?.());
}
