export function computeWordCount(markdown: string): number {
  return markdown.replace(/```[\s\S]*?```/g, "").replace(/\s/g, "").length;
}

export function computeHasCode(markdown: string): boolean {
  return /^```|^~~~/m.test(markdown);
}

export function computeExcerpt(markdown: string, maxLen = 150): string {
  let text = markdown
    .replace(/```[\s\S]*?```/g, "")    // fenced code blocks
    .replace(/`[^`\n]+`/g, "")          // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links → text
    .replace(/^#{1,6}\s+.*$/gm, "")      // headings (remove entire line)
    .replace(/[*_]{1,3}([^*_\n]+)[*_]{1,3}/g, "$1") // bold/italic
    .replace(/^\s*[-*+]\s+/gm, "")      // list markers
    .replace(/^\s*\d+\.\s+/gm, "")      // ordered list markers
    .trim();

  const first = text.split(/\n\n+/).map((s) => s.replace(/\s+/g, " ").trim()).find((s) => s.length > 0) ?? "";
  return first.length <= maxLen ? first : first.slice(0, maxLen) + "…";
}
