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

export function expiredLogFiles(filenames: string[], today: Date, keepDays: number): string[] {
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - keepDays);
  const cutoffStamp = dateStamp(cutoff);
  return filenames.filter((f) => {
    const m = LOG_FILE_RE.exec(f);
    return m !== null && m[1] < cutoffStamp;
  });
}

export function lastLines(text: string, n: number): string {
  const trimmed = text.endsWith("\n") ? text.slice(0, -1) : text;
  if (trimmed === "") return "";
  const lines = trimmed.split("\n");
  return lines.slice(Math.max(0, lines.length - n)).join("\n");
}
