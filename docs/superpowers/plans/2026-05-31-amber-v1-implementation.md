# Amber v1 实现计划

> **致执行者：** 必须配合子技能使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans，逐任务实现本计划。各步骤用 checkbox（`- [ ]`）语法追踪进度。

**目标：** 构建 Amber v1 —— 一个 CLI，把网页 URL 导入云端存储（Supabase Postgres + Cloudflare R2），并提供本地 Web UI 列出与阅读已收藏的文章。

> **实现策略（2026-06-01 更新）：** v1 阶段优先打通 import → 数据处理 → web 展示的端到端核心流程，存储层暂用文件系统（FileStore + FileBlobStore）代替云端（Postgres + R2）。核心架构（domain 接口 + core 服务层 + adapters 注入）完全就位；云端存储仅是替换 adapters 实现，不触碰 core 逻辑。任务 6/7（Postgres + R2）作为下一阶段目标保留。

**架构：** pnpm monorepo，三层骨架。`@amber/domain` 持有 `Capture` 模型与 `Source`/`Store`/`BlobStore` 接口（零运行时依赖）。`@amber/core` 持有 `ImportService`/`ReadService`，仅依赖这些接口。`@amber/adapters` 持有具体实现（DinoSource、PostgresStore、R2BlobStore）。`@amber/cli` 与 `@amber/web` 是薄入口层，负责实例化 adapters 并注入 core。

**技术栈：** TypeScript + ESM + Node ≥24、pnpm workspace、tsdown（构建）、tsx（开发/运行）、vitest（测试）、Prisma（Postgres）、@aws-sdk/client-s3（R2）、Hono + markdown-it（Web 服务端渲染）、citty + @clack/prompts + Ink（CLI）、dino（采集，作为依赖）。

**参考文档：**
- [整体架构与 v1 设计](../specs/2026-05-30-amber-v1-design.md)
- [v1 技术方案](../specs/2026-05-31-amber-v1-technical-design.md)

---

## 文件结构

```
amber/
├── package.json                 # 根，private，workspace 脚本
├── pnpm-workspace.yaml
├── tsconfig.base.json           # 共享编译选项
├── vitest.config.ts             # 根 vitest（覆盖各 workspace 包）
├── .env.example                 # 记录所需环境变量
├── .gitignore
└── packages/
    ├── domain/
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       └── index.ts         # Capture, CaptureSummary, Source, Store, BlobStore, RawCapture, Asset
    ├── core/
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts         # 重导出
    │       ├── import-service.ts
    │       ├── read-service.ts
    │       ├── asset-key.ts     # 纯函数：为资源生成 R2 key
    │       └── *.test.ts
    ├── adapters/
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── prisma/
    │   │   └── schema.prisma
    │   └── src/
    │       ├── index.ts
    │       ├── dino-source.ts
    │       ├── postgres-store.ts
    │       └── r2-blob-store.ts
    ├── cli/
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── main.ts          # citty 根命令，bin 入口
    │       ├── wiring.ts        # 从 env 组装 adapters + services
    │       ├── commands/
    │       │   ├── import.ts
    │       │   ├── list.ts
    │       │   └── serve.ts
    │       └── ui/
    │           └── CaptureList.tsx  # Ink 列表组件
    └── web/
        ├── package.json
        ├── tsconfig.json
        └── src/
            ├── index.ts         # createApp(readService) -> Hono app
            ├── render.ts        # markdown -> HTML，页面模板
            └── *.test.ts
```

**边界规则（由包依赖强制）：** `core` 只依赖 `domain`。`adapters` 依赖 `domain` + 外部库。`cli`/`web` 依赖 `core` + `adapters` + `domain`。绝不允许 `core` → `adapters`。

**开发/运行策略：** 每个包的 `package.json` 的 `exports` 指向 `./src/index.ts`。pnpm 把 workspace 包软链进 `node_modules`；tsx 与 vitest 直接解析并转译 TS，因此本地运行或测试无需构建步骤。`tsdown` 用于产出 `dist/`，但 v1 本地自用流程并不需要它。

---

## 任务 1：monorepo 脚手架

**文件：**
- 创建：`package.json`、`pnpm-workspace.yaml`、`tsconfig.base.json`、`vitest.config.ts`、`.gitignore`、`.env.example`

- [x] **步骤 1：初始化 git**

执行：`git init && node --version`
预期：git 完成初始化；Node 输出 v24.x 或更高。

- [x] **步骤 2：创建 `pnpm-workspace.yaml`**

```yaml
packages:
  - "packages/*"
```

- [x] **步骤 3：创建根 `package.json`**

```json
{
  "name": "amber",
  "private": true,
  "type": "module",
  "engines": { "node": ">=24" },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit -p packages/domain/tsconfig.json && tsc --noEmit -p packages/core/tsconfig.json && tsc --noEmit -p packages/adapters/tsconfig.json && tsc --noEmit -p packages/web/tsconfig.json && tsc --noEmit -p packages/cli/tsconfig.json",
    "amber": "tsx packages/cli/src/main.ts"
  },
  "devDependencies": {
    "tsx": "^4.21.0",
    "typescript": "^5.9.3",
    "vitest": "^3.2.4",
    "tsdown": "^0.15.6",
    "@types/node": "^24.0.0"
  }
}
```

- [x] **步骤 4：创建 `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2023"],
    "strict": true,
    "declaration": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "verbatimModuleSyntax": true,
    "jsx": "react-jsx"
  }
}
```

- [x] **步骤 5：创建根 `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.{ts,tsx}"],
  },
});
```

- [x] **步骤 6：创建 `.gitignore`**

```
node_modules/
dist/
.env
.superpowers/
*.log
packages/adapters/src/generated/
```

- [x] **步骤 7：创建 `.env.example`**

