# 2026-04-16 方案 C 架构重构计划

> 状态：进行中
> **For agentic workers:** 后续围绕方案 C 推进时，优先按本文件更新阶段状态，不再续写到 2026-04-15 的 P0/P1 计划中。

**Goal:** 将当前知乎桌面客户端从“可用工具”逐步演进为“可推广产品”，优先解决运行时依赖、安装包体积、发布效率和产品级可维护性问题。

**Architecture:** 从当前 `Electron + React + TypeScript + Bun sidecar + scripts runtime` 架构，逐步收敛为 `Electron + React + TypeScript + 主进程任务服务/utility process` 架构。目标是不再把 `bun.exe` 和整套 `scripts` 运行时资源打进安装包，并为后续自动更新、灰度发布和诊断能力留出稳定边界。

**Tech Stack:** Electron 39, React 19, TypeScript 5, electron-vite, electron-builder, GitHub Actions

---

## 前置背景

以下内容在 2026-04-16 之前或当天已经完成，可作为方案 C 的起点参考：

- 生成页日志面板默认只看关键阶段。
- 生成页步骤与日志改为并排布局。
- 文章预览页支持人工编辑 Markdown 后再进入审核。
- 设置页支持输出目录选择，默认目录为安装目录下的 `articles`。
- 写作页新增历史记录、历史浏览、同主题复用、强制重新生成。
- 历史记录支持搜索、显示全部、删除单条。
- 删除历史记录时同步删除本地 Markdown 文件。
- 设置页清除 API Key 时同步清空 AI 配置并回到引导页。
- 本地 `npm run build` 已通过。
- 代码已推送到 `origin/master`，提交为 `3e56a97`。

当前已知待解决问题：

- [ ] GitHub Actions 工作流已拆分，但仍需在远端 tag 流程中验证“复用产物发布”是否按预期稳定运行。
- [ ] 安装包体积仍有进一步优化空间，但 `app.asar` 重复打包与 `bun.exe` 运行时资源问题已基本解决。
- [x] 运行时对 Bun sidecar 的依赖已移除。

### 2026-04-16 已执行记录

- [x] 已盘点 `scripts/` 下生成、审核、发布链路依赖边界。
- [x] 已确认生成链路只依赖 `@anthropic-ai/sdk` 和本地文件系统，适合作为方案 C 的第一条迁移链路。
- [x] 已在 `src/main/services/article-generation.ts` 新增主进程内生成服务。
- [x] 已将 `article:generate` IPC 从 Bun sidecar 切换到主进程内生成服务。
- [x] 已在根项目安装 `@anthropic-ai/sdk`，不再依赖 `scripts/node_modules` 提供生成能力。
- [x] 已在 `src/main/services/article-review.ts` 新增主进程内审核服务。
- [x] 已将 `article:review` IPC 从 Bun sidecar 切换到主进程内审核服务。
- [x] 已在 `src/main/services/zhihu-markdown.ts` 新增 Markdown 转知乎 HTML 的主进程服务。
- [x] 已在 `src/main/services/article-publish.ts` 新增主进程内发布服务。
- [x] 已将 `article:publish` IPC 从 Bun sidecar 切换到主进程内发布服务。
- [x] 本地 `npm run build` 在本轮改造后再次通过。
- [x] 已收紧 `electron-builder.yml` 的打包范围，排除 `scripts/resources/docs/dist-electron/build` 等重复打包目录。
- [x] 当前 `win-unpacked/resources/app.asar` 已从约 550.61 MB 降至约 5.71 MB，重复打包问题已显著缓解。
- [x] 当前 `win-unpacked/resources` 中已不再包含 `bun.exe` 或 `scripts` 运行时资源。
- [x] 已限制 Electron 语言包，仅保留 `zh-CN` 与 `en-US`。
- [x] 当前 `dist-electron/win-unpacked/locales` 已缩减为 2 个语言包，总计约 1053.64 KB。
- [x] 已删除不再使用的 `src/main/bun-sidecar.ts`。
- [x] 已将 GitHub Actions 拆分为 `CI Build` 与 `Release From Tag` 两段工作流。
- [x] 已在发布工作流中加入 tag 与 `package.json` 版本一致性校验，避免复用错版产物。
- [x] 已新增主进程自动更新服务、更新状态 IPC 与设置页更新入口。
- [ ] 生成链路的手工运行验证仍待补做。
- [ ] 发布链路的手工运行验证仍待补做，尤其需要验证知乎编辑器 DOM 选择器在真实页面上是否稳定。
- [ ] 本地完整安装包构建仍受 `winCodeSign` 缓存解压符号链接权限问题影响，需在后续本机环境或 CI 中复核最终包体。
- [ ] 远端还需通过一次真实 `master push -> tag push` 验证产物复用发布链路。

