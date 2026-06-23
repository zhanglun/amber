# PostgreSQL + R2 存储后端实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 PostgresStore 和 R2BlobStore，通过环境变量自动切换，替代当前的文件存储，并提供数据迁移命令。

**Architecture:** `PostgresStore` 和 `R2BlobStore` 作为独立类新增到 `@amber/adapters` 包；`cli/src/wiring.ts` 根据 `DATABASE_URL` / R2 环境变量自动选择对应实现；新增 `amber migrate` 命令用于将 FileStore 数据导入 Postgres。

**Tech Stack:** Prisma 6（ORM + 迁移）、@prisma/client、@aws-sdk/client-s3、vitest（测试，Postgres 集成测试通过 TEST_DATABASE_URL 跳过条件激活）。

---

## 文件结构

新建：
- `packages/adapters/prisma/schema.prisma` — Prisma 数据模型
- `packages/adapters/src/postgres-store.ts` — PostgresStore（实现 Store 接口全部 8 个方法）
- `packages/adapters/src/postgres-store.test.ts` — 集成测试（需要 TEST_DATABASE_URL，否则 skip）
- `packages/adapters/src/r2-blob-store.ts` — R2BlobStore（实现 BlobStore 接口）
- `packages/adapters/src/r2-blob-store.test.ts` — 单元测试（mock S3Client）
- `packages/adapters/docker-compose.test.yml` — 用于本地开发时运行 Postgres 测试库
- `vitest.globalSetup.ts` — 自动对测试 DB 执行 `prisma db push`
- `packages/cli/src/commands/migrate.ts` — `amber migrate` 命令
- `.env.example` — 环境变量说明文档

修改：
- `packages/adapters/package.json` — 添加 prisma、@prisma/client、@aws-sdk/client-s3 依赖
- `packages/adapters/src/index.ts` — 导出新的 store 类和工厂函数
- `packages/cli/src/wiring.ts` — 根据环境变量自动选择 Store/BlobStore 实现
- `packages/cli/src/main.ts` — 注册 migrate 子命令
- `vitest.config.ts` — 添加 globalSetup

---

## Task 1: Prisma 依赖、Schema 与测试基础设施

**Files:**
- Create: `packages/adapters/prisma/schema.prisma`
- Create: `packages/adapters/docker-compose.test.yml`
- Create: `vitest.globalSetup.ts`
- Modify: `packages/adapters/package.json`
- Modify: `vitest.config.ts`

- [x] **Step 1: 更新 adapters/package.json，添加依赖**

将 `packages/adapters/package.json` 改为：

```json
{
  "name": "@amber/adapters",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "@amber/domain": "workspace:*",
    "@aws-sdk/client-s3": "^3.700.0",
    "@prisma/client": "^6.0.0",
    "dino": "github:zhanglun/dino#v0.2.5"
  },
  "devDependencies": {
    "prisma": "^6.0.0"
  }
}
```

- [x] **Step 2: 创建 Prisma Schema**

创建 `packages/adapters/prisma/schema.prisma`：

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Capture {
  id           String    @id
  title        String
  content      String
  sourceUrl    String    @unique
  sourceType   String    @default("url")
  author       String?
  capturedAt   DateTime
  publishedAt  String?
  coverImage   String?
  excerpt      String?
  wordCount    Int?
  hasCode      Boolean?
  tags         String[]
  readProgress Int?
  readAt       DateTime?
  lastOpenedAt DateTime?
  readCount    Int       @default(0)
}
```

注意：`publishedAt` 使用 `String?` 而非 `DateTime?`，因为原始值可能带时区偏移（如 `"2024-03-15T01:00:00+08:00"`），存为 String 可避免 UTC 转换导致日期偏移一天。

- [x] **Step 3: 创建 docker-compose.test.yml**

创建 `packages/adapters/docker-compose.test.yml`（开发者本地一次性启动用）：

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: amber_test
      POSTGRES_USER: amber
      POSTGRES_PASSWORD: amber
    ports:
      - "5433:5432"
```

