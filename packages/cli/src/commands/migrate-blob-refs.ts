import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { defineCommand } from "citty";
import type { Capture } from "@amber/domain";
import { migrateCaptureList } from "../migrate-blob-refs.js";

export const migrateBlobRefsCommand = defineCommand({
  meta: {
    name: "migrate-blob-refs",
    description: "把存量 capture 正文里的 blob URL 反解析成 amber-asset:<key> 稳定引用",
  },
  args: {
    dataDir: {
      type: "string",
      description: "数据目录（默认：AMBER_DATA_DIR 或 ./amber-data）",
    },
    dryRun: {
      type: "boolean",
      description: "只打印将改动的条目，不实际写回",
      default: false,
    },
  },
  async run({ args }) {
    const dataDir = resolve(
      (args.dataDir as string | undefined) ??
        process.env.AMBER_DATA_DIR ??
        "./amber-data",
    );
    const capturesDir = join(dataDir, "captures");

    let names: string[];
    try {
      names = await readdir(capturesDir);
    } catch {
      console.error(`错误：找不到目录 ${capturesDir}`);
      process.exit(1);
    }

    const jsonFiles = names.filter((n) => n.endsWith(".json"));
    if (jsonFiles.length === 0) {
      console.log("没有找到 capture 数据。");
      return;
    }

    const publicBaseUrl = process.env.AMBER_PUBLIC_BASE_URL ?? "";
    const publicBaseUrls = publicBaseUrl ? [publicBaseUrl] : [];

    const captures: { id: string; content: string }[] = [];
    const rawTexts = new Map<string, string>();
    for (const file of jsonFiles) {
      const text = await readFile(join(capturesDir, file), "utf8");
      const capture: Capture = JSON.parse(text);
      captures.push({ id: capture.id, content: capture.content });
      rawTexts.set(capture.id, text);
    }

    const { results, stats } = migrateCaptureList(captures, publicBaseUrls);

    console.log(`扫描 ${captures.length} 条，将改动 ${stats.changed} 条（重写 ${stats.refsRewritten} 处引用）。`);
    if (args.dryRun) {
      console.log("（dry-run 模式，不写回文件）");
      for (const r of results) {
        if (r.content !== captures.find((c) => c.id === r.id)!.content) {
          console.log(`  ~ ${r.id}`);
        }
      }
      return;
    }

    let written = 0;
    for (const r of results) {
      if (r.content === captures.find((c) => c.id === r.id)!.content) continue;
      const file = jsonFiles.find((f) => f.startsWith(r.id))!;
      const original: Capture = JSON.parse(rawTexts.get(r.id)!);
      await writeFile(join(capturesDir, file), JSON.stringify({ ...original, content: r.content }, null, 2), "utf8");
      written++;
      console.log(`  ✓ ${r.id}`);
    }

    console.log(`\n完成：更新 ${written} 条，跳过 ${stats.unchanged} 条（无需改动）。`);
  },
});