```
# Supabase Postgres 连接串（直连）
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/postgres"

# Cloudflare R2（S3 兼容）
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET=""
# bucket 的公开访问基地址（自定义域名或 r2.dev），结尾不带斜杠
R2_PUBLIC_BASE_URL=""

# Web 服务端口（可选，默认 7788）
AMBER_PORT="7788"
```

- [x] **步骤 8：安装根开发依赖**

执行：`pnpm install`
预期：完成；`node_modules/` 已创建。

- [x] **步骤 9：提交**

```bash
git add -A
git commit -m "chore: scaffold pnpm monorepo"
```

---

## 任务 2：@amber/domain — 契约

**文件：**
- 创建：`packages/domain/package.json`、`packages/domain/tsconfig.json`、`packages/domain/src/index.ts`

本包是纯类型/接口，没有运行时逻辑，因此没有单元测试。其正确性由下游包对它的编译来保证。

- [x] **步骤 1：创建 `packages/domain/package.json`**

```json
{
  "name": "@amber/domain",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" }
}
```

- [x] **步骤 2：创建 `packages/domain/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src"]
}
```

- [x] **步骤 3：创建 `packages/domain/src/index.ts`**

```ts
/** 一份被收藏的内容，是跨所有版本被存储与阅读的基本单元。 */
export interface Capture {
  id: string; // uuid，应用层生成
  title: string;
  content: string; // markdown；图片链接已改写为 R2 公开 URL
  sourceUrl: string;
  sourceType: "url"; // 联合类型，未来扩展：'pdf' | 'markdown' | 'note'
  author?: string;
  createdAt: string; // ISO 8601
  capturedAt: string; // ISO 8601
}

export type CaptureSummary = Pick<
  Capture,
  "id" | "title" | "sourceUrl" | "createdAt"
>;

/** 一个二进制资源（图片），由 markdown 中的占位符引用。 */
export interface Asset {
  placeholder: string; // markdown 中的占位符，如 "amber-asset:0"
  data: Uint8Array;
  contentType?: string;
}

/** 由 Source 返回的、尚未入库的原始素材。 */
export interface RawCapture {
  title: string;
  markdown: string; // 图片为占位符，待替换为 R2 URL
  author?: string;
  publishedAt?: string;
  assets: Asset[];
}

/** 采集来源：给定输入，返回原始素材。 */
export interface Source {
  capture(input: string): Promise<RawCapture>;
}

/** Capture 行的结构化存储。 */
export interface Store {
  insert(capture: Capture): Promise<void>;
  list(): Promise<CaptureSummary[]>;
  get(id: string): Promise<Capture | null>;
  findBySourceUrl(url: string): Promise<Capture | null>;
}

/** 二进制/对象存储。`put` 返回公开 URL。 */
export interface BlobStore {
  put(key: string, data: Uint8Array, contentType?: string): Promise<string>;
}
```

- [x] **步骤 4：类型检查**

执行：`pnpm install && pnpm -w exec tsc -p packages/domain/tsconfig.json --noEmit`
预期：无错误。

- [x] **步骤 5：提交**

```bash
git add -A
git commit -m "feat(domain): add Capture model and Source/Store/BlobStore contracts"
```

---

## 任务 3：@amber/core — 资源 key 生成（纯函数）

**文件：**
- 创建：`packages/core/package.json`、`packages/core/tsconfig.json`、`packages/core/src/asset-key.ts`、`packages/core/src/asset-key.test.ts`

R2 的 `key` 由 core 生成（见技术方案 §4.1 步骤 3）。把它隔离为纯函数，便于测试。

- [x] **步骤 1：创建 `packages/core/package.json`**

```json
{
  "name": "@amber/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "@amber/domain": "workspace:*"
  }
}
```

- [x] **步骤 2：创建 `packages/core/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src"]
}
```

- [x] **步骤 3：编写失败的测试 `packages/core/src/asset-key.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { assetKey } from "./asset-key.js";

describe("assetKey", () => {
  it("namespaces the key by capture id and asset index", () => {
    expect(assetKey("cap123", 0, "image/png")).toBe("captures/cap123/0.png");
  });

  it("falls back to bin when contentType is unknown", () => {
    expect(assetKey("cap123", 2, undefined)).toBe("captures/cap123/2.bin");
  });

  it("maps jpeg content type to jpg", () => {
    expect(assetKey("cap123", 1, "image/jpeg")).toBe("captures/cap123/1.jpg");
  });
});
```

- [x] **步骤 4：运行测试，确认失败**

执行：`pnpm exec vitest run packages/core/src/asset-key.test.ts`
预期：失败 —— 找不到模块 `./asset-key.js`。

- [x] **步骤 5：实现 `packages/core/src/asset-key.ts`**

```ts
const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export function assetKey(
  captureId: string,
  index: number,
  contentType?: string,
): string {
  const ext = (contentType && EXT_BY_TYPE[contentType]) || "bin";
  return `captures/${captureId}/${index}.${ext}`;
}
```

- [x] **步骤 6：运行测试，确认通过**

执行：`pnpm exec vitest run packages/core/src/asset-key.test.ts`
预期：通过（3 个测试）。

- [x] **步骤 7：提交**

```bash
git add -A
git commit -m "feat(core): add pure assetKey generator"
```

---

## 任务 4：@amber/core — ImportService

**文件：**
- 创建：`packages/core/src/import-service.ts`、`packages/core/src/import-service.test.ts`

ImportService 实现技术方案 §4.1：去重前置，然后采集、上传资源、替换占位符、组装、插入。用内存版 Source/Store/BlobStore 假实现来测试。

