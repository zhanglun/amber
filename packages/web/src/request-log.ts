import type { ErrorHandler, MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";

export function formatRequestLine(
  method: string,
  path: string,
  status: number,
  ms: number,
  now: Date,
): string {
  return `[${now.toISOString()}] ${method} ${path} ${status} ${ms}ms`;
}

export function formatErrorLine(
  method: string,
  path: string,
  err: unknown,
  now: Date,
): string {
  const detail = err instanceof Error ? (err.stack ?? err.message) : String(err);
  return `[${now.toISOString()}] ERROR ${method} ${path}: ${detail}`;
}

export function requestLogger(now: () => Date = () => new Date()): MiddlewareHandler {
  return async (c, next) => {
    const start = Date.now();
    const ts = now(); // 在请求到达时取时间戳（access-log 惯例），耗时用真实 Date.now() 单独算
    await next();
    const ms = Date.now() - start;
    // 已验证：handler 抛错时 Hono 先跑 onError 设 500，再让 next() 正常返回，
    // 因此这里的 c.res.status 已是最终状态码（含 500），无需 try/catch。
    console.log(formatRequestLine(c.req.method, c.req.path, c.res.status, ms, ts));
  };
}

export function errorHandler(now: () => Date = () => new Date()): ErrorHandler {
  return (err, c) => {
    console.error(formatErrorLine(c.req.method, c.req.path, err, now()));
    // 尊重带状态码的 HTTPException（如 404/401），否则统一返回 500 页
    if (err instanceof HTTPException) {
      return err.getResponse();
    }
    return c.html("<p>出错了。<a href='/'>返回</a></p>", 500);
  };
}
