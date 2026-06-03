export interface TocItem {
  level: 2 | 3;
  text: string;
  id: string;
}

function cleanInlineMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/\\([\\`*_[\]()#+\-.!{}>])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function slugBase(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "section";
}

function dedupeSlug(base: string, counts: Map<string, number>): string {
  const next = (counts.get(base) ?? 0) + 1;
  counts.set(base, next);
  return next === 1 ? base : `${base}-${next}`;
}

export function extractToc(markdown: string): TocItem[] {
  const items: TocItem[] = [];
  const counts = new Map<string, number>();
  let inFence = false;

  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const match = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;

    const level = match[1].length as 2 | 3;
    const text = cleanInlineMarkdown(match[2]);
    if (!text) continue;

    const base = slugBase(text);
    items.push({ level, text, id: dedupeSlug(base, counts) });
  }

  return items;
}