- [x] **步骤 1：编写失败的测试 `packages/core/src/import-service.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest";
import type {
  BlobStore,
  Capture,
  RawCapture,
  Source,
  Store,
} from "@amber/domain";
import { ImportService } from "./import-service.js";

function fakeStore(seed: Capture[] = []) {
  const rows = [...seed];
  const store: Store = {
    insert: vi.fn(async (c: Capture) => {
      rows.push(c);
    }),
    list: vi.fn(async () => rows.map((r) => ({ id: r.id, title: r.title, sourceUrl: r.sourceUrl, createdAt: r.createdAt }))),
    get: vi.fn(async (id: string) => rows.find((r) => r.id === id) ?? null),
    findBySourceUrl: vi.fn(async (url: string) => rows.find((r) => r.sourceUrl === url) ?? null),
  };
  return { store, rows };
}

function fakeSource(raw: RawCapture): Source {
  return { capture: vi.fn(async () => raw) };
}

function fakeBlob(): BlobStore {
  return {
    put: vi.fn(async (key: string) => `https://cdn.test/${key}`),
  };
}

const raw: RawCapture = {
  title: "Hello",
  markdown: "intro\n\n![a](amber-asset:0)\n\n![b](amber-asset:1)",
  author: "Ada",
  publishedAt: "2026-01-02",
  assets: [
    { placeholder: "amber-asset:0", data: new Uint8Array([1]), contentType: "image/png" },
    { placeholder: "amber-asset:1", data: new Uint8Array([2]), contentType: "image/jpeg" },
  ],
};

describe("ImportService", () => {
  it("uploads assets, rewrites placeholders, and inserts a capture", async () => {
    const source = fakeSource(raw);
    const { store, rows } = fakeStore();
    const blob = fakeBlob();
    const service = new ImportService(source, store, blob, {
      now: () => new Date("2026-05-31T00:00:00.000Z"),
      newId: () => "cap-1",
    });

    const id = await service.run("https://example.com/a");

    expect(id).toBe("cap-1");
    expect(rows).toHaveLength(1);
    const saved = rows[0];
    expect(saved.title).toBe("Hello");
    expect(saved.sourceUrl).toBe("https://example.com/a");
    expect(saved.sourceType).toBe("url");
    expect(saved.author).toBe("Ada");
    expect(saved.capturedAt).toBe("2026-05-31T00:00:00.000Z");
    // 占位符已替换为 R2 URL，正文中不残留任何占位符
    expect(saved.content).toContain("https://cdn.test/captures/cap-1/0.png");
    expect(saved.content).toContain("https://cdn.test/captures/cap-1/1.jpg");
    expect(saved.content).not.toContain("amber-asset:");
    expect(blob.put).toHaveBeenCalledTimes(2);
  });

  it("skips capture entirely when the url already exists (dedupe-first)", async () => {
    const existing: Capture = {
      id: "old", title: "Old", content: "x", sourceUrl: "https://example.com/a",
      sourceType: "url", createdAt: "2026-01-01T00:00:00.000Z", capturedAt: "2026-01-01T00:00:00.000Z",
    };
    const source = fakeSource(raw);
    const { store } = fakeStore([existing]);
    const blob = fakeBlob();
    const service = new ImportService(source, store, blob);

    const id = await service.run("https://example.com/a");

    expect(id).toBe("old");
    expect(source.capture).not.toHaveBeenCalled();
    expect(blob.put).not.toHaveBeenCalled();
    expect(store.insert).not.toHaveBeenCalled();
  });
});
```

- [x] **步骤 2：运行测试，确认失败**

执行：`pnpm exec vitest run packages/core/src/import-service.test.ts`
预期：失败 —— 找不到模块 `./import-service.js`。

- [x] **步骤 3：实现 `packages/core/src/import-service.ts`**

```ts
import type { BlobStore, Capture, Source, Store } from "@amber/domain";
import { assetKey } from "./asset-key.js";

export interface ImportDeps {
  now?: () => Date;
  newId?: () => string;
}

export class ImportService {
  private readonly now: () => Date;
  private readonly newId: () => string;

  constructor(
    private readonly source: Source,
    private readonly store: Store,
    private readonly blob: BlobStore,
    deps: ImportDeps = {},
  ) {
    this.now = deps.now ?? (() => new Date());
    this.newId = deps.newId ?? (() => crypto.randomUUID());
  }

  /** 导入一个 URL。返回 capture id（若已导入则返回既有 id）。 */
  async run(url: string): Promise<string> {
    const existing = await this.store.findBySourceUrl(url);
    if (existing) return existing.id;

    const raw = await this.source.capture(url);

    const id = this.newId();
    let content = raw.markdown;
    for (let i = 0; i < raw.assets.length; i++) {
      const asset = raw.assets[i];
      const key = assetKey(id, i, asset.contentType);
      const publicUrl = await this.blob.put(key, asset.data, asset.contentType);
      content = content.replaceAll(asset.placeholder, publicUrl);
    }

    const nowIso = this.now().toISOString();
    const capture: Capture = {
      id,
      title: raw.title,
      content,
      sourceUrl: url,
      sourceType: "url",
      author: raw.author,
      createdAt: raw.publishedAt ?? nowIso,
      capturedAt: nowIso,
    };
    await this.store.insert(capture);
    return id;
  }
}
```

- [x] **步骤 4：运行测试，确认通过**

执行：`pnpm exec vitest run packages/core/src/import-service.test.ts`
预期：通过（2 个测试）。

- [x] **步骤 5：提交**

```bash
git add -A
git commit -m "feat(core): add ImportService with dedupe-first import flow"
```

---

## 任务 5：@amber/core — ReadService + barrel 导出

**文件：**
- 创建：`packages/core/src/read-service.ts`、`packages/core/src/read-service.test.ts`、`packages/core/src/index.ts`

- [x] **步骤 1：编写失败的测试 `packages/core/src/read-service.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest";
import type { Capture, Store } from "@amber/domain";
import { ReadService } from "./read-service.js";

