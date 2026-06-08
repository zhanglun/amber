import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import type { ReadService } from "@amber/core";
import { renderArticle, renderList } from "./render.js";
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
    return c.html(renderList(items));
  });

  app.get("/captures/:id", async (c) => {
    const id = c.req.param("id");
    const [capture, all] = await Promise.all([readService.get(id), readService.list()]);
    if (!capture) return c.html("<p>Not found. <a href='/'>back</a></p>", 404);
    void readService.recordVisit(id, new Date().toISOString());
    const idx = all.findIndex((s) => s.id === id);
    const neighbors = idx === -1
      ? { prev: null, next: null }
      : {
          prev: idx > 0 ? all[idx - 1] : null,
          next: idx < all.length - 1 ? all[idx + 1] : null,
        };
    return c.html(await renderArticle(capture, neighbors));
  });

  app.post("/captures/:id/delete", async (c) => {
    await options.deleteCapture(c.req.param("id"));
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
    deleteCapture: options.deleteCapture,
    requestLog: true,
  });
  serve({ fetch: app.fetch, port: options.port, hostname: options.hostname }, () => options.onReady?.());
}
