# 存储后端无关的 blob 引用与渲染 设计

> 日期：2026-06-07
> 状态：设计已确认（讨论达成共识），待实现规划
> 关联：开源 / 自托管方向讨论的产物；与"鉴权""临时分享""R2 私有化"解耦，为其铺路

## 1. 背景与问题

amber 的核心卖点是**数据所有权与可移植性**。但当前正文（`content`）把 blob 的**最终 URL 焊死进了持久化数据**：

`packages/core/src/import-service.ts:41-42`

```ts
const publicUrl = await this.blob.put(key, asset.data, asset.contentType);
content = content.replaceAll(asset.placeholder, publicUrl);
```

`blob.put` 返回什么 URL 就写进正文：

- `FileBlobStore` → `/blobs/<key>`
- `R2BlobStore` → `${R2_PUBLIC_BASE_URL}/<key>`

后果：

- **正文被导入那一刻的后端绑死**。本地导入存的是本地路径，R2 导入存的是 R2 直链。
- **换后端 / 迁移 blob 后正文链接全部失效**——这正是 `docs/configuration.md` 中"`amber migrate` 不搬 blob""`amber delete` 不清 R2"两条已知限制的根因。
- **无法私有化 / 分享**：正文里散落公开直链，任何私有化（签名 URL、代理）或临时分享都得回头改存量数据。

关键观察：`assetKey()` 产出的 `captures/<id>/<i>.<ext>` **本身就是后端无关的稳定 key**。问题不在 key，而在于正文存的是"key 解析后的 URL"而非 key 本身。同时，契约层 `BlobStore` 只抽象了"写"（`put`），没抽象"读成 URL"——所以 URL 知识泄漏进了正文，破坏了"契约层隔离外部依赖"这条承重墙。

## 2. 目标

1. 正文不再绑定任何具体存储后端；同一份数据在 local / R2 / S3 / MinIO / OSS 之间可移植。
2. 补全 `BlobStore` 契约：把"key → URL"收进接口。
3. 让"R2 公开 / 私有 / 签名 URL / 代理 / 临时分享"全部退化为 `urlFor` 的实现细节，无需现在决定，且不触动存量正文。
4. 纯本地（磁盘存储、不上传 OSS）保持零配置默认。

## 3. 设计决策（已确认）

1. **正文只存稳定 key**，带可识别 scheme：`amber-asset:<key>`（如 `amber-asset:captures/<id>/0.png`）。导入时不再把 `blob.put` 的返回 URL 写进正文。
2. **`BlobStore` 增加异步 `urlFor(key): Promise<string>`**。异步是为未来签名 URL（`getSignedUrl()` 本身异步）预留；公开/本地虽是纯字符串也包成 async 统一签名。
3. **渲染层改异步**：解析正文时把 `amber-asset:<key>` 替换为 `await blob.urlFor(key)`。
4. **后端收成两个**：`local`（磁盘）+ 通用 `s3`（endpoint 可配）。R2 / MinIO / 阿里云 OSS / B2 / Wasabi 都是 S3 API 兼容，差异仅在 `endpoint`，**一套 S3 实现覆盖所有 OSS**。现有 `R2BlobStore` 已是 `@aws-sdk/client-s3` + 自定义 endpoint，泛化即可。
5. **env 用显式 driver 选择**，替代当前隐式探测（`R2_*` 是否齐全）。配错时**启动即校验报错**，不拖到首次 import 才崩。
6. 私有 R2 / 签名 URL / 代理 / 临时分享**不在本 spec 实现**，但接口（key in content + async urlFor）为其留好口子。

## 4. 详细设计

### 4.1 正文中的引用形态

- scheme：`amber-asset:<key>`，其中 `<key>` 为 `assetKey()` 产出的稳定 key。
- 仅 wrap **被抓取下来、进了 blob 的资产**；原文中保留的**外部远程图片/链接原样保留**，不套 scheme。
- `coverImage` 字段若指向被抓下来的封面，同样以 `amber-asset:<key>` 存储，渲染时走同一解析；若是外部 URL 则原样。

### 4.2 BlobStore 契约扩展

```ts
interface BlobStore {
  put(key: string, data: Uint8Array, contentType?: string): Promise<string>;
  urlFor(key: string): Promise<string>;
}
```

各实现：

- `FileBlobStore.urlFor` → `/blobs/<key>`（amber 现有 `/blobs/` 路由直接服务）。
- `S3BlobStore.urlFor`（公开档）→ `${publicBaseUrl}/${key}`。
- `S3BlobStore.urlFor`（未来私有档）→ `getSignedUrl()` 现签（async，本 spec 不实现）。