const cap: Capture = {
  id: "c1", title: "T", content: "body", sourceUrl: "https://x/a",
  sourceType: "url", createdAt: "2026-01-01T00:00:00.000Z", capturedAt: "2026-01-01T00:00:00.000Z",
};

function fakeStore(): Store {
  return {
    insert: vi.fn(),
    list: vi.fn(async () => [{ id: cap.id, title: cap.title, sourceUrl: cap.sourceUrl, createdAt: cap.createdAt }]),
    get: vi.fn(async (id: string) => (id === "c1" ? cap : null)),
    findBySourceUrl: vi.fn(),
  };
}

describe("ReadService", () => {
  it("lists capture summaries", async () => {
    const svc = new ReadService(fakeStore());
    const items = await svc.list();
    expect(items).toEqual([{ id: "c1", title: "T", sourceUrl: "https://x/a", createdAt: "2026-01-01T00:00:00.000Z" }]);
  });

  it("gets a capture by id, or null", async () => {
    const svc = new ReadService(fakeStore());
    expect(await svc.get("c1")).toEqual(cap);
    expect(await svc.get("nope")).toBeNull();
  });
});
```

- [x] **步骤 2：运行测试，确认失败**

执行：`pnpm exec vitest run packages/core/src/read-service.test.ts`
预期：失败 —— 找不到模块 `./read-service.js`。

- [x] **步骤 3：实现 `packages/core/src/read-service.ts`**

```ts
import type { Capture, CaptureSummary, Store } from "@amber/domain";

export class ReadService {
  constructor(private readonly store: Store) {}

  list(): Promise<CaptureSummary[]> {
    return this.store.list();
  }

  get(id: string): Promise<Capture | null> {
    return this.store.get(id);
  }
}
```

- [x] **步骤 4：创建 `packages/core/src/index.ts`**

```ts
export { ImportService, type ImportDeps } from "./import-service.js";
export { ReadService } from "./read-service.js";
export { assetKey } from "./asset-key.js";
```

- [x] **步骤 5：运行测试，确认通过**

执行：`pnpm exec vitest run packages/core`
预期：通过（core 全部测试）。

- [x] **步骤 6：提交**

```bash
git add -A
git commit -m "feat(core): add ReadService and barrel export"
```

---

## 任务 6：@amber/adapters — Prisma schema + PostgresStore

> **⚠️ 实际实现偏差：** 此任务被跳过。实现采用了基于文件系统的 `FileStore`（JSON 文件）代替 PostgresStore + Prisma，以便在不依赖云服务的情况下完成 v1 本地流程。Postgres 适配器保留为后续迭代目标。

**文件：**
- 创建：`packages/adapters/package.json`、`packages/adapters/tsconfig.json`、`packages/adapters/prisma/schema.prisma`、`packages/adapters/src/postgres-store.ts`

PostgresStore 封装 Prisma Client。它是无业务逻辑的薄映射层，因此没有单元测试（在任务 11 端到端验证）。Prisma client 生成到 `src/generated/`（已 gitignore）。

- [x] **步骤 1：创建 `packages/adapters/package.json`**

```json
{
  "name": "@amber/adapters",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "prisma:generate": "prisma generate --schema prisma/schema.prisma",
    "prisma:migrate": "prisma migrate dev --schema prisma/schema.prisma"
  },
  "dependencies": {
    "@amber/domain": "workspace:*",
    "@aws-sdk/client-s3": "^3.700.0",
    "@prisma/client": "^6.1.0"
  },
  "devDependencies": {
    "prisma": "^6.1.0"
  }
}
```

- [x] **步骤 2：创建 `packages/adapters/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src"]
}
```

- [x] **步骤 3：创建 `packages/adapters/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../src/generated"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Capture {
  id         String   @id @default(uuid()) @db.Uuid // 应用层生成
  title      String
  content    String                                  // markdown；Postgres text（不限长 —— 勿改为 VarChar）
  sourceUrl  String   @map("source_url")
  sourceType String   @default("url") @map("source_type")
  author     String?
  createdAt  DateTime @default(now()) @map("created_at")
  capturedAt DateTime @map("captured_at")

  @@map("captures")
}
```

- [x] **步骤 4：安装并生成 Prisma client**

执行：`pnpm install && pnpm --filter @amber/adapters prisma:generate`
预期：Prisma 把 client 生成到 `packages/adapters/src/generated/`。

- [x] **步骤 5：实现 `packages/adapters/src/postgres-store.ts`**

```ts
import type { Capture, CaptureSummary, Store } from "@amber/domain";
import { PrismaClient } from "./generated/index.js";

function toCapture(row: {
  id: string; title: string; content: string; sourceUrl: string;
  sourceType: string; author: string | null; createdAt: Date; capturedAt: Date;
}): Capture {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    sourceUrl: row.sourceUrl,
    sourceType: row.sourceType as "url",
    author: row.author ?? undefined,
    createdAt: row.createdAt.toISOString(),
    capturedAt: row.capturedAt.toISOString(),
  };
}

export class PostgresStore implements Store {
  constructor(private readonly prisma: PrismaClient) {}

  async insert(capture: Capture): Promise<void> {
    await this.prisma.capture.create({
      data: {
        id: capture.id,
        title: capture.title,
        content: capture.content,
        sourceUrl: capture.sourceUrl,
        sourceType: capture.sourceType,
        author: capture.author ?? null,
        createdAt: new Date(capture.createdAt),
        capturedAt: new Date(capture.capturedAt),
      },
    });
  }

