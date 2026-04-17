# 知乎写作生态 — 架构与维护指南 (zhihu-desktop 视角)

> 最后更新: 2026-04-16
> 对称文档: `D:\CodeSpace\my-skills\docs\architecture-zhihu-ecosystem.md`

## 1. 本仓库在生态中的位置

```
┌─────────────────────────────────────────────────────────────┐
│                    D:\CodeSpace\my-skills                     │
│                      (技能仓库 · CLI 工作流)                   │
│                                                               │
│  skills/zhihu-article/                                        │
│  ├── SKILL.md (Claude Code 工作流定义)                         │
│  ├── references/ (写作规范、发布指南)                           │
│  └── scripts/ ★ 共享脚本的上游源                               │
│       review-article.ts │ md-to-zhihu-html.ts                 │
│       publish-article.ts│ startup-edge.ts                     │
│       zhihu-publish.ts  │ vendor/baoyu-chrome-cdp/            │
│       quick-fix.ts      │ generate-svg-cover.ts               │
│       optimize-and-review.ts │ generate-ai-cover.ts           │
│                                                               │
│  docs/superpowers/specs/zhihu-desktop-design.md  ← 设计规格   │
│  docs/superpowers/plans/zhihu-desktop.md         ← 实施计划   │
│  automation/zhihu/manifests/                     ← 发布状态   │
└───────────────┬───────────────────────────────────────────────┘
                │
                │  脚本复制 (手动, 上游 → 下游)
                │  ★ 当前最大维护痛点
                ▼
┌─────────────────────────────────────────────────────────────┐
│              ★ D:\CodeSpace\zhihu-desktop ★                   │
│                (本仓库 · Electron GUI · v0.9.4)                │
│                                                               │
│  src/main/              src/renderer/                         │
│  ├── index.ts           ├── screens/                          │
│  ├── ipc-handlers.ts    │   Onboarding.tsx (API Key+Edge)     │
│  ├── secure-storage.ts  │   WriteScreen.tsx (主题→生成)        │
│  ├── edge-launcher.ts   │   ReviewScreen.tsx (评分+问题列表)    │
│  └── services/          │   PublishScreen.tsx (预览+发布)       │
│      article-generation │   SettingsScreen.tsx                 │
│      article-review     ├── components/                       │
│      article-publish    │   IssueList / ScoreBadge / LogPanel │
│      zhihu-markdown     │   MarkdownPreview / ProgressSteps   │
│      task-runtime       └── utils/                            │
│      app-updater            app-toast / task-events            │
│                                                               │
│  scripts/ (Bun sidecar 脚本)     resources/                   │
│  ├── generate-article.ts ★ 本仓库独有                          │
│  ├── review-article.ts   ← 从 my-skills 复制 (⚠️ +emitStep)  │
│  ├── md-to-zhihu-html.ts ← 从 my-skills 复制 (✅ 一致)        │
│  ├── publish-article.ts  ← 从 my-skills 复制 (⚠️ +emitStep)  │
│  ├── startup-edge.ts     ← 从 my-skills 复制 (✅ 一致)        │
│  └── vendor/baoyu-chrome-cdp/ ← 从 my-skills 复制 (✅ 一致)   │
└─────────────────────────────────────────────────────────────┘
```

## 2. 脚本血缘关系

```
                  上游 (my-skills)               本仓库 (zhihu-desktop)
                  scripts/                       scripts/
                  ─────────                      ─────────────
共享脚本 (需同步):
  review-article.ts    ● ─── 复制 ───►  ● (+emitStep 进度上报)
  md-to-zhihu-html.ts  ● ─── 复制 ───►  ● (一致)
  publish-article.ts   ● ─── 复制 ───►  ● (+emitStep 进度上报)
  startup-edge.ts      ● ─── 复制 ───►  ● (一致)
  vendor/baoyu-chrome-  ● ─── 复制 ───►  ● (一致)
    cdp/

仅上游 (my-skills):
  zhihu-publish.ts       ●              (publish-article 内部调用)
  generate-svg-cover.ts  ●              (本仓库暂不需要)
  generate-ai-cover.ts   ●              (本仓库暂不需要)
  quick-fix.ts           ●              (本仓库暂不需要)
  optimize-and-review.ts ●              (本仓库暂不需要)

仅本仓库:
  generate-article.ts              ●    (调 Claude API 生成文章)

仅本仓库 src/main/services/:
  article-generation.ts            ●    (主进程: 流式生成, 调 Claude API)
  article-review.ts                ●    (主进程: 调 Bun sidecar review)
  article-publish.ts               ●    (主进程: 调 Bun sidecar publish)
  zhihu-markdown.ts                ●    (主进程: MD→HTML 内联转换)
  task-runtime.ts                  ●    (主进程: 任务调度/进度管理)
  app-updater.ts                   ●    (主进程: electron-updater 自动更新)
```

## 3. 功能对齐矩阵

