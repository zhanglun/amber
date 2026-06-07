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