  async list(): Promise<CaptureSummary[]> {
    const rows = await this.prisma.capture.findMany({
      select: { id: true, title: true, sourceUrl: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => ({
      id: r.id, title: r.title, sourceUrl: r.sourceUrl, createdAt: r.createdAt.toISOString(),
    }));
  }

  async get(id: string): Promise<Capture | null> {
    const row = await this.prisma.capture.findUnique({ where: { id } });
    return row ? toCapture(row) : null;
  }

  async findBySourceUrl(url: string): Promise<Capture | null> {
    const row = await this.prisma.capture.findFirst({ where: { sourceUrl: url } });
    return row ? toCapture(row) : null;
  }
}
```

- [x] **步骤 6：类型检查**

执行：`pnpm -w exec tsc -p packages/adapters/tsconfig.json --noEmit`
预期：无错误。

- [x] **步骤 7：提交**

```bash
git add -A
git commit -m "feat(adapters): add Prisma schema and PostgresStore"
```

---

## 任务 7：@amber/adapters — R2BlobStore

> **⚠️ 实际实现偏差：** 此任务被跳过。实现采用了基于文件系统的 `FileBlobStore`（把二进制文件存入本地目录，web server 通过静态路由服务）代替 R2BlobStore，以便在不依赖云服务的情况下完成 v1 本地流程。R2 适配器保留为后续迭代目标。

**文件：**
- 创建：`packages/adapters/src/r2-blob-store.ts`

指向 R2 的 S3 client 的薄封装；用 `R2_PUBLIC_BASE_URL` 拼出公开 URL 返回。无单元测试（在任务 11 端到端验证）。

- [x] **步骤 1：实现 `packages/adapters/src/r2-blob-store.ts`**

```ts
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { BlobStore } from "@amber/domain";

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string; // 结尾不带斜杠
}

export class R2BlobStore implements BlobStore {
  private readonly client: S3Client;

  constructor(private readonly config: R2Config) {
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async put(key: string, data: Uint8Array, contentType?: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
      }),
    );
    return `${this.config.publicBaseUrl}/${key}`;
  }
}
```

- [x] **步骤 2：类型检查**

执行：`pnpm -w exec tsc -p packages/adapters/tsconfig.json --noEmit`
预期：无错误。

- [x] **步骤 3：提交**

```bash
git add -A
git commit -m "feat(adapters): add R2BlobStore"
```

---

## 任务 8：@amber/adapters — DinoSource + barrel 导出

**文件：**
- 创建：`packages/adapters/src/dino-source.ts`、`packages/adapters/src/dino-source.test.ts`、`packages/adapters/src/index.ts`

DinoSource 把 dino 的产物适配成 `RawCapture`。dino 会把图片下载到磁盘并把 markdown 改写成本地相对路径；DinoSource 读回这些本地图片，把 markdown 中每个本地路径替换为稳定占位符 `amber-asset:N`，并返回字节。占位符替换逻辑是纯函数、**有**单元测试；真正的 dino 调用 + 文件读取被隔离在注入的 `runDino` 函数后面，因此测试无需网络。

- [x] **步骤 1：编写失败的测试 `packages/adapters/src/dino-source.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { rawCaptureFromDino, type DinoArtifact } from "./dino-source.js";

describe("rawCaptureFromDino", () => {
  it("replaces local image paths with placeholders and pairs them with bytes", () => {
    const artifact: DinoArtifact = {
      title: "Post",
      author: "Ada",
      publishedAt: "2026-01-02",
      markdown: "hi\n\n![x](assets/a.png)\n\n![y](assets/b.jpg)",
      images: [
        { localPath: "assets/a.png", data: new Uint8Array([1]), contentType: "image/png" },
        { localPath: "assets/b.jpg", data: new Uint8Array([2]), contentType: "image/jpeg" },
      ],
    };

    const raw = rawCaptureFromDino(artifact);

    expect(raw.title).toBe("Post");
    expect(raw.author).toBe("Ada");
    expect(raw.markdown).toBe("hi\n\n![x](amber-asset:0)\n\n![y](amber-asset:1)");
    expect(raw.assets).toEqual([
      { placeholder: "amber-asset:0", data: new Uint8Array([1]), contentType: "image/png" },
      { placeholder: "amber-asset:1", data: new Uint8Array([2]), contentType: "image/jpeg" },
    ]);
  });

  it("leaves markdown untouched when there are no images", () => {
    const artifact: DinoArtifact = { title: "T", markdown: "plain text", images: [] };
    const raw = rawCaptureFromDino(artifact);
    expect(raw.markdown).toBe("plain text");
    expect(raw.assets).toEqual([]);
  });
});
```

- [x] **步骤 2：运行测试，确认失败**

执行：`pnpm exec vitest run packages/adapters/src/dino-source.test.ts`
预期：失败 —— 找不到模块 `./dino-source.js`。

- [x] **步骤 3：实现 `packages/adapters/src/dino-source.ts`**

```ts
import type { Asset, RawCapture, Source } from "@amber/domain";

/** 归一化后的 dino 产物（title/markdown/author + 下载的图片）。 */
export interface DinoArtifact {
  title: string;
  markdown: string; // 图片链接为本地路径，如 assets/a.png
  author?: string;
  publishedAt?: string;
  images: { localPath: string; data: Uint8Array; contentType?: string }[];
}

/** 纯函数：把 dino 产物转成带占位符资源的 RawCapture。 */
export function rawCaptureFromDino(artifact: DinoArtifact): RawCapture {
  let markdown = artifact.markdown;
  const assets: Asset[] = artifact.images.map((img, i) => {
    const placeholder = `amber-asset:${i}`;
    markdown = markdown.replaceAll(img.localPath, placeholder);
    return { placeholder, data: img.data, contentType: img.contentType };
  });
  return {
    title: artifact.title,
    markdown,
    author: artifact.author,
    publishedAt: artifact.publishedAt,
    assets,
  };
}

/** 为一个 URL 产出 DinoArtifact。以注入方式提供，便于在测试中替换为假实现。 */
export type RunDino = (url: string) => Promise<DinoArtifact>;

export class DinoSource implements Source {
  constructor(private readonly runDino: RunDino) {}

