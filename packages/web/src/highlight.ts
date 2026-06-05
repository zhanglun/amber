import MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";
import { createHighlighter, type Highlighter } from "shiki";
import type { TocItem } from "./toc.js";

let _init: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  if (!_init) {
    _init = createHighlighter({
      themes: ["github-light", "github-dark"],
      langs: ["typescript", "javascript", "python", "bash", "json", "css", "html", "markdown"],
    });
  }
  return _init;
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function isLocalVideoHref(href: string): boolean {
  const path = href.split(/[?#]/, 1)[0].toLowerCase();
  return path.startsWith("/blobs/") && /\.(mp4|webm|ogv|mov)$/.test(path);
}

function videoLinkFromInline(token: Token): { href: string } | null {
  const children = token.children;
  if (!children || children.length < 2) return null;

  const first = children[0];
  const last = children[children.length - 1];
  if (first.type !== "link_open" || last.type !== "link_close") return null;
  if (children.slice(1, -1).some((child) => child.type !== "text")) return null;

  const href = first.attrGet("href");
  return href && isLocalVideoHref(href) ? { href } : null;
}

function videoFigure(href: string): string {
  const safeHref = escapeHtml(href);
  return (
    `<figure class="video-embed">` +
    `<video controls preload="metadata" src="${safeHref}"></video>` +
    `<figcaption><a href="${safeHref}">Open video</a></figcaption>` +
    `</figure>`
  );
}

function installVideoEmbeds(md: MarkdownIt): void {
  md.core.ruler.after("inline", "amber_video_embeds", (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length - 2; i++) {
      const paragraphOpen = tokens[i];
      const inline = tokens[i + 1];
      const paragraphClose = tokens[i + 2];
      if (
        paragraphOpen.type !== "paragraph_open" ||
        inline.type !== "inline" ||
        paragraphClose.type !== "paragraph_close"
      ) {
        continue;
      }

      const video = videoLinkFromInline(inline);
      if (!video) continue;

      paragraphOpen.type = "html_block";
      paragraphOpen.tag = "";
      paragraphOpen.nesting = 0;
      paragraphOpen.attrs = null;
      paragraphOpen.children = null;
      paragraphOpen.content = videoFigure(video.href);
      paragraphOpen.block = true;
      tokens.splice(i + 1, 2);
    }
  });
}

function installHeadingIds(md: MarkdownIt, toc: TocItem[] | undefined): void {
  if (!toc || toc.length === 0) return;
  let index = 0;
  const defaultHeadingOpen = md.renderer.rules.heading_open;

  md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const level = token.tag === "h2" ? 2 : token.tag === "h3" ? 3 : null;
    if (level === 2 || level === 3) {
      const item = toc[index];
      if (item && item.level === level) {
        token.attrSet("id", item.id);
        index += 1;
      }
    }
    return defaultHeadingOpen
      ? defaultHeadingOpen(tokens, idx, options, env, self)
      : self.renderToken(tokens, idx, options);
  };
}

export interface RenderMarkdownOptions {
  toc?: TocItem[];
}

export async function renderMarkdown(content: string, options: RenderMarkdownOptions = {}): Promise<string> {
  const hl = await getHighlighter();
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    highlight(code, lang) {
      if (lang) {
        try {
          const light = hl.codeToHtml(code, { theme: "github-light", lang });
          const dark = hl.codeToHtml(code, { theme: "github-dark", lang });
          return light.replace("<pre ", `<pre data-language="${lang}" `) + dark;
        } catch {
          // unknown language — fall through to markdown-it default
        }
      }
      return "";
    },
  });
  installHeadingIds(md, options.toc);
  installVideoEmbeds(md);
  return md.render(content);
}
