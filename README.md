# zhihu-desktop

[![CI Build](https://github.com/hhhweihan/zhihu-desktop/workflows/CI%20Build/badge.svg)](https://github.com/hhhweihan/zhihu-desktop/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Version](https://img.shields.io/github/package-json/v/hhhweihan/zhihu-desktop)

> 🎯 知乎写作完全自动化 — AI 生成 → 智能审核 → 一键发布，无需切换应用

## ✨ 功能

- **AI 写作助手** — 基于 Claude 3.5 快速生成高质量知乎文章
- **智能审核** — 自动检查文章质量、结构、格式规范
- **一键发布** — 集成知乎写作界面，直接发布到知乎
- **多服务商支持** — Anthropic 官方、LetAI Code、自定义 API 端点
- **离线应用** — 本地 Electron 应用，数据安全
- **自动登录** — 记忆知乎登录状态，免重复登录

## 🎯 快速开始

### 系统要求

- Windows 10+
- Node.js 18+（仅需源码构建）

> macOS 和 Linux 支持计划中，欢迎贡献。

### 安装方式

#### 方式一：下载安装器（推荐）

访问 [GitHub Releases](https://github.com/hhhweihan/zhihu-desktop/releases) 下载最新版本：

- **Windows**: `ZhihuWritingAssistant-*-setup.exe`

#### 方式二：源码构建

```bash
git clone https://github.com/hhhweihan/zhihu-desktop.git
cd zhihu-desktop
npm install
npm run build:win
```

### 初次使用

#### 💡 推荐方式：使用 LetAI Code

LetAI Code 提供国内直连的 Claude API 套餐，开箱即用、无需代理、支持多种模型。

👉 **[购买 LetAI Code Token 套餐](https://letaicode.cn/?aff=npZES3)** — 按量计费，新用户有免费额度

#### 使用步骤

1. **启动应用**
   ```bash
   npm run dev    # 开发模式
   # 或打开已安装的应用
   ```

2. **选择 AI 服务商**
   - **LetAI Code**（推荐，国内友好，无代理）
   - Anthropic（官方，需代理）
   - 自定义（兼容 OpenAI API）

3. **输入 API Token/Key**
   - LetAI Code：粘贴你的 Token（来自 letaicode.cn）
   - Anthropic：[申请 API Key](https://console.anthropic.com/)

4. **开始写作**
   ```
   1. 输入文章主题
   2. AI 生成初稿
   3. 审核和修改
   4. 一键发布到知乎
   ```

## 🛠️ 开发

### 启动开发环境

```bash
npm install       # 安装依赖
npm run dev       # 启动 Electron + HMR
```

### 代码检查

```bash
npm run typecheck # TypeScript 类型检查
npm run lint      # ESLint 代码检查
npm run format    # Prettier 格式化
```

### 构建生产版本

```bash
npm run build     # 编译代码
npm run build:win # Windows 打包
npm run build:mac # macOS 打包
```

## 📖 文档

- [贡献指南](CONTRIBUTING.md) — 如何参与项目
- [行为准则](CODE_OF_CONDUCT.md) — 社区规则
- [CHANGELOG](CHANGELOG.md) — 版本历史

## 🏗️ 项目结构

```
src/
├── main/              # Electron 主进程（Node.js）
│   ├── index.ts
│   ├── ipc-handlers.ts         # 进程通信（IPC）
│   ├── secure-storage.ts       # 密钥管理
│   ├── edge-launcher.ts        # 知乎浏览器自动化
│   ├── constants.ts            # 常量配置
│   └── services/
│       ├── article-generation.ts    # AI 文章生成
│       ├── article-review.ts        # 智能审核
│       ├── article-publish.ts       # 知乎发布
│       └── ...
├── renderer/          # React UI（渲染进程）
│   └── src/
│       ├── App.tsx
│       ├── screens/    # 页面组件
│       ├── components/ # UI 组件
│       └── ...
├── preload/           # 预加载脚本（IPC 桥接）
└── shared/            # 共享类型定义
```

## 🔒 安全

### API Key 存储

- 使用 Electron `safeStorage` API 加密所有敏感数据
- 密钥存储在系统密钥管理器中，不会明文保存
- 启动应用时 API Key 不在内存中持久化

### 数据隐私

- 所有生成内容保存在本地，不上传到第三方
- 与 Anthropic/LetAI 的通信走 HTTPS
- 离线模式下可预览（无网络时）

### 安全漏洞报告

如发现安全问题，请勿在 GitHub Issues 中公开。改为直接 DM 项目维护者。

我们承诺在 48 小时内回复并修复。

## 📊 性能

- **首次启动** — ~3 秒（取决于系统）
- **文章生成** — 依赖模型速度（Claude 3.5 通常 30-60 秒）
- **发布** — ~2-5 秒（网络条件依赖）

## ❓ 常见问题

### Q: 支持哪些 Claude 模型？
A: 目前支持：
- claude-sonnet-4-6 （推荐，速度快）
- claude-opus-4-6 （更强大，更贵）
- claude-haiku-4-5-20251001 （最快，最便宜）

### Q: 可以离线使用吗？
A: 不能。需要连接互联网与 API 服务通信。

### Q: 支持 macOS / Linux 吗？
A: 暂不支持，计划中。欢迎提 PR 适配。

### Q: 如何更新应用？
A: 应用会自动检查更新。也可手动下载最新版本。

### Q: 如何重置 API Key？
A: 点击应用菜单 → 设置 → 清除 API Key

## 📦 发行版

- **Windows**: NSIS 安装器（.exe）

## 🚀 更新日志

详见 [CHANGELOG.md](CHANGELOG.md)

## 📝 许可证

MIT License © 2026 hhhweihan

详见 [LICENSE](LICENSE) 文件

## 🤝 贡献

欢迎贡献代码、报告 bug、提出功能建议！

请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详情。

## ⭐ 致谢

- [Anthropic Claude API](https://anthropic.com)
- [Electron](https://www.electronjs.org)
- [React](https://react.dev)
- [知乎](https://www.zhihu.com)

---

Made with ❤️ by [hhhweihan](https://github.com/hhhweihan)