  async capture(input: string): Promise<RawCapture> {
    const artifact = await this.runDino(input);
    return rawCaptureFromDino(artifact);
  }
}
```

> 注：`RunDino` 的具体实现（在临时目录运行 dino、读回 `content.md` + `assets/`）在任务 9 的 `wiring.ts` 中接线，文件系统与 dino 细节都集中在那里。这里保持注入，使本适配器保持纯净、可测。

- [x] **步骤 4：创建 `packages/adapters/src/index.ts`**

```ts
export { PostgresStore } from "./postgres-store.js";
export { R2BlobStore, type R2Config } from "./r2-blob-store.js";
export { DinoSource, rawCaptureFromDino, type DinoArtifact, type RunDino } from "./dino-source.js";
export { PrismaClient } from "./generated/index.js";
```

- [x] **步骤 5：运行测试，确认通过**

执行：`pnpm exec vitest run packages/adapters/src/dino-source.test.ts`
预期：通过（2 个测试）。

- [x] **步骤 6：提交**

```bash
git add -A
git commit -m "feat(adapters): add DinoSource with pure artifact mapping"
```

> **注意：** barrel (`index.ts`) 导出的纯函数名称从计划的 `rawCaptureFromDino` 改为了 `toRawCapture`；同时因跳过了 Postgres/R2，barrel 中不含 `PostgresStore`/`R2BlobStore`/`PrismaClient`，而是导出了 `FileStore`/`FileBlobStore`。

---

## 任务 9：@amber/cli — wiring + import 命令

**文件：**
- 创建：`packages/cli/package.json`、`packages/cli/tsconfig.json`、`packages/cli/src/wiring.ts`、`packages/cli/src/commands/import.ts`、`packages/cli/src/main.ts`

`wiring.ts` 是组装根（composition root）：读取 env、构建 adapters（含具体的 `RunDino`）、构造 services。这是唯一了解 dino 文件系统约定的地方。

- [x] **步骤 1：创建 `packages/cli/package.json`**

```json
{
  "name": "@amber/cli",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "bin": { "amber": "./src/main.ts" },
  "exports": { ".": "./src/main.ts" },
  "dependencies": {
    "@amber/adapters": "workspace:*",
    "@amber/core": "workspace:*",
    "@amber/domain": "workspace:*",
    "@clack/prompts": "^0.8.2",
    "citty": "^0.1.6",
    "dino": "file:../../../dino",
    "ink": "^5.1.0",
    "react": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.1"
  }
}
```

- [x] **步骤 2：创建 `packages/cli/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src"]
}
```

- [x] **步骤 3：创建 `packages/cli/src/wiring.ts`**

```ts
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import {
  DinoSource,
  PostgresStore,
  PrismaClient,
  R2BlobStore,
  type DinoArtifact,
  type RunDino,
} from "@amber/adapters";
import { ImportService, ReadService } from "@amber/core";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}. See .env.example.`);
  return v;
}

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
};

/** 解析 YAML 风格 frontmatter 取 title/author/created。最小实现，匹配 dino 的格式。 */
function parseFrontmatter(md: string): { title?: string; author?: string; created?: string; body: string } {
  if (!md.startsWith("---")) return { body: md };
  const end = md.indexOf("\n---", 3);
  if (end === -1) return { body: md };
  const header = md.slice(3, end);
  const body = md.slice(end + 4).replace(/^\n+/, "");
  const pick = (k: string) => header.match(new RegExp(`^${k}:\\s*(.*)$`, "m"))?.[1]?.trim()?.replace(/^"|"$/g, "");
  return { title: pick("title"), author: pick("author"), created: pick("created"), body };
}

/** 具体的 dino 运行器：把 dino 跑到临时目录，再读回 content.md + assets/。 */
const runDino: RunDino = async (url: string): Promise<DinoArtifact> => {
  const { processItem } = await import("dino/pipeline"); // dino 暴露 processItem
  const outDir = await mkdtemp(join(tmpdir(), "amber-dino-"));
  try {
    const result = await processItem({ url, sourceKind: "html-page" }, { outputDir: outDir });
    const md = await readFile(result.outputPath, "utf8");
    const { title, author, created, body } = parseFrontmatter(md);
    const noteDir = result.outputPath.slice(0, result.outputPath.lastIndexOf("/"));
    const assetsDir = join(noteDir, "assets");
    const images: DinoArtifact["images"] = [];
    let names: string[] = [];
    try { names = await readdir(assetsDir); } catch { names = []; }
    for (const name of names) {
      const data = new Uint8Array(await readFile(join(assetsDir, name)));
      images.push({ localPath: `assets/${name}`, data, contentType: CONTENT_TYPE_BY_EXT[extname(name).toLowerCase()] });
    }
    return { title: title ?? result.title, author, publishedAt: created, markdown: body, images };
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
};

export function buildServices() {
  const prisma = new PrismaClient();
  const store = new PostgresStore(prisma);
  const blob = new R2BlobStore({
    accountId: requireEnv("R2_ACCOUNT_ID"),
    accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    bucket: requireEnv("R2_BUCKET"),
    publicBaseUrl: requireEnv("R2_PUBLIC_BASE_URL"),
  });
  const source = new DinoSource(runDino);
  return {
    importService: new ImportService(source, store, blob),
    readService: new ReadService(store),
    prisma,
  };
}
```

> 上面对 dino 导入路径（`dino/pipeline`）与 `processItem` 选项的假设，前提是 dino 暴露了它的 pipeline。若 dino 包尚未导出，需要在 dino 仓库的 `package.json` 加一条 `exports`：`./pipeline` → `dist/pipeline.js`（dino 侧的一行改动）。这是唯一的 dino 侧改动，且完全位于本组装根内部。

- [x] **步骤 4：创建 `packages/cli/src/commands/import.ts`**

