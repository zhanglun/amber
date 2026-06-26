import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { defineCommand } from "citty";
import { PostgresStore } from "@amber/adapters";
import type { Capture } from "@amber/domain";

export const migrateCommand = defineCommand({
  meta: {
    name: "migrate",
    description: "从文件存储迁移 Capture 数据到 PostgreSQL",
  },
  args: {
    dataDir: {
      type: "string",
      description: "源数据目录（默认：AMBER_DATA_DIR 或 ./amber-data）",
    },
    dryRun: {
      type: "boolean",
      description: "只打印将被迁移的条目，不实际写入",
      default: false,
    },
  },
  async run({ args }) {
    // citty 在 boolean arg 带 default 值时，kebab-case 命令行参数（--dry-run）会被
    // default 值遮蔽（args.dryRun 取到 default 的 false）。同时检查两种形式。
    const dryRun = Boolean(args.dryRun || args["dry-run"]);
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      console.error("错误：需要设置 DATABASE_URL 环境变量");
      process.exit(1);
    }

    const dataDir = resolve(
      (args.dataDir as string | undefined) ??
        process.env.AMBER_DATA_DIR ??
        "./amber-data"
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
      console.log("没有找到需要迁移的数据。");
      return;
    }

    console.log(
      `找到 ${jsonFiles.length} 条记录，目标数据库：${dbUrl.replace(/\/\/.*@/, "//***@")}`
    );
    if (dryRun) {
      console.log("（dry-run 模式，不写入数据库）");
    }

    const store = new PostgresStore(dbUrl);
    let migrated = 0;
    let skipped = 0;

    for (const file of jsonFiles) {
      const text = await readFile(join(capturesDir, file), "utf8");
      const capture: Capture = JSON.parse(text);

      if (!dryRun) {
        const existing = await store.get(capture.id);
        if (existing) {
          console.log(`  跳过（已存在）：${capture.title}`);
          skipped++;
          continue;
        }
        await store.insert(capture);
      }

      console.log(`  ✓ ${capture.title}`);
      migrated++;
    }

    await store.disconnect();

    if (dryRun) {
      console.log(`\n共 ${migrated} 条将被迁移。`);
    } else {
      console.log(`\n完成：迁移 ${migrated} 条，跳过 ${skipped} 条（已存在）。`);
    }
  },
});
