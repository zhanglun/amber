import MarkdownIt from "markdown-it";
import { createHighlighter, type Highlighter } from "shiki";

let _highlighter: Highlighter | null = null;

async function getHighlighter(): Promise<Highlighter> {
  if (!_highlighter) {
    _highlighter = await createHighlighter({
      themes: ["github-light", "github-dark"],
      langs: ["typescript", "javascript", "python", "bash", "json", "css", "html", "markdown"],
    });
  }
  return _highlighter;
}

export async function renderMarkdown(content: string): Promise<string> {
  const hl = await getHighlighter();
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    highlight(code, lang) {
      if (lang) {
        try {
          const light = hl.codeToHtml(code, { theme: "github-light", lang });
          const dark = hl.codeToHtml(code, { theme: "github-dark", lang });
          return light + dark;
        } catch {
          // unknown language — fall through to markdown-it default
        }
      }
      return "";
    },
  });
  return md.render(content);
}