```ts
import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import { buildServices } from "../wiring.js";

export const importCommand = defineCommand({
  meta: { name: "import", description: "Import a URL into Amber" },
  args: {
    url: { type: "positional", description: "Web page URL to capture", required: true },
  },
  async run({ args }) {
    const { importService, prisma } = buildServices();
    const spin = p.spinner();
    spin.start(`Importing ${args.url}`);
    try {
      const id = await importService.run(args.url);
      spin.stop(`Imported as ${id}`);
    } catch (err) {
      spin.stop("Import failed");
      p.log.error((err as Error).message);
      process.exitCode = 1;
    } finally {
      await prisma.$disconnect();
    }
  },
});
```

- [x] **步骤 5：创建 `packages/cli/src/main.ts`**

```ts
#!/usr/bin/env -S node --import tsx
import { defineCommand, runMain } from "citty";
import { importCommand } from "./commands/import.js";

const main = defineCommand({
  meta: { name: "amber", description: "Personal Knowledge Pipeline" },
  subCommands: {
    import: importCommand,
  },
});

runMain(main);
```

- [x] **步骤 6：类型检查**

执行：`pnpm install && pnpm -w exec tsc -p packages/cli/tsconfig.json --noEmit`
预期：无错误。（`@amber/web` 此时有意尚未列为依赖 —— 需要它的 `serve` 命令在任务 11 添加，届时一并加上该依赖。）

- [x] **步骤 7：提交**

```bash
git add -A
git commit -m "feat(cli): add wiring composition root and import command"
```

> **注意：** `wiring.ts` 的实现使用了 `FileStore`/`FileBlobStore` 而非计划中的 `PostgresStore`/`R2BlobStore`；`runDino` 的具体逻辑（dino pipeline 调用）也集成在本次提交中（合并到了 `feat(adapters,cli): file-based import pipeline without database`）。

---

## 任务 10：@amber/web — Hono 服务 + markdown 渲染

**文件：**
- 创建：`packages/web/package.json`、`packages/web/tsconfig.json`、`packages/web/src/render.ts`、`packages/web/src/render.test.ts`、`packages/web/src/index.ts`

- [x] **步骤 1：创建 `packages/web/package.json`**

```json
{
  "name": "@amber/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "@amber/core": "workspace:*",
    "@amber/domain": "workspace:*",
    "@hono/node-server": "^1.13.7",
    "hono": "^4.6.14",
    "markdown-it": "^14.1.0"
  },
  "devDependencies": {
    "@types/markdown-it": "^14.1.2"
  }
}
```

- [x] **步骤 2：创建 `packages/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src"]
}
```

- [x] **步骤 3：编写失败的测试 `packages/web/src/render.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { renderArticle, renderList, escapeHtml } from "./render.js";

describe("render", () => {
  it("escapes html in list titles", () => {
    expect(escapeHtml(`a<b>&"c`)).toBe("a&lt;b&gt;&amp;&quot;c");
  });

  it("renders a list with links to each capture", () => {
    const html = renderList([
      { id: "c1", title: "First", sourceUrl: "https://x/a", createdAt: "2026-01-01T00:00:00.000Z" },
    ]);
    expect(html).toContain("First");
    expect(html).toContain('href="/captures/c1"');
  });

  it("renders an article's markdown to html", () => {
    const html = renderArticle({
      id: "c1", title: "Title", content: "# Heading\n\ntext", sourceUrl: "https://x/a",
      sourceType: "url", createdAt: "2026-01-01T00:00:00.000Z", capturedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(html).toContain("<h1>Heading</h1>");
    expect(html).toContain("text");
  });
});
```

- [x] **步骤 4：运行测试，确认失败**

执行：`pnpm exec vitest run packages/web/src/render.test.ts`
预期：失败 —— 找不到模块 `./render.js`。

- [x] **步骤 5：实现 `packages/web/src/render.ts`**

```ts
import MarkdownIt from "markdown-it";
import type { Capture, CaptureSummary } from "@amber/domain";

const md = new MarkdownIt({ html: false, linkify: true });

