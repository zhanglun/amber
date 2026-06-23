# dino 依赖接入与浏览器就绪 设计

> 日期：2026-06-07
> 状态：已实现（dino 导出 doctor + amber 依赖迁移到 `github:zhanglun/dino#v0.2.5` + `amber doctor` 命令 + 浏览器缺失引导均已完成，见下方任务清单）
> 关联：开源 / 自托管方向讨论的产物（阶段1「克隆即跑」的两块地基之一，另一块见 `2026-06-07-blob-url-abstraction-design.md`）

## 1. 背景与问题

要把 amber 开源、让陌生人克隆即跑，第一道硬阻断是 dino 依赖：

`packages/adapters/package.json`

```json
"dino": "file:../../../dino"   // 已废弃，现改为 github:zhanglun/dino#v0.2.5
```

这是指向作者本地 `mine/dino` 的路径依赖。别人克隆 amber 后 `pnpm install` 直接失败，而 dino 是整个"抓取"能力的来源——不解决，开源仓库根本跑不起来。

决策前提（已确认）：

- dino **开源、托管在 GitHub、不发 npm**。amber 改用 **git 依赖**引入。
- dino 仓库现状（已核实 `mine/dino`）整体健康：MIT、public、`repository`/`homepage` 齐全、Node ≥24 与 amber 一致。

## 2. dino 仓库现状核实（已就绪部分）

- ✅ `"prepare": "npm run build"` 已存在。git 依赖安装时 pnpm 会 clone 整个仓库（不止 `files`，故 `src/` 在）、装 devDeps、跑 `prepare`，用 tsup 构建出 `dist/`。**"git 依赖装上后构建不出入口"这个常见坑，dino 已自带解决。**
- ✅ `exports`/`main`/`module`/`types` 均指向 `dist/`。amber `import { capture } from "dino"` 走 `exports["."]` → `dist/index.js`，通。
- ✅ `dist/` 已提交（git 依赖下 `prepare` 也会重建，提交与否不影响，但无害）。

## 3. 真正的工作量：浏览器就绪

dino 依赖 `patchright`（Playwright 的 stealth fork）跑无头浏览器抓页面。核实到的关键事实：

- `patchright` **没有 postinstall**——`pnpm install` 阶段**不会**下载浏览器。
- dino 有 `doctor`（`runDoctor`）检测 Chromium，缺失时执行 `npx patchright install chromium`。
- 抓取模式 `static / browser / stealth`，默认 `auto`。

**`auto` 会自动升级**（核实自 `mine/dino/src/fetch/strategy.ts:89-134`）：attempts 顺序为 `static → browser(+browser-state) → stealth`，逐个尝试，`isMeaningful(html)` 不达标就掉到下一个。因此：

- **静态站**：`static` 即返回，**不碰浏览器**。
- **动态/JS 站**：`static` 内容太薄 → **自动掉到 `browser`** → 需要 Chromium。缺失则 `browser`/`stealth` 接连抛错，最终 `throw new Error(errors.join("; "))`，chromium 缺失信息埋在拼接串里，体验糟。

**两个结构性后果：**

1. **浏览器对 amber 是"接近必备"，不是边缘选项**。默认 `auto` 下，任何静态抓取不理想的站点都会自动要浏览器，用户迟早撞上。amber 的 `DinoSource` 当前正是 `dinoCapture(input)` 走默认 `auto`。
2. **就绪责任在 amber**。dino 的 `doctor` 是 **dino CLI 命令**；amber 把 dino 当**库**用，用户不会自然去跑 `dino doctor`。amber 必须自己拥有"浏览器就绪"的 UX。

**复用障碍**：dino 库入口 `index.ts` 只导出 `capture` + 类型，**未导出 doctor**；`exports` 又只声明 `"."`，深引 `dino/dist/doctor.js` 会被封装挡掉。故 amber 无法直接编程式调用 dino 的 doctor。

## 4. 设计决策（已确认）

1. amber 依赖：`file:../../../dino` → `github:zhanglun/dino#<tag>`（用 tag 锁版本，**不用 `#main`**；`github:` 短写走 https，public repo 不需 SSH key）。
2. dino 侧从库入口**导出 doctor**（`export { runDoctor, formatDoctorResult } from "./doctor.js"`，或加 `./doctor` 子路径 export），让 amber 编程式驱动浏览器就绪。优于 amber 自己 `spawn npx patchright install`（脆）或直接依赖 patchright（多一个直接依赖）。
3. 安装保持**轻**：不加 postinstall、不在装 amber 时强制下 ~150MB 浏览器。静态站零摩擦；浏览器按需安装。
4. amber 提供 **`amber doctor`**（内部调 dino `runDoctor`），一步装好 Chromium。
5. 在需要浏览器的 import 路径**主动检测**：Chromium 缺失时给"运行 `amber doctor`（约 150MB）"的清晰引导，**不把 dino 拼接错误原样抛给用户**。
6. 阶段2 Docker 镜像构建时 `npx patchright install chromium --with-deps`，容器开箱即用、无运行时下载（本 spec 仅记录方向，Docker 属阶段2）。

## 5. 受影响范围

**dino 仓库（小改 + 发布）：**

- `src/index.ts`：导出 `runDoctor` / `formatDoctorResult`（或加 `./doctor` 子路径 export）。
- 验证全新机器 `git clone` → `pnpm install`（git 依赖路径）→ `prepare` 能成功构建。
- 打 tag 并推送（如 `v0.2.x`）。

**amber 仓库：**

- `packages/adapters/package.json`：`dino` 依赖改为 `github:zhanglun/dino#<tag>`。
- `packages/cli/src/commands/`：新增 `doctor.ts`（`amber doctor`）。
- `packages/adapters/src/dino-source.ts` 或 import 编排处：浏览器需求路径的就绪检测 + 友好错误。
- `README.md` / `docs/configuration.md`：安装说明、动态站需 `amber doctor` 的提示。

## 6. 不在本 spec 范围（仅记录方向）

- Docker 镜像与浏览器系统依赖（属阶段2 服务化）。
- 鉴权、临时分享、blob 后端无关化（见对应 spec）。
- amber 自身的分发形态（当前共识：克隆 + pnpm，不发 npm）。

## 7. 任务清单（TODO）

**dino 侧：**

- [x] `index.ts` 导出 `runDoctor` / `formatDoctorResult`（或 `./doctor` 子路径 export）— 已导出
- [x] 全新环境验证 git 依赖安装 + `prepare` 构建成功 — amber `pnpm install` 走 git 依赖，`prepare` 构建 dist，已验证
- [x] 打 tag 并推送 — dino v0.2.5（含 table 修复），amber 锁定 `github:zhanglun/dino#v0.2.5`

**amber 侧：**

- [x] `dino` 依赖改为 `github:zhanglun/dino#<tag>`，删除 `file:` 路径依赖 — `packages/adapters/package.json` 已是 `github:zhanglun/dino#v0.2.5`
- [x] 新增 `amber doctor` 命令（包 dino `runDoctor`）— `packages/cli/src/commands/doctor.ts`
- [x] 需要浏览器的 import 路径：主动检测 Chromium，缺失给"运行 `amber doctor`"的可读引导 — `packages/adapters/src/dino-source.ts` 的 `explainCaptureError` / `mentionsBrowserAttempt`
- [x] README / configuration 文档：安装步骤 + 动态站浏览器说明 — `README.md` 第 13/35/38 行
- [x] 单测：doctor 命令、浏览器缺失时的错误引导路径 — `packages/cli/src/commands/doctor.test.ts`、`packages/adapters/src/dino-source.test.ts`