本地启动命令（一次性）：
```bash
docker compose -f packages/adapters/docker-compose.test.yml up -d
```

对应的 `TEST_DATABASE_URL`：
```
TEST_DATABASE_URL=postgres://amber:amber@localhost:5433/amber_test
```

- [x] **Step 4: 创建 vitest.globalSetup.ts**

在项目根目录创建 `vitest.globalSetup.ts`：

```typescript
import { execSync } from "node:child_process";

export async function setup() {
  const testDbUrl = process.env.TEST_DATABASE_URL;
  if (!testDbUrl) return;
  execSync(
    "pnpm --filter @amber/adapters exec prisma db push --skip-generate --accept-data-loss",
    {
      env: { ...process.env, DATABASE_URL: testDbUrl },
      stdio: "pipe",
    }
  );
}
```

- [x] **Step 5: 更新根目录 vitest.config.ts**

将 `vitest.config.ts` 改为：

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.{ts,tsx}"],
    globalSetup: "./vitest.globalSetup.ts",
  },
});
```

- [x] **Step 6: 安装依赖并生成 Prisma Client**

```bash
pnpm install
DATABASE_URL=postgres://placeholder/placeholder pnpm --filter @amber/adapters exec prisma generate --schema=prisma/schema.prisma
```

预期输出：`✔ Generated Prisma Client`

- [x] **Step 7: 验证现有测试仍通过**

```bash
pnpm test
```

预期：所有已有测试 PASS（postgres-store.test.ts 还不存在，不影响）

- [x] **Step 8: 提交**

```bash
git add packages/adapters/package.json packages/adapters/prisma/schema.prisma packages/adapters/docker-compose.test.yml vitest.globalSetup.ts vitest.config.ts pnpm-lock.yaml
git commit -m "feat(adapters): add prisma schema and vitest global setup for postgres integration tests"
```

---

## Task 2: PostgresStore 实现

**Files:**
- Create: `packages/adapters/src/postgres-store.ts`
- Create: `packages/adapters/src/postgres-store.test.ts`

- [x] **Step 1: 编写测试文件**

创建 `packages/adapters/src/postgres-store.test.ts`：

```typescript
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Capture } from "@amber/domain";
import { PostgresStore } from "./postgres-store.js";

const TEST_DB_URL = process.env.TEST_DATABASE_URL;