export function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  body{max-width:48rem;margin:2rem auto;padding:0 1rem;font:16px/1.6 system-ui,sans-serif;color:#222}
  a{color:#06c;text-decoration:none}a:hover{text-decoration:underline}
  img{max-width:100%}
  .item{padding:.5rem 0;border-bottom:1px solid #eee}
  .muted{color:#888;font-size:.85rem}
</style></head><body>${body}</body></html>`;
}

export function renderList(items: CaptureSummary[]): string {
  const rows = items
    .map(
      (i) =>
        `<div class="item"><a href="/captures/${escapeHtml(i.id)}">${escapeHtml(i.title)}</a>` +
        `<div class="muted">${escapeHtml(i.sourceUrl)}</div></div>`,
    )
    .join("");
  const body = `<h1>Amber</h1>${rows || "<p class='muted'>No captures yet.</p>"}`;
  return page("Amber", body);
}

export function renderArticle(capture: Capture): string {
  const body =
    `<p class="muted"><a href="/">← back</a></p>` +
    `<h1>${escapeHtml(capture.title)}</h1>` +
    `<p class="muted"><a href="${escapeHtml(capture.sourceUrl)}">${escapeHtml(capture.sourceUrl)}</a></p>` +
    md.render(capture.content);
  return page(capture.title, body);
}
```

- [x] **步骤 6：运行测试，确认通过**

执行：`pnpm exec vitest run packages/web/src/render.test.ts`
预期：通过（3 个测试）。

- [x] **步骤 7：实现 `packages/web/src/index.ts`**

```ts
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import type { ReadService } from "@amber/core";
import { renderArticle, renderList } from "./render.js";

export function createApp(readService: ReadService): Hono {
  const app = new Hono();

  app.get("/", async (c) => {
    const items = await readService.list();
    return c.html(renderList(items));
  });

  app.get("/captures/:id", async (c) => {
    const capture = await readService.get(c.req.param("id"));
    if (!capture) return c.html("<p>Not found. <a href='/'>back</a></p>", 404);
    return c.html(renderArticle(capture));
  });

  return app;
}

export function startServer(readService: ReadService, port: number): void {
  const app = createApp(readService);
  serve({ fetch: app.fetch, port });
}
```

- [x] **步骤 8：类型检查**

执行：`pnpm install && pnpm -w exec tsc -p packages/web/tsconfig.json --noEmit`
预期：无错误。

- [x] **步骤 9：提交**

```bash
git add -A
git commit -m "feat(web): add Hono server and markdown rendering"
```

> **注意：** `startServer` 的签名增加了 `{ blobsDir, port }` 选项对象（以支持本地 blob 静态文件服务），而非计划中的 `(readService, port)`。

---

## 任务 11：@amber/cli — serve + list 命令，端到端验证

**文件：**
- 创建：`packages/cli/src/commands/serve.ts`、`packages/cli/src/commands/list.ts`、`packages/cli/src/ui/CaptureList.tsx`
- 修改：`packages/cli/package.json`（加 `@amber/web` 依赖）、`packages/cli/src/main.ts`

- [x] **步骤 0：在 `packages/cli/package.json` 的 dependencies 加入 `@amber/web`**

在 `"dependencies"` 内加入下面这行（`serve` 命令会从它导入）：

```json
    "@amber/web": "workspace:*",
```

然后执行 `pnpm install` 完成链接。

- [x] **步骤 1：创建 `packages/cli/src/commands/serve.ts`**

```ts
import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import { startServer } from "@amber/web";
import { buildServices } from "../wiring.js";

export const serveCommand = defineCommand({
  meta: { name: "serve", description: "Start the local web UI" },
  args: {
    port: { type: "string", description: "Port", default: process.env.AMBER_PORT ?? "7788" },
  },
  async run({ args }) {
    const { readService } = buildServices();
    const port = Number(args.port);
    startServer(readService, port);
    p.log.success(`Amber is running at http://localhost:${port}`);
  },
});
```

- [x] **步骤 2：创建 `packages/cli/src/ui/CaptureList.tsx`** *(跳过：`list` 命令改用 `@clack/prompts` 输出，未使用 Ink/React 组件)*

```tsx
import React from "react";
import { Box, Text } from "ink";
import type { CaptureSummary } from "@amber/domain";

export function CaptureList({ items }: { items: CaptureSummary[] }) {
  if (items.length === 0) {
    return <Text color="gray">No captures yet. Run: amber import &lt;url&gt;</Text>;
  }
  return (
    <Box flexDirection="column">
      {items.map((i) => (
        <Box key={i.id}>
          <Text color="cyan">{i.title}</Text>
          <Text color="gray"> — {i.sourceUrl}</Text>
        </Box>
      ))}
    </Box>
  );
}
```

- [x] **步骤 3：创建 `packages/cli/src/commands/list.ts`**

```ts
import { defineCommand } from "citty";
import React from "react";
import { render } from "ink";
import { buildServices } from "../wiring.js";
import { CaptureList } from "../ui/CaptureList.js";

export const listCommand = defineCommand({
  meta: { name: "list", description: "List captures in the terminal" },
  async run() {
    const { readService, prisma } = buildServices();
    try {
      const items = await readService.list();
      const { waitUntilExit } = render(React.createElement(CaptureList, { items }));
      await waitUntilExit();
    } finally {
      await prisma.$disconnect();
    }
  },
});
```

- [x] **步骤 4：修改 `packages/cli/src/main.ts`，注册全部命令**

```ts
#!/usr/bin/env -S node --import tsx
import { defineCommand, runMain } from "citty";
import { importCommand } from "./commands/import.js";
import { listCommand } from "./commands/list.js";
import { serveCommand } from "./commands/serve.js";

const main = defineCommand({
  meta: { name: "amber", description: "Personal Knowledge Pipeline" },
  subCommands: {
    import: importCommand,
    list: listCommand,
    serve: serveCommand,
  },
});

runMain(main);
```

- [x] **步骤 5：全量类型检查 + 测试**

执行：`pnpm install && pnpm run typecheck && pnpm test`
预期：类型检查无错误；vitest 全部测试通过。

- [x] **步骤 6：手动端到端验证（需要真实 .env）**

~~把 `.env.example` 复制为 `.env`，填入真实的 Supabase + R2 值，然后：~~

文件存储模式下（无需云服务）：

```bash
pnpm amber import "https://example.com/some-article"        # 预期："Imported as <id>"
pnpm amber list                                             # 预期：终端列表里出现该文章
pnpm amber serve                                            # 打开 http://localhost:7788
```
预期：导入成功；list 显示该条目；浏览器显示列表，点击后打开文章，图片从本地 blob 目录加载。

- [x] **步骤 7：提交**

```bash
git add -A
git commit -m "feat(cli): add serve and list commands; wire full v1 pipeline"
```

---

## 验收（对应设计文档 §10）

> **注：** 当前实现采用文件存储，云端门槛标记为未完成。

- [x] `amber import <url>`：正文存入本地 JSON 文件，图片存入本地 blob 目录且链接已改写（任务 4 逻辑 + 任务 11）。
  - *原计划（未完成）：正文存入 Postgres，图片存入 R2。*
- [x] `amber serve`：在 `localhost:7788` 显示列表（任务 10 + 任务 11）。
- [x] 点击列表条目，打开排版干净、带图片的文章页（任务 10）。
- [ ] （可选）另一台机器连同一个 Supabase/R2 能看到相同内容 —— 需完成任务 6/7（Postgres + R2 适配器）才可实现。
```
