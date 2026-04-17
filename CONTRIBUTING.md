# 贡献指南

感谢你对 zhihu-desktop 的兴趣！这个文档会帮助你快速了解如何参与项目。

## 开发流程

### 1. Fork 并 Clone
```bash
git clone https://github.com/your-username/zhihu-desktop.git
cd zhihu-desktop
```

### 2. 安装依赖
```bash
npm install
```

### 3. 启动开发环境
```bash
npm run dev
```

这会启动 Electron 应用的开发服务器，支持热刷新。

### 4. 提交修改
```bash
git checkout -b feat/your-feature-name
# 修改代码
git add .
git commit -m "feat: 简短描述你的功能"
git push origin feat/your-feature-name
```

### 5. 提交 PR
在 GitHub 上创建 Pull Request，清晰描述：
- 改动内容（what）
- 为什么这样改（why）
- 如何测试（how）

## 代码规范

### 类型检查
```bash
npm run typecheck:node  # 主进程
npm run typecheck:web   # 渲染进程
npm run typecheck       # 全部检查
```

### 代码格式
```bash
npm run lint      # 检查
npm run format    # 自动格式化
```

我们使用：
- **TypeScript** 确保类型安全
- **ESLint** 检查代码质量
- **Prettier** 保持格式一致

### 提交信息格式

遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

```
<type>(<scope>): <subject>

<body>

<footer>
```

例子：
- `feat(article): 添加自定义模板功能`
- `fix(publish): 修复知乎登录状态检测`
- `refactor(storage): 优化 API Key 存储逻辑`
- `docs: 更新 README 使用说明`

## 报告 Bug

在 GitHub Issues 中提报，请包含：

1. **复现步骤** — 清晰的步骤让别人能重现问题
2. **期望行为** — 应该发生什么
3. **实际行为** — 实际发生了什么
4. **环境信息** — 操作系统、Node 版本、应用版本
5. **截图/日志** — 如有错误信息，请粘贴完整的 console 输出

## 建议功能

在 GitHub Issues 中提出功能建议，说明：

1. **动机** — 为什么需要这个功能？
2. **方案** — 你如何看待实现它？
3. **优势** — 这会改进什么？

## 项目结构

```
zhihu-desktop/
├── src/
│   ├── main/          # Electron 主进程（Node.js）
│   │   ├── index.ts
│   │   ├── ipc-handlers.ts    # 进程通信
│   │   ├── secure-storage.ts  # 密钥存储
│   │   └── services/          # 业务逻辑
│   ├── renderer/      # 渲染进程（React UI）
│   ├── preload/       # 预加载脚本
│   └── shared/        # 共享类型/常量
├── resources/         # 静态资源
├── build/             # 构建配置
└── scripts/           # 工具脚本
```

## 关键模块说明

### 密钥管理 (`src/main/secure-storage.ts`)
- 使用 Electron `safeStorage` API 加密 API Key
- **不要**直接在内存中存储明文密钥
- 所有密钥操作走 `secure-storage.ts` 模块

### 知乎集成 (`src/main/edge-launcher.ts`)
- 自动启动 Edge 浏览器访问知乎
- 使用 Chrome DevTools Protocol (CDP) 自动化
- 登录状态持久化，避免重复登录

### AI 服务 (`src/main/services/article-generation.ts`)
- 支持多个提供商（Anthropic、LetAI、自定义）
- 使用 `max_tokens` 控制输出长度
- 流式响应，实时返回生成内容

## 测试

目前项目缺少自动化测试，欢迎贡献：

```bash
# 功能测试（手动）
npm run dev
# 在 UI 中逐一测试功能

# 类型和 lint 检查
npm run typecheck
npm run lint
```

## 构建和发布

仅维护者有权发布。流程如下：

1. 更新版本号（`package.json`）
2. 更新 `CHANGELOG.md`
3. 创建 git tag：`git tag v0.x.x`
4. Push 到 master 触发 CI/CD

GitHub Actions 会自动构建 Windows/macOS/Linux 版本。

## 许可证

提交任何代码即表示你同意以 MIT 许可证发布你的贡献。

## 问题/讨论

- **bug**: GitHub Issues（带 `bug` 标签）
- **功能请求**: GitHub Issues（带 `enhancement` 标签）
- **讨论**: GitHub Discussions（如有启用）
- **问题**: 提 Issue 或发送 email

---

感谢你的贡献！ 🚀