function cap(over: Partial<Capture> = {}): Capture {
  return {
    id: "c1",
    title: "T",
    content: "body",
    sourceUrl: "https://x/a",
    sourceType: "url",
    capturedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

describe.skipIf(!TEST_DB_URL)("PostgresStore", () => {
  let store: PostgresStore;

  beforeAll(async () => {
    store = new PostgresStore(TEST_DB_URL!);
  });

  afterAll(async () => {
    await store.disconnect();
  });

  beforeEach(async () => {
    await store.deleteAll();
  });

  // ── insert / get ──────────────────────────────────────────────────────────

  it("insert then get round-trips a capture", async () => {
    const c = cap({ id: "abc", title: "Hello" });
    await store.insert(c);
    const found = await store.get("abc");
    expect(found?.id).toBe("abc");
    expect(found?.title).toBe("Hello");
    expect(found?.capturedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("get returns null for unknown id", async () => {
    expect(await store.get("nope")).toBeNull();
  });

  it("insert preserves optional string fields", async () => {
    await store.insert(cap({
      id: "opt",
      author: "Alice",
      publishedAt: "2024-03-15T01:00:00+08:00",
      coverImage: "https://img/c.jpg",
      excerpt: "First para.",
    }));
    const found = await store.get("opt");
    expect(found?.author).toBe("Alice");
    expect(found?.publishedAt).toBe("2024-03-15T01:00:00+08:00");
    expect(found?.coverImage).toBe("https://img/c.jpg");
    expect(found?.excerpt).toBe("First para.");
  });

  it("insert preserves computed fields", async () => {
    await store.insert(cap({ id: "cmp", wordCount: 42, hasCode: true }));
    const found = await store.get("cmp");
    expect(found?.wordCount).toBe(42);
    expect(found?.hasCode).toBe(true);
  });

  // ── list ──────────────────────────────────────────────────────────────────

  it("list returns summaries sorted by capturedAt desc", async () => {
    await store.insert(cap({ id: "old", capturedAt: "2026-01-01T00:00:00.000Z" }));
    await store.insert(cap({ id: "new", sourceUrl: "https://x/b", capturedAt: "2026-02-01T00:00:00.000Z" }));
    const list = await store.list();
    expect(list.map((s) => s.id)).toEqual(["new", "old"]);
  });

  it("list omits content field", async () => {
    await store.insert(cap({ id: "lc" }));
    const list = await store.list();
    expect(list[0]).not.toHaveProperty("content");
  });

  it("list includes optional fields when present", async () => {
    await store.insert(cap({
      id: "rich",
      coverImage: "https://img/cover.jpg",
      excerpt: "First para.",
      wordCount: 42,
      hasCode: true,
      tags: ["tech", "js"],
      readProgress: 55,
      readAt: "2026-06-04T00:00:00.000Z",
    }));
    const list = await store.list();
    expect(list[0].coverImage).toBe("https://img/cover.jpg");
    expect(list[0].excerpt).toBe("First para.");
    expect(list[0].wordCount).toBe(42);
    expect(list[0].hasCode).toBe(true);
    expect(list[0].tags).toEqual(["tech", "js"]);
    expect(list[0].readProgress).toBe(55);
    expect(list[0].readAt).toBe("2026-06-04T00:00:00.000Z");
  });

  it("list returns empty when nothing imported", async () => {
    expect(await store.list()).toEqual([]);
  });

  // ── findBySourceUrl ───────────────────────────────────────────────────────

  it("findBySourceUrl finds a matching capture or null", async () => {
    await store.insert(cap({ id: "a", sourceUrl: "https://x/one" }));
    expect((await store.findBySourceUrl("https://x/one"))?.id).toBe("a");
    expect(await store.findBySourceUrl("https://x/missing")).toBeNull();
  });

  // ── delete ────────────────────────────────────────────────────────────────

  it("delete removes the capture, get returns null", async () => {
    await store.insert(cap({ id: "del1" }));
    expect(await store.get("del1")).not.toBeNull();
    await store.delete("del1");
    expect(await store.get("del1")).toBeNull();
  });

  it("delete is a no-op for unknown ids", async () => {
    await expect(store.delete("ghost")).resolves.toBeUndefined();
  });

  // ── updateReadStatus ──────────────────────────────────────────────────────

  it("updateReadStatus sets readProgress", async () => {
    await store.insert(cap({ id: "r1" }));
    await store.updateReadStatus("r1", { readProgress: 42 });
    const updated = await store.get("r1");
    expect(updated?.readProgress).toBe(42);
    expect(updated?.readAt).toBeUndefined();
  });

  it("updateReadStatus sets readAt when provided", async () => {
    await store.insert(cap({ id: "r2" }));
    await store.updateReadStatus("r2", { readProgress: 100, readAt: "2026-06-04T10:00:00.000Z" });
    const updated = await store.get("r2");
    expect(updated?.readAt).toBe("2026-06-04T10:00:00.000Z");
  });

  it("updateReadStatus does not overwrite existing readAt", async () => {
    await store.insert(cap({ id: "r3", readAt: "2026-05-01T00:00:00.000Z" }));
    await store.updateReadStatus("r3", { readProgress: 100, readAt: "2026-06-04T10:00:00.000Z" });
    const updated = await store.get("r3");
    expect(updated?.readAt).toBe("2026-05-01T00:00:00.000Z");
  });

  it("updateReadStatus is a no-op for unknown ids", async () => {
    await expect(store.updateReadStatus("ghost", { readProgress: 50 })).resolves.toBeUndefined();
  });

  // ── updateTags ────────────────────────────────────────────────────────────

  it("updateTags replaces tags", async () => {
    await store.insert(cap({ id: "t1" }));
    await store.updateTags("t1", ["a", "b"]);
    expect((await store.get("t1"))?.tags).toEqual(["a", "b"]);
  });

  it("updateTags accepts empty array to clear tags", async () => {
    await store.insert(cap({ id: "t2", tags: ["x"] }));
    await store.updateTags("t2", []);
    expect((await store.get("t2"))?.tags).toEqual([]);
  });

  it("updateTags is a no-op for unknown ids", async () => {
    await expect(store.updateTags("ghost", ["a"])).resolves.toBeUndefined();
  });

  // ── recordVisit ───────────────────────────────────────────────────────────

  it("recordVisit sets lastOpenedAt and increments readCount", async () => {
    await store.insert(cap({ id: "v1" }));
    await store.recordVisit("v1", "2026-06-05T10:00:00.000Z");
    const updated = await store.get("v1");
    expect(updated?.lastOpenedAt).toBe("2026-06-05T10:00:00.000Z");
    expect(updated?.readCount).toBe(1);
  });

  it("recordVisit increments readCount on each call", async () => {
    await store.insert(cap({ id: "v2" }));
    await store.recordVisit("v2", "2026-06-05T10:00:00.000Z");
    await store.recordVisit("v2", "2026-06-05T11:00:00.000Z");
    expect((await store.get("v2"))?.readCount).toBe(2);
  });

  it("recordVisit is a no-op for unknown ids", async () => {
    await expect(store.recordVisit("ghost", "2026-06-05T10:00:00.000Z")).resolves.toBeUndefined();
  });
});
```

- [x] **Step 2: 运行测试确认 skip（无 DB）**

```bash
pnpm test -- --reporter=verbose 2>&1 | grep -E "(SKIP|skip|PostgresStore)"
```

预期：PostgresStore 测试整体被跳过（`describe.skipIf` 生效）

- [x] **Step 3: 实现 postgres-store.ts**

创建 `packages/adapters/src/postgres-store.ts`：

```typescript
import { PrismaClient } from "@prisma/client";
import type { Capture, CaptureSummary, Store } from "@amber/domain";

// Prisma 返回 DateTime 字段为 JS Date 对象，null 表示可选字段未设置
type SummaryRow = {
  id: string; title: string; sourceUrl: string; capturedAt: Date;
  publishedAt: string | null; coverImage: string | null; excerpt: string | null;
  wordCount: number | null; hasCode: boolean | null; tags: string[];
  readProgress: number | null; readAt: Date | null;
};

type FullRow = SummaryRow & {
  content: string; sourceType: string; author: string | null;
  lastOpenedAt: Date | null; readCount: number;
};

function rowToSummary(row: SummaryRow): CaptureSummary {
  return {
    id: row.id,
    title: row.title,
    sourceUrl: row.sourceUrl,
    capturedAt: row.capturedAt.toISOString(),
    publishedAt: row.publishedAt ?? undefined,
    coverImage: row.coverImage ?? undefined,
    excerpt: row.excerpt ?? undefined,
    wordCount: row.wordCount ?? undefined,
    hasCode: row.hasCode ?? undefined,
    tags: row.tags.length > 0 ? row.tags : undefined,
    readProgress: row.readProgress ?? undefined,
    readAt: row.readAt?.toISOString() ?? undefined,
  };
}

function rowToCapture(row: FullRow): Capture {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    sourceUrl: row.sourceUrl,
    sourceType: "url",
    author: row.author ?? undefined,
    capturedAt: row.capturedAt.toISOString(),
    publishedAt: row.publishedAt ?? undefined,
    coverImage: row.coverImage ?? undefined,
    excerpt: row.excerpt ?? undefined,
    wordCount: row.wordCount ?? undefined,
    hasCode: row.hasCode ?? undefined,
    tags: row.tags.length > 0 ? row.tags : undefined,
    readProgress: row.readProgress ?? undefined,
    readAt: row.readAt?.toISOString() ?? undefined,
    lastOpenedAt: row.lastOpenedAt?.toISOString() ?? undefined,
    readCount: row.readCount > 0 ? row.readCount : undefined,
  };
}

export class PostgresStore implements Store {
  private readonly prisma: PrismaClient;

  constructor(databaseUrl: string) {
    this.prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }

  /** 仅测试用：清空所有记录。 */
  async deleteAll(): Promise<void> {
    await this.prisma.capture.deleteMany();
  }

  async insert(capture: Capture): Promise<void> {
    await this.prisma.capture.create({
      data: {
        id: capture.id,
        title: capture.title,
        content: capture.content,
        sourceUrl: capture.sourceUrl,
        sourceType: capture.sourceType,
        author: capture.author ?? null,
        capturedAt: new Date(capture.capturedAt),
        publishedAt: capture.publishedAt ?? null,
        coverImage: capture.coverImage ?? null,
        excerpt: capture.excerpt ?? null,
        wordCount: capture.wordCount ?? null,
        hasCode: capture.hasCode ?? null,
        tags: capture.tags ?? [],
        readProgress: capture.readProgress ?? null,
        readAt: capture.readAt ? new Date(capture.readAt) : null,
        lastOpenedAt: capture.lastOpenedAt ? new Date(capture.lastOpenedAt) : null,
        readCount: capture.readCount ?? 0,
      },
    });
  }

  async list(): Promise<CaptureSummary[]> {
    const rows = await this.prisma.capture.findMany({
      orderBy: { capturedAt: "desc" },
      select: {
        id: true, title: true, sourceUrl: true, capturedAt: true,
        publishedAt: true, coverImage: true, excerpt: true, wordCount: true,
        hasCode: true, tags: true, readProgress: true, readAt: true,
      },
    });
    return rows.map((r) => rowToSummary(r as SummaryRow));
  }

  async get(id: string): Promise<Capture | null> {
    const row = await this.prisma.capture.findUnique({ where: { id } });
    return row ? rowToCapture(row as unknown as FullRow) : null;
  }

  async findBySourceUrl(url: string): Promise<Capture | null> {
    const row = await this.prisma.capture.findUnique({
      where: { sourceUrl: url },
    });
    return row ? rowToCapture(row as unknown as FullRow) : null;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.capture.delete({ where: { id } }).catch(() => {});
  }

  async updateReadStatus(
    id: string,
    status: { readProgress: number; readAt?: string }
  ): Promise<void> {
    const current = await this.prisma.capture.findUnique({
      where: { id },
      select: { readAt: true },
    });
    if (!current) return;
    await this.prisma.capture.update({
      where: { id },
      data: {
        readProgress: status.readProgress,
        ...(status.readAt && !current.readAt
          ? { readAt: new Date(status.readAt) }
          : {}),
      },
    });
  }

  async updateTags(id: string, tags: string[]): Promise<void> {
    await this.prisma.capture
      .update({ where: { id }, data: { tags } })
      .catch(() => {});
  }

  async recordVisit(id: string, visitedAt: string): Promise<void> {
    await this.prisma.capture
      .update({
        where: { id },
        data: {
          lastOpenedAt: new Date(visitedAt),
          readCount: { increment: 1 },
        },
      })
      .catch(() => {});
  }
}
```

- [x] **Step 4: 启动测试 Postgres 并运行集成测试**

```bash
# 若尚未启动：
docker compose -f packages/adapters/docker-compose.test.yml up -d
# 等待 Postgres 就绪（约 5 秒）
sleep 5
# 运行测试
TEST_DATABASE_URL=postgres://amber:amber@localhost:5433/amber_test pnpm test -- postgres-store
```

预期：PostgresStore 套件全部 PASS（约 18 个测试）

- [x] **Step 5: 确认无 TEST_DATABASE_URL 时普通测试不受影响**

```bash
pnpm test
```

预期：所有非 Postgres 测试 PASS，PostgresStore suite 被 skip（不计为失败）

- [x] **Step 6: 提交**

```bash
git add packages/adapters/src/postgres-store.ts packages/adapters/src/postgres-store.test.ts
git commit -m "feat(adapters): add PostgresStore implementing full Store interface"
```

---

## Task 3: R2BlobStore 实现

**Files:**
- Create: `packages/adapters/src/r2-blob-store.ts`
- Create: `packages/adapters/src/r2-blob-store.test.ts`

- [x] **Step 1: 编写测试文件**

创建 `packages/adapters/src/r2-blob-store.test.ts`：

```typescript
import { describe, expect, it, vi } from "vitest";
import type { S3Client } from "@aws-sdk/client-s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { R2BlobStore, createR2BlobStore } from "./r2-blob-store.js";

function makeMockClient() {
  const send = vi.fn().mockResolvedValue({});
  return { send } as unknown as S3Client;
}

describe("R2BlobStore", () => {
  it("put uploads to S3 and returns public URL", async () => {
    const client = makeMockClient();
    const store = new R2BlobStore(client, "my-bucket", "https://cdn.example.com");
    const data = new Uint8Array([1, 2, 3]);

    const url = await store.put("captures/c1/0.png", data, "image/png");

    expect(url).toBe("https://cdn.example.com/captures/c1/0.png");
    expect(client.send).toHaveBeenCalledOnce();
    const cmd: PutObjectCommand = (client.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(cmd.input).toEqual({
      Bucket: "my-bucket",
      Key: "captures/c1/0.png",
      Body: data,
      ContentType: "image/png",
    });
  });

  it("put strips trailing slash from publicBaseUrl", async () => {
    const client = makeMockClient();
    const store = new R2BlobStore(client, "bucket", "https://cdn.example.com/");
    const url = await store.put("file.png", new Uint8Array(), "image/png");
    expect(url).toBe("https://cdn.example.com/file.png");
  });

  it("put omits ContentType when not provided", async () => {
    const client = makeMockClient();
    const store = new R2BlobStore(client, "bucket", "https://cdn.example.com");
    await store.put("file.bin", new Uint8Array());
    const cmd: PutObjectCommand = (client.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(cmd.input.ContentType).toBeUndefined();
  });
});

describe("createR2BlobStore", () => {
  it("returns an R2BlobStore instance", () => {
    const store = createR2BlobStore({
      accountId: "acc123",
      accessKeyId: "key",
      secretAccessKey: "secret",
      bucket: "amber-blobs",
      publicBaseUrl: "https://cdn.example.com",
    });
    expect(store).toBeInstanceOf(R2BlobStore);
  });
});
```

- [x] **Step 2: 运行测试确认失败**

```bash
pnpm test -- r2-blob-store
```

预期：FAIL（r2-blob-store.ts 不存在）

- [x] **Step 3: 实现 r2-blob-store.ts**

创建 `packages/adapters/src/r2-blob-store.ts`：

```typescript
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { BlobStore } from "@amber/domain";

export class R2BlobStore implements BlobStore {
  private readonly base: string;

  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
    publicBaseUrl: string
  ) {
    this.base = publicBaseUrl.replace(/\/$/, "");
  }

  async put(key: string, data: Uint8Array, contentType?: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
      })
    );
    return `${this.base}/${key}`;
  }
}

export function createR2BlobStore(opts: {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
}): R2BlobStore {
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${opts.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: opts.accessKeyId,
      secretAccessKey: opts.secretAccessKey,
    },
  });
  return new R2BlobStore(client, opts.bucket, opts.publicBaseUrl);
}
```

- [x] **Step 4: 运行测试确认通过**

```bash
pnpm test -- r2-blob-store
```

预期：4 个测试全部 PASS

- [x] **Step 5: 提交**

```bash
git add packages/adapters/src/r2-blob-store.ts packages/adapters/src/r2-blob-store.test.ts
git commit -m "feat(adapters): add R2BlobStore for Cloudflare R2 object storage"
```

---

## Task 4: 导出新 Store 并更新 wiring.ts 自动切换

**Files:**
- Modify: `packages/adapters/src/index.ts`
- Modify: `packages/cli/src/wiring.ts`

- [x] **Step 1: 更新 adapters/src/index.ts**

将 `packages/adapters/src/index.ts` 改为：

```typescript
export { DinoSource, toRawCapture } from "./dino-source.js";
export { FileStore } from "./file-store.js";
export { FileBlobStore } from "./file-blob-store.js";
export { PostgresStore } from "./postgres-store.js";
export { R2BlobStore, createR2BlobStore } from "./r2-blob-store.js";
```

- [x] **Step 2: 更新 cli/src/wiring.ts 添加自动切换逻辑**

将 `packages/cli/src/wiring.ts` 改为：

```typescript
import { rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  DinoSource,
  FileBlobStore,
  FileStore,
  PostgresStore,
  createR2BlobStore,
} from "@amber/adapters";
import type { BlobStore, Store } from "@amber/domain";
import { ImportService, ReadService, captureAssetPrefix } from "@amber/core";

