const LOG_FILE_RE = /^web-(\d{4}-\d{2}-\d{2})\.log$/;

export function dateStamp(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function logFileName(date: Date): string {
  return `web-${dateStamp(date)}.log`;
}

export function pickLatestLogFile(filenames: string[]): string | null {
  const logs = filenames.filter((f) => LOG_FILE_RE.test(f)).sort();
  return logs.length > 0 ? logs[logs.length - 1] : null;
}

export function shouldRotate(openedDate: Date, now: Date): boolean {
  return dateStamp(openedDate) !== dateStamp(now);
}