> 备注：`put` 的返回值在本设计下不再用于写入正文，可保留（调试/日志）或后续清理，避免误用。

### 4.3 渲染层异步化

- `packages/web/src/render.ts`（及其调用链）改为 async。
- 解析正文时，对每个 `amber-asset:<key>` 调用 `await blob.urlFor(key)` 得到最终 URL。
- 性能：一篇多图文章 = N 次 await。公开档纯字符串、签名档纯 HMAC 计算（不走网络），串行可接受。**暂不实现批量**；若将来需要，留 `urlForMany(keys)` 口子（YAGNI）。

### 4.4 通用 S3 后端

- 将 `createR2BlobStore` 泛化为 `createS3BlobStore`：把"由 `accountId` 拼 endpoint"改为直接接收 `endpoint`。
- R2 退化为"`endpoint = https://<account>.r2.cloudflarestorage.com`"的一个 case。

### 4.5 env 配置与启动校验

```bash
AMBER_BLOB_DRIVER=local            # 默认，磁盘
# 或
AMBER_BLOB_DRIVER=s3
AMBER_S3_ENDPOINT=...              # R2 / MinIO / OSS 的地址
AMBER_S3_BUCKET=amber-blobs
AMBER_S3_ACCESS_KEY_ID=...
AMBER_S3_SECRET_ACCESS_KEY=...
AMBER_S3_REGION=auto
AMBER_S3_PUBLIC_BASE_URL=https://assets.example.com   # 公开档需要
```

- `wiring.ts` 从隐式探测改为读 `AMBER_BLOB_DRIVER` 显式分支。
- 选 `s3` 但缺必填项（bucket / 凭证 / endpoint）→ 抛清晰错误并退出。
- 旧的 `R2_*` 变量：可保留一段兼容映射，或在迁移说明中要求改用 `AMBER_S3_*`（实现规划时定）。

### 4.6 存量数据迁移

正文里已有的硬编码 URL 需反解析回 key：

- 提供一次性脚本：扫描 `content`，把已知 public base / `/blobs/` 前缀 + key 反写为 `amber-asset:<key>`。
- 或接受新老并存：渲染层对"已是完整 URL 的引用"原样输出，仅对 `amber-asset:` 前缀做解析。实现规划时择一。

## 5. 不在本 spec 范围（仅记录方向）

- 鉴权（`AMBER_PASSWORD` + 按资源判断的中间件）。
- 临时分享（share token）。
- R2/S3 私有访问的具体实现（签名 URL 或 amber 代理）——本 spec 只保证接口能容纳它。
- `BlobStore.delete`（清理 OSS 对象）——可在本次顺带加，亦可独立，实现规划时定。

## 6. 受影响文件

- `packages/domain/src/index.ts`：`BlobStore` 接口加 `urlFor`。
- `packages/adapters/src/file-blob-store.ts`：实现 `urlFor`。
- `packages/adapters/src/r2-blob-store.ts` → 泛化为通用 S3（`createS3BlobStore`），实现 `urlFor`。
- `packages/core/src/import-service.ts`：第 42 行改为写 `amber-asset:<key>`。
- `packages/web/src/render.ts`：解析改异步、注入 `blob.urlFor`。
- `packages/cli/src/wiring.ts`：显式 `AMBER_BLOB_DRIVER` + 启动校验。
- `.env.example` / `docs/configuration.md`：更新为 `AMBER_BLOB_DRIVER` / `AMBER_S3_*`。
- 一次性迁移脚本（位置实现规划时定）。

## 7. 任务清单（TODO）

- [ ] `BlobStore` 接口增加 async `urlFor(key)`，更新两个实现
- [ ] 正文改存 `amber-asset:<key>`（`import-service`），仅 wrap 抓取资产
- [ ] 渲染层（`render.ts` 及调用链）异步化，解析 `amber-asset:` → `urlFor`
- [ ] `coverImage` 走同一 key 规则
- [ ] 泛化 R2 → 通用 S3（endpoint 可配），保留 R2 为特例
- [ ] `wiring.ts` 显式 `AMBER_BLOB_DRIVER` + 启动校验
- [ ] 存量正文 URL → key 迁移（脚本或并存策略）
- [ ] 更新 `.env.example` 与 `docs/configuration.md`
- [ ] 单测覆盖：`urlFor` 各后端、import 存 key、render 解析、边界（外链不被 wrap）