export function buildServices() {
  const dataDir = resolve(process.env.AMBER_DATA_DIR ?? "./amber-data");
  const source = new DinoSource();

  const store: Store = process.env.DATABASE_URL
    ? new PostgresStore(process.env.DATABASE_URL)
    : new FileStore(dataDir);

  const blob: BlobStore =
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET
      ? createR2BlobStore({
          accountId: process.env.R2_ACCOUNT_ID,
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
          bucket: process.env.R2_BUCKET,
          publicBaseUrl: process.env.R2_PUBLIC_BASE_URL ?? "",
        })
      : new FileBlobStore(dataDir);

  const blobsDir = join(dataDir, "blobs");

  async function deleteCapture(id: string): Promise<void> {
    await store.delete(id);
    // 本地 blob 文件也始终尝试清理（R2 模式下目录不存在，rm 不报错）
    await rm(join(blobsDir, captureAssetPrefix(id)), {
      recursive: true,
      force: true,
    });
  }

  return {
    dataDir,
    blobsDir,
    importService: new ImportService(source, store, blob),
    readService: new ReadService(store),
    deleteCapture,
  };
}
```

- [x] **Step 3: 运行全量测试验证无回归**

```bash
pnpm test
```

预期：全部现有测试 PASS

- [x] **Step 4: TypeScript 类型检查**

```bash
pnpm typecheck
```

预期：无类型错误

- [x] **Step 5: 提交**

```bash
git add packages/adapters/src/index.ts packages/cli/src/wiring.ts
git commit -m "feat(cli): auto-switch to PostgresStore and R2BlobStore via environment variables"
```

---

## Task 5: amber migrate 命令

**Files:**
- Create: `packages/cli/src/commands/migrate.ts`
- Modify: `packages/cli/src/main.ts`

- [x] **Step 1: 创建 migrate.ts**

创建 `packages/cli/src/commands/migrate.ts`：

```typescript
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
    if (args.dryRun) {
      console.log("（dry-run 模式，不写入数据库）");
    }

    const store = new PostgresStore(dbUrl);
    let migrated = 0;
    let skipped = 0;

    for (const file of jsonFiles) {
      const text = await readFile(join(capturesDir, file), "utf8");
      const capture: Capture = JSON.parse(text);

      if (!args.dryRun) {
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

    if (args.dryRun) {
      console.log(`\n共 ${migrated} 条将被迁移。`);
    } else {
      console.log(`\n完成：迁移 ${migrated} 条，跳过 ${skipped} 条（已存在）。`);
    }
  },
});
```

- [x] **Step 2: 注册到 main.ts**

将 `packages/cli/src/main.ts` 改为：

```typescript
#!/usr/bin/env -S node --import tsx
import { defineCommand, runMain } from "citty";
import { importCommand } from "./commands/import.js";
import { listCommand } from "./commands/list.js";
import { webCommand } from "./commands/web.js";
import { deleteCommand } from "./commands/delete.js";
import { reimportCommand } from "./commands/reimport.js";
import { migrateCommand } from "./commands/migrate.js";