---

## Phase C1: 去掉 Bun 运行时依赖

目标：让核心业务链路不再依赖 `bun.exe + scripts runtime`，优先降低安装包体积并收敛运行时复杂度。

- [x] 盘点 `scripts/` 下生成、审核、发布脚本与依赖边界。
- [x] 设计统一任务服务目录，例如 `src/main/services/tasks`。
- [x] 将生成文章链路从 `bun run script` 迁移为主进程内可直接调用的模块。
- [x] 将审核文章链路迁移为主进程内任务模块。
- [x] 将发布文章链路迁移为主进程内任务模块或独立 utility process。
- [x] 移除安装包中的 `bun.exe` 运行时依赖。
- [x] 移除安装包中的 `scripts` 运行时依赖或缩减为最小预编译产物。

### C1 建议拆解顺序

- [x] C1-1 先迁移生成文章链路，不动 UI 协议。
- [ ] C1-2 本地验证生成、取消、日志、预览功能无回归。
- [x] C1-3 再迁移审核链路。
- [x] C1-4 最后迁移发布链路。

---

## Phase C2: 统一任务执行模型

目标：把零散的脚本式调用收敛为统一任务系统，便于后续扩展批处理、重试、恢复和诊断。

- [ ] 定义统一任务状态：`idle / queued / running / success / failed / cancelled`。
- [ ] 定义统一日志事件模型，替代零散字符串解析。
- [ ] 定义统一步骤事件模型，替代 `__STEP__xxx` 文本协议。
- [ ] 统一错误对象结构，支持用户提示与诊断。
- [ ] 支持任务取消、重试、失败恢复。
- [ ] 评估是否把长任务迁移到 Electron utility process，避免阻塞主进程。

---

## Phase C3: 打包与发布架构优化

目标：收缩安装包、减少重复构建、为自动更新和稳定发版建立基础设施。

- [x] 把 `electron-builder.yml` 改成白名单式打包，避免把不必要目录打进 `app.asar`。
- [x] 检查并移除 `dist-electron`、`docs`、开发资源等重复打包内容。
- [x] 限制 Electron locales，只保留目标市场所需语言包。
- [x] 调整 GitHub Actions 为“push 构建、tag 复用产物发布”。
- [x] 增加缓存和并发取消策略，减少重复构建。
- [x] 为自动更新准备稳定的 release 产物结构。

### C3 重点验收项

- [x] `app.asar` 体积明显下降。
- [x] 安装包不再包含 `bun.exe`。
- [ ] tag 发布不再重复编译同一 commit。

---

## Phase C4: 产品化能力补强

目标：为真实推广场景补齐用户支持、配置管理、诊断和发布通道能力。

- [ ] 重构 onboarding，为真实用户降低首次配置门槛。
- [ ] 重构设置中心，按账号、生成、发布、文件、诊断拆分。
- [ ] 增加日志导出、问题反馈、诊断包。
- [ ] 设计稳定版 / 测试版发布通道。
- [ ] 设计遥测和错误统计开关，确保可关闭。
- [ ] 设计后续账号体系或云端能力预留接口。

---

## 建议执行顺序

- [x] 第一步：先做生成链路的去 Bun 改造。
- [x] 第二步：同步修正打包范围并验证安装包体积下降。
- [x] 第三步：再改审核 / 发布链路。
- [x] 第四步：最后重构 GitHub Actions 与自动更新发布链路。

---

## 更新约定

- [ ] 后续所有方案 C 进展，优先更新本文件。
- [ ] 2026-04-15 的 P0/P1 文件只保留当日计划与完成记录，不再混入后续日期内容。
- [ ] 如果进入新的阶段日程，再额外新建当天计划文件，不覆盖本文件的阶段主线。
