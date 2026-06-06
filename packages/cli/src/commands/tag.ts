import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import { normalizeTags, type ReadService } from "@amber/core";
import { buildServices } from "../wiring.js";

export type TagResult =
  | { ok: true; tags: string[] }
  | { ok: false; error: string };

/** 读取某条 capture 的标签。 */
export async function runTagLs(readService: ReadService, id: string): Promise<TagResult> {
  const cap = await readService.get(id);
  if (!cap) return { ok: false, error: `Capture not found: ${id}` };
  return { ok: true, tags: cap.tags ?? [] };
}

/** 追加标签（归一化去重）。 */
export async function runTagAdd(readService: ReadService, id: string, add: string[]): Promise<TagResult> {
  const cap = await readService.get(id);
  if (!cap) return { ok: false, error: `Capture not found: ${id}` };
  const next = normalizeTags([...(cap.tags ?? []), ...add]);
  await readService.updateTags(id, next);
  return { ok: true, tags: next };
}

/** 移除标签（区分大小写精确匹配）。 */
export async function runTagRm(readService: ReadService, id: string, remove: string[]): Promise<TagResult> {
  const cap = await readService.get(id);
  if (!cap) return { ok: false, error: `Capture not found: ${id}` };
  const toRemove = new Set(remove);
  const next = (cap.tags ?? []).filter((t) => !toRemove.has(t));
  await readService.updateTags(id, next);
  return { ok: true, tags: next };
}

function report(res: TagResult): void {
  if (!res.ok) {
    p.log.error(res.error);
    process.exitCode = 1;
    return;
  }
  if (res.tags.length === 0) {
    p.log.info("No tags.");
    return;
  }
  p.log.message(res.tags.join(", "));
}

function positionals(args: { _: string[] }): string[] {
  return (args._ ?? []).map(String);
}

export const tagCommand = defineCommand({
  meta: { name: "tag", description: "Manage tags on a capture" },
  subCommands: {
    ls: defineCommand({
      meta: { name: "ls", description: "List tags of a capture" },
      args: { id: { type: "positional", description: "Capture id", required: true } },
      async run(ctx) {
        const [id] = positionals(ctx.args);
        const { readService, dispose } = buildServices();
        try {
          report(await runTagLs(readService, id));
        } finally {
          await dispose();
        }
      },
    }),
    add: defineCommand({
      meta: { name: "add", description: "Add tags to a capture" },
      args: {
        id: { type: "positional", description: "Capture id", required: true },
        tags: { type: "positional", description: "Tags to add", required: true },
      },
      async run(ctx) {
        const [id, ...tags] = positionals(ctx.args);
        if (tags.length === 0) {
          p.log.error("Provide at least one tag.");
          process.exitCode = 1;
          return;
        }
        const { readService, dispose } = buildServices();
        try {
          report(await runTagAdd(readService, id, tags));
        } finally {
          await dispose();
        }
      },
    }),
    rm: defineCommand({
      meta: { name: "rm", description: "Remove tags from a capture" },
      args: {
        id: { type: "positional", description: "Capture id", required: true },
        tags: { type: "positional", description: "Tags to remove", required: true },
      },
      async run(ctx) {
        const [id, ...tags] = positionals(ctx.args);
        if (tags.length === 0) {
          p.log.error("Provide at least one tag.");
          process.exitCode = 1;
          return;
        }
        const { readService, dispose } = buildServices();
        try {
          report(await runTagRm(readService, id, tags));
        } finally {
          await dispose();
        }
      },
    }),
  },
});
