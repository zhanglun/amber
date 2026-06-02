import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join, normalize } from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import type { ReadService } from "@amber/core";
import { renderArticle, renderList } from "./render.js";

const MIME: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
};

export interface WebOptions {
  /** 本地 blobs 根目录（FileBlobStore 写入的 <dataDir>/blobs）。 */
  blobsDir: string;
  /** 服务器开始监听后的回调（可用于打开浏览器等）。 */
  onReady?: () => void;
}

export function createApp(readService: ReadService, options: WebOptions): Hono {
  const app = new Hono();

  app.get("/", async (c) => c.html(renderList(await readService.list())));

  app.get("/captures/:id", async (c) => {
    const capture = await readService.get(c.req.param("id"));
    if (!capture) return c.html("<p>Not found. <a href='/'>back</a></p>", 404);
    return c.html(await renderArticle(capture));
  });

  // serve 本地图片：/blobs/<key> → <blobsDir>/<key>
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
    const ext = rel.slice(rel.lastIndexOf(".")).toLowerCase();
    const stream = createReadStream(file) as unknown as ReadableStream;
    return new Response(stream, { headers: { "content-type": MIME[ext] ?? "application/octet-stream" } });
  });

  return app;
}

export function startServer(readService: ReadService, options: WebOptions & { port: number }): void {
  const app = createApp(readService, { blobsDir: options.blobsDir });
  serve({ fetch: app.fetch, port: options.port }, () => options.onReady?.());
}