const main = defineCommand({
  meta: { name: "amber", description: "Personal Knowledge Pipeline" },
  subCommands: {
    import: importCommand,
    list: listCommand,
    web: webCommand,
    delete: deleteCommand,
    reimport: reimportCommand,
    migrate: migrateCommand,
  },
});

runMain(main);
```

- [x] **Step 3: 验证命令帮助输出**

```bash
pnpm amber migrate --help
```

预期输出包含：
```
从文件存储迁移 Capture 数据到 PostgreSQL
```
以及 `--dataDir` 和 `--dryRun` 参数说明。

- [x] **Step 4: 类型检查**

```bash
pnpm typecheck
```

预期：无类型错误

- [x] **Step 5: 运行全量测试**

```bash
pnpm test
```

预期：全部 PASS

- [x] **Step 6: 提交**

```bash
git add packages/cli/src/commands/migrate.ts packages/cli/src/main.ts
git commit -m "feat(cli): add amber migrate command for FileStore to Postgres migration"
```

---

## Task 6: .env.example 环境变量文档

**Files:**
- Create: `.env.example`

- [x] **Step 1: 创建 .env.example**

在项目根目录创建 `.env.example`：

```bash
# ─── 数据目录（文件存储模式）──────────────────────────────────────────────
# Amber 数据存储根目录（捕获记录 JSON + 本地 blob 文件）
# 默认值：./amber-data
# AMBER_DATA_DIR=./amber-data