| 功能 | my-skills (CLI) | 本仓库 (GUI) | 同步方式 |
|------|:-:|:-:|------|
| 文章生成 | Claude Code 直接写 | `generate-article.ts` + `article-generation.ts` | **不同实现** |
| 文章审核 | `review-article.ts` | 相同脚本 via Bun sidecar | **脚本复制** |
| 快速修复 | `quick-fix.ts` | ❌ 未实现 | — |
| 多轮优化 | `optimize-and-review.ts` | ❌ 未实现 | — |
| MD→HTML | `md-to-zhihu-html.ts` | 相同脚本 + `zhihu-markdown.ts` 包装 | **脚本复制 + 包装层** |
| Edge 启动 | `startup-edge.ts` | `edge-launcher.ts` + 相同脚本 | **脚本复制 + 包装层** |
| 知乎发布 | `publish-article.ts` → CDP | 相同脚本 via Bun sidecar | **脚本复制** |
| SVG 封面 | `generate-svg-cover.ts` | ❌ 未实现 | — |
| AI 封面 | `generate-ai-cover.ts` | ❌ 未实现 | — |
| API Key 管理 | 环境变量 | `secure-storage.ts` (Electron safeStorage) | **不同实现** |
| 发布状态追踪 | `automation/zhihu/manifests/` | ❌ 无状态持久化 | — |
| 质量门禁 (≥70) | SKILL.md 流程强制 | ReviewScreen UI 展示 | **各自实现** |
| 写作规范 | `references/writing-guide.md` | ❌ 未内置 | — |
| 自动更新 | — | `app-updater.ts` (electron-updater) | **本仓库独有** |

## 4. 本仓库数据流

```
用户 ──► Electron GUI
           │
    ┌──────┼──────┐──────────────┐
    ▼      ▼      ▼              ▼
 Onboarding  Write   Review    Publish
 (API Key)  Screen  Screen    Screen
    │        │       │          │
    ▼        ▼       ▼          ▼
 safeStorage  IPC     IPC       IPC
    │     Handler  Handler   Handler
    │        │       │          │
    │        ▼       ▼          ▼
    │    article- Bun sidecar Bun sidecar
    │    generation  │          │
    │    (主进程内    │          │
    │    Claude API)  │          │
    │        │       ▼          ▼
    │        ▼    review-    publish-
    │     返回 MD  article.ts article.ts
    │     给前端     │          │
    │        │       ▼          ▼
    └────────┴── 前端展示 ◄─── Edge CDP
                (无持久化)
```

### 对比: CLI 模式 (my-skills)

```
你 ──► Claude Code ──► SKILL.md 决策
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
      写文章          审核文章         发布文章
   (Claude 直写)   (review-article)  (publish-article)
         │               │               │
         ▼               ▼               ▼
   articles/YYYY-MM/  JSON 评分        Edge CDP
   DD/zhihu/title.md   ≥70 通过        填充编辑器
         │                               │
         └───────────► manifest ◄────────┘
                    (状态机持久化)
```

## 5. 维护策略

### 当前痛点

**共享脚本靠手动复制同步**。上游 my-skills 改了脚本，本仓库不会自动更新。

### 本仓库的额外改动 (emitStep)

本仓库在 `review-article.ts` 和 `publish-article.ts` 中加了 `emitStep()` 函数，用于向前端发送进度事件：

```typescript
function emitStep(step: number, label: string): void {
  console.error(`__STEP__review:${step}:${label}`);
}
```

这些改动**不影响功能逻辑**，仅通过 stderr 输出进度标记，供 `task-runtime.ts` 解析并推送到前端 ProgressSteps 组件。

### 同步脚本时的操作流程

```
上游改了共享脚本？
  │
  ├─► 1. diff 查看变更
  │      diff ../my-skills/skills/zhihu-article/scripts/review-article.ts \
  │           ./scripts/review-article.ts
  │
  ├─► 2. 复制上游版本
  │      cp ../my-skills/skills/zhihu-article/scripts/<file>.ts \
  │         ./scripts/<file>.ts
  │
  ├─► 3. 补回 emitStep (仅 review-article.ts 和 publish-article.ts)
  │      手动加回 emitStep() 函数定义和调用点
  │
  └─► 4. 测试 → 提交
```

### 日常开发决策树

```
改了什么？
  │
  ├─► 共享脚本逻辑 bug
  │     └─► 在 my-skills 修 → 测试 → 复制到本仓库 → 补 emitStep → 测试
  │
  ├─► Electron UI / services / IPC
  │     └─► 直接在本仓库改，不影响 my-skills
  │
  ├─► 想从 my-skills 引入新脚本 (如封面生成)
  │     └─► 复制脚本 → 加 IPC handler → 加 UI screen/component
  │
  └─► 想加本仓库独有功能 (如自动更新、设置页)
        └─► 直接在本仓库开发
```

### 演进路径

```
阶段 0 (现在):  手动复制 + 补 emitStep
阶段 1 (短期):  diff 脚本 + commit message 标注上游版本
阶段 2 (中期):  共享脚本抽成 npm 包，emitStep 改为可选参数
阶段 3 (长期):  去掉 Bun sidecar，主进程直接 import 共享模块
```

## 6. 版本对照表 (实测 2026-04-16)

| 共享脚本 | diff 行数 | 本仓库额外改动 | 状态 |
|----------|----------|--------------|------|
| review-article.ts | 16行 | +`emitStep()` 进度上报 | ⚠️ 已漂移 (功能一致) |
| md-to-zhihu-html.ts | 0行 | — | ✅ 同步 |
| publish-article.ts | 13行 | +`emitStep()` 进度上报 (4步) | ⚠️ 已漂移 (功能一致) |
| startup-edge.ts | 0行 | — | ✅ 同步 |
| vendor/baoyu-chrome-cdp | 0行 | — | ✅ 同步 |

**快速验证同步的命令**:
```bash
for f in review-article.ts md-to-zhihu-html.ts publish-article.ts startup-edge.ts; do
  echo "=== $f ==="
  diff "../my-skills/skills/zhihu-article/scripts/$f" \
       "./scripts/$f" | wc -l
done
```
