import { readdir, readFile, rm, writeFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { defineCommand } from "citty";
import { optimizeImage } from "@amber/core";
import type { Capture } from "@amber/domain";
import { findConvertibleRefs, rewriteAssetRefs } from "../optimize-images.js";

export const optimizeImagesCommand = defineCommand({
  meta: {
    name: "optimize-images",
    description: "把存量图片 blob 批量压缩转成 webp，并更新正文引用",
  },
  args: {
    dataDir: {
      type: "string",
      description: "数据目录（默认：AMBER_DATA_DIR 或 ./amber-data）",
    },
    dryRun: {
      type: "boolean",
      description: "只打印将转换的条目，不实际写回",
      default: false,
    },
    keepOriginal: {
      type: "boolean",
      description: "保留原始图片文件（默认删除以节省空间）",
      default: false,
    },
  },
  async run({ args }) {
    const dryRun = Boolean(args.dryRun || args["dry-run"]);
    const keepOriginal = Boolean(args.keepOriginal || args["keep-original"]);
    const dataDir = resolve(
      (args.dataDir as string | undefined) ??
        process.env.AMBER_DATA_DIR ??
        "./amber-data",
    );
    const capturesDir = join(dataDir, "captures");
    const blobsDir = join(dataDir, "blobs");

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

    let converted = 0;
    let skipped = 0;
    let failed = 0;
    let savedBytes = 0;

    for (const file of jsonFiles) {
      const path = join(capturesDir, file);
      const text = await readFile(path, "utf8");
      const capture: Capture = JSON.parse(text);
      const refs = findConvertibleRefs(capture.content);
      if (refs.length === 0) {
        skipped++;
        continue;
      }

      // 逐个引用：读原始 blob → 转 webp → 写新 blob →（可选）删旧文件。
      let newContent = capture.content;
      let fileChanged = false;
      for (const ref of refs) {
        const srcPath = join(blobsDir, ref.oldKey);
        try {
          const data = await readFile(srcPath);
          const contentType = contentTypeForExt(ref.oldKey);
          const optimized = await optimizeImage(new Uint8Array(data), contentType);
          if (!optimized) {
            failed++;
            continue;
          }
          const destPath = join(blobsDir, ref.newKey);
          if (!dryRun) {
            await writeFile(destPath, optimized.data);
            if (!keepOriginal) await rm(srcPath).catch(() => {});
          }
          const oldSize = data.length;
          const newSize = optimized.data.length;
          savedBytes += Math.max(0, oldSize - newSize);
          fileChanged = true;
          converted++;
          console.log(`  ${dryRun ? "~" : "✓"} ${ref.oldKey} → ${ref.newKey} (${formatSize(oldSize)} → ${formatSize(newSize)})`);
        } catch {
          failed++;
          console.log(`  ✗ ${ref.oldKey}（读取或转换失败）`);
        }
      }

      // 更新正文引用。
      if (fileChanged && !dryRun) {
        const { content } = rewriteAssetRefs(capture.content);
        await writeFile(path, JSON.stringify({ ...capture, content }, null, 2), "utf8");
      }
    }

    console.log(
      `\n${dryRun ? "[dry-run] " : ""}转换 ${converted} 张，跳过 ${skipped} 条 capture，失败 ${failed} 张，节省 ${formatSize(savedBytes)}。`,
    );
  },
});

function contentTypeForExt(key: string): string {
  const ext = key.slice(key.lastIndexOf(".") + 1).toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  return "";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