# ─── PostgreSQL（可选，设置后替代文件存储）────────────────────────────────
# 设置此变量后，Capture 数据将写入 Postgres，否则使用本地 JSON 文件
# 迁移：运行 npx prisma migrate deploy（或 prisma db push）初始化 schema
# DATABASE_URL=postgres://user:password@localhost:5432/amber

# ─── Cloudflare R2（可选，设置后替代本地 blob 存储）──────────────────────
# 四项 R2 变量同时设置时启用 R2BlobStore，否则使用本地文件
# R2_ACCOUNT_ID=your_cloudflare_account_id
# R2_ACCESS_KEY_ID=your_r2_access_key_id
# R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
# R2_BUCKET=amber-blobs
# R2_PUBLIC_BASE_URL=https://your-r2-public-domain.com

# ─── Web 服务端口（可选）─────────────────────────────────────────────────
# 默认值：3000
# PORT=3000

# ─── 集成测试用 Postgres（开发者本地测试）────────────────────────────────
# 启动：docker compose -f packages/adapters/docker-compose.test.yml up -d
# TEST_DATABASE_URL=postgres://amber:amber@localhost:5433/amber_test
```

- [x] **Step 2: 提交**

```bash
git add .env.example
git commit -m "docs: add .env.example documenting all environment variables"
```

---

## 完成后验证清单

运行以下命令，确认整个实现端到端工作：

```bash
# 1. 全量单元测试（不需要 DB）
pnpm test

# 2. 全量类型检查
pnpm typecheck

# 3. 有 Postgres 的集成测试
docker compose -f packages/adapters/docker-compose.test.yml up -d
TEST_DATABASE_URL=postgres://amber:amber@localhost:5433/amber_test pnpm test -- postgres-store

# 4. 验证 CLI 命令列表
pnpm amber --help  # 应包含 migrate
pnpm amber migrate --help
```
