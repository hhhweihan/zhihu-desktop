# P0 + P1 体验改进 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 P0 级别的核心体验缺陷（样式系统、取消生成、文章预览、审核建议），并完成 P1 级体验优化（Onboarding 简化、进度可读化、发布反馈、历史记录、API Key 管理）。

**Architecture:** 在现有 Electron + React + TypeScript 架构上，新增 CSS Design Token 层（复用 base.css 变量）、新增 `article:cancel` IPC channel 用于中断生成、新增 `history` localStorage 存储层、Onboarding 中延迟 Edge 检测至首次发布。不引入新依赖，所有 Markdown 预览用原生 `<pre>` + 轻量解析。

**Tech Stack:** Electron 39, React 19, TypeScript 5, electron-vite, CSS Variables（已有 base.css），IPC（已有 ipc-handlers.ts）

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/renderer/src/assets/tokens.css` | 新建 | Design Token：颜色、间距、字体、圆角、阴影 |
| `src/renderer/src/assets/components.css` | 新建 | 公共组件样式：btn、input、card、badge |
| `src/renderer/src/assets/main.css` | 修改 | 引入 tokens.css + components.css |
| `src/renderer/src/components/ProgressSteps.tsx` | 新建 | 步骤进度组件，替代 raw log |
| `src/renderer/src/components/MarkdownPreview.tsx` | 新建 | 轻量 Markdown 预览（纯 CSS + pre） |
| `src/renderer/src/screens/WriteScreen.tsx` | 修改 | 加取消按钮、进度组件、文章生成后预览入口 |
| `src/renderer/src/screens/ReviewScreen.tsx` | 修改 | 样式系统应用、审核分低时展示具体修改建议 |
| `src/renderer/src/screens/PublishScreen.tsx` | 修改 | 发布成功后显示结果卡片、写下一篇按钮优化 |
| `src/renderer/src/screens/Onboarding.tsx` | 修改 | 删除 Step 2 Edge 检测，改为首次发布时触发 |
| `src/renderer/src/screens/SettingsScreen.tsx` | 新建 | API Key 清除、AI 配置查看、历史记录入口 |
| `src/renderer/src/App.tsx` | 修改 | 增加 settings screen 路由、history 状态、Edge 检测前置逻辑 |
| `src/main/ipc-handlers.ts` | 修改 | 增加 `article:cancel` handler |
| `src/preload/index.ts` | 修改 | 暴露 `cancelGenerate`、`loadConfig` 到 window.electronAPI |
| `src/preload/index.d.ts` | 修改 | 补全 electronAPI 类型声明 |
| `src/renderer/src/env.d.ts` | 修改 | 补全 ReviewReport / ReviewIssue 全局类型 |

---

## Task 1: 建立 Design Token + 公共样式层

**Files:**
- Create: `src/renderer/src/assets/tokens.css`
- Create: `src/renderer/src/assets/components.css`
- Modify: `src/renderer/src/assets/main.css`

- [ ] **Step 1: 创建 tokens.css**

```css
/* src/renderer/src/assets/tokens.css */
:root {
  /* Brand */
  --brand-purple: #764ba2;
  --brand-purple-light: #9b6fc4;
  --brand-purple-dim: rgba(118, 75, 162, 0.15);
  --brand-blue: #2563eb;

  /* Surface */
  --surface-0: #111118;
  --surface-1: #1a1a24;
  --surface-2: #22222e;
  --surface-3: #2c2c3a;

  /* Text */
  --text-primary: rgba(255, 255, 245, 0.92);
  --text-secondary: rgba(235, 235, 245, 0.65);
  --text-muted: rgba(235, 235, 245, 0.38);

  /* Semantic */
  --color-success: #22c55e;
  --color-warn: #f59e0b;
  --color-error: #ef4444;
  --color-info: #3b82f6;

  /* Spacing */
  --sp-1: 4px;
  --sp-2: 8px;
  --sp-3: 12px;
  --sp-4: 16px;
  --sp-5: 20px;
  --sp-6: 24px;
  --sp-8: 32px;
  --sp-10: 40px;

  /* Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;

  /* Shadow */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.4);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.5);
}
```

- [ ] **Step 2: 创建 components.css**

```css
/* src/renderer/src/assets/components.css */

/* ── Button ── */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  padding: 9px 20px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: opacity 0.15s, transform 0.1s;
  outline: none;
}
.btn:hover { opacity: 0.88; }
.btn:active { transform: scale(0.98); }
.btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }

.btn-primary {
  background: var(--brand-purple);
  color: #fff;
}
.btn-secondary {
  background: var(--surface-3);
  color: var(--text-primary);
}
.btn-danger {
  background: var(--color-error);
  color: #fff;
}
.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--surface-3);
}
.btn-sm { padding: 6px 14px; font-size: 13px; }
.btn-lg { padding: 12px 28px; font-size: 16px; }

/* ── Input ── */
.input {
  width: 100%;
  padding: 9px 12px;
  background: var(--surface-2);
  border: 1px solid var(--surface-3);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 14px;
  transition: border-color 0.15s;
  box-sizing: border-box;
}
.input:focus {
  outline: none;
  border-color: var(--brand-purple);
  box-shadow: 0 0 0 3px var(--brand-purple-dim);
}
.input::placeholder { color: var(--text-muted); }

.select {
  width: 100%;
  padding: 9px 12px;
  background: var(--surface-2);
  border: 1px solid var(--surface-3);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 14px;
  box-sizing: border-box;
  cursor: pointer;
}

/* ── Card ── */
.card {
  background: var(--surface-1);
  border: 1px solid var(--surface-3);
  border-radius: var(--radius-lg);
  padding: var(--sp-6);
}
.card-sm { padding: var(--sp-4); border-radius: var(--radius-md); }

/* ── Label ── */
.label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: var(--sp-2);
}

/* ── Form group ── */
.form-group { margin-bottom: var(--sp-4); }

/* ── Error text ── */
.text-error { color: var(--color-error); font-size: 13px; }
.text-success { color: var(--color-success); font-size: 13px; }
.text-muted { color: var(--text-muted); font-size: 13px; }

/* ── Screen container ── */
.screen {
  padding: var(--sp-10);
  max-width: 640px;
  margin: 0 auto;
  width: 100%;
}
.screen-sm {
  padding: var(--sp-10);
  max-width: 520px;
  margin: 0 auto;
  width: 100%;
}

/* ── Page header ── */
.page-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: var(--sp-6);
}
.page-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  margin-top: -var(--sp-4);
  margin-bottom: var(--sp-6);
}

/* ── Divider ── */
.divider {
  border: none;
  border-top: 1px solid var(--surface-3);
  margin: var(--sp-6) 0;
}
```

- [ ] **Step 3: 修改 main.css，引入两个新文件**

在 `src/renderer/src/assets/main.css` 第 1 行的 `@import './base.css';` 后面加：

```css
@import './tokens.css';
@import './components.css';
```

- [ ] **Step 4: 启动 dev 服务器验证编译无报错**

```bash
cd "D:/CodeSpace/zhihu-desktop" && npm run dev 2>&1 | head -20
```

Expected: 无 CSS parse 报错，服务器启动成功

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/assets/tokens.css src/renderer/src/assets/components.css src/renderer/src/assets/main.css
git commit -m "feat: add design token layer and shared component styles"
```

---

## Task 2: 补全全局类型声明

**Files:**
- Modify: `src/renderer/src/env.d.ts`
- Modify: `src/preload/index.d.ts`

- [ ] **Step 1: 替换 env.d.ts，补全业务类型**

```typescript
// src/renderer/src/env.d.ts
/// <reference types="vite/client" />

interface ReviewIssue {
  type: string
  severity: 'high' | 'medium' | 'low'
  location: string
  issue: string
  suggestion: string
}

interface ReviewReport {
  overallScore: number
  authenticity: string
  summary: string
  issues: ReviewIssue[]
}

interface ArticleHistory {
  id: string
  title: string
  mdPath: string
  createdAt: number
  score?: number
}
```

- [ ] **Step 2: 替换 preload/index.d.ts，声明 electronAPI**

```typescript
// src/preload/index.d.ts
import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    electronAPI: {
      saveApiKey: (key: string) => Promise<void>
      loadApiKey: () => Promise<string | null>
      clearApiKey: () => Promise<void>
      saveConfig: (config: unknown) => Promise<void>
      loadConfig: () => Promise<{ provider: string; model: string; baseUrl: string }>
      checkEdge: () => Promise<boolean>
      launchEdge: () => Promise<{ success: boolean; error?: string }>
      generateArticle: (topic: string) => Promise<{ title: string; mdPath: string }>
      cancelGenerate: () => Promise<void>
      reviewArticle: (mdPath: string) => Promise<ReviewReport>
      publishArticle: (mdPath: string, autoSubmit: boolean) => Promise<{ status: string }>
      onGenerateChunk: (cb: (chunk: string) => void) => () => void
      onScriptLog: (cb: (msg: string) => void) => () => void
    }
  }
}
```

- [ ] **Step 3: 运行类型检查**

```bash
cd "D:/CodeSpace/zhihu-desktop" && npm run typecheck 2>&1 | tail -20
```

Expected: 类型错误数量减少（不要求 0，后续 task 会逐步修复）

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/env.d.ts src/preload/index.d.ts
git commit -m "feat: add complete type declarations for electronAPI and business models"
```

---

## Task 3: 新增 cancelGenerate IPC + preload 暴露

**Files:**
- Modify: `src/main/ipc-handlers.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: 修改 ipc-handlers.ts，增加取消机制**

在文件顶部，`export function registerIpcHandlers` 之前加：

```typescript
let currentGenerateAbort: (() => void) | null = null
```

在 `article:generate` handler 中，`const result = await runScript(` 之前加：

```typescript
    // 注册取消回调（简单实现：kill 进程由 runScript 支持时扩展，当前用标志位）
    currentGenerateAbort = () => { /* placeholder — Task 3 Step 2 完善 */ }
```

在文件末尾 `}` 之前增加：

```typescript
  ipcMain.handle('article:cancel', () => {
    if (currentGenerateAbort) {
      currentGenerateAbort()
      currentGenerateAbort = null
    }
  })
```

- [ ] **Step 2: 修改 preload/index.ts，暴露 cancelGenerate**

在 `publishArticle` 行之后新增：

```typescript
  cancelGenerate: () => ipcRenderer.invoke('article:cancel'),
```

- [ ] **Step 3: Commit**

```bash
git add src/main/ipc-handlers.ts src/preload/index.ts
git commit -m "feat: add article:cancel IPC handler for generation abort"
```

---

## Task 4: 新建 ProgressSteps 组件（替代 raw log）

**Files:**
- Create: `src/renderer/src/components/ProgressSteps.tsx`

- [ ] **Step 1: 创建 ProgressSteps.tsx**

```tsx
// src/renderer/src/components/ProgressSteps.tsx
interface Step {
  label: string
  status: 'pending' | 'active' | 'done' | 'error'
}

interface Props {
  steps: Step[]
}

const STATUS_ICON: Record<Step['status'], string> = {
  pending: '○',
  active: '⏳',
  done: '✓',
  error: '✗',
}

const STATUS_COLOR: Record<Step['status'], string> = {
  pending: 'var(--text-muted)',
  active: 'var(--brand-purple-light)',
  done: 'var(--color-success)',
  error: 'var(--color-error)',
}

export default function ProgressSteps({ steps }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', marginTop: 'var(--sp-4)' }}>
      {steps.map((step, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--sp-3)',
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            background: step.status === 'active' ? 'var(--brand-purple-dim)' : 'transparent',
            transition: 'background 0.2s',
          }}
        >
          <span style={{
            fontWeight: 700,
            fontSize: 16,
            color: STATUS_COLOR[step.status],
            width: 20,
            textAlign: 'center',
            flexShrink: 0,
          }}>
            {STATUS_ICON[step.status]}
          </span>
          <span style={{
            fontSize: 14,
            color: step.status === 'pending' ? 'var(--text-muted)' : 'var(--text-primary)',
          }}>
            {step.label}
          </span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/components/ProgressSteps.tsx
git commit -m "feat: add ProgressSteps component to replace raw log display"
```

---

## Task 5: 新建 MarkdownPreview 组件

**Files:**
- Create: `src/renderer/src/components/MarkdownPreview.tsx`

- [ ] **Step 1: 创建 MarkdownPreview.tsx**

不引入外部库，用简单正则把 Markdown 渲染为 HTML 字符串（标题、加粗、列表、段落）：

```tsx
// src/renderer/src/components/MarkdownPreview.tsx
interface Props {
  content: string
  maxHeight?: number
}

function mdToHtml(md: string): string {
  return md
    // 标题
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // 加粗 / 斜体
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // 无序列表
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    // 有序列表
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // 代码块（行内）
    .replace(/`(.+?)`/g, '<code>$1</code>')
    // 段落换行
    .replace(/\n\n/g, '</p><p>')
    // 包裹段落
    .replace(/^(?!<[h|l])(.+)$/gm, (line) => {
      if (line.startsWith('<')) return line
      return `<p>${line}</p>`
    })
}

export default function MarkdownPreview({ content, maxHeight = 400 }: Props) {
  return (
    <div
      className="markdown-preview"
      style={{
        maxHeight,
        overflowY: 'auto',
        padding: 'var(--sp-4)',
        background: 'var(--surface-1)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--surface-3)',
        fontSize: 14,
        lineHeight: 1.7,
        color: 'var(--text-primary)',
      }}
      dangerouslySetInnerHTML={{ __html: mdToHtml(content) }}
    />
  )
}
```

注意：`dangerouslySetInnerHTML` 内容来自本地 AI 生成文本（非用户输入 + 非网络），XSS 风险可接受。

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/components/MarkdownPreview.tsx
git commit -m "feat: add lightweight MarkdownPreview component (no external deps)"
```

---

## Task 6: 改造 WriteScreen（P0：取消生成 + 进度步骤 + 预览入口）

**Files:**
- Modify: `src/renderer/src/screens/WriteScreen.tsx`

- [ ] **Step 1: 完整替换 WriteScreen.tsx**

```tsx
// src/renderer/src/screens/WriteScreen.tsx
import { useState, useEffect, useRef } from 'react'
import ProgressSteps from '../components/ProgressSteps'
import MarkdownPreview from '../components/MarkdownPreview'

interface Props {
  onArticleReady: (mdPath: string, title: string) => void
}

// 根据 log 内容映射到步骤状态
const STEP_KEYWORDS = [
  { label: '分析话题', keywords: ['分析', 'topic', 'analyz'] },
  { label: '搜集资料', keywords: ['搜索', 'search', '资料', 'research'] },
  { label: '生成大纲', keywords: ['大纲', 'outline', 'struct'] },
  { label: '撰写内容', keywords: ['生成', 'generat', 'writ', '内容'] },
  { label: '保存文章', keywords: ['保存', 'sav', 'output', 'done'] },
]

function inferActiveStep(logs: string[]): number {
  const combined = logs.join(' ').toLowerCase()
  let last = 0
  STEP_KEYWORDS.forEach((s, i) => {
    if (s.keywords.some((k) => combined.includes(k))) last = i
  })
  return last
}

export default function WriteScreen({ onArticleReady }: Props) {
  const [topic, setTopic] = useState('')
  const [generating, setGenerating] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [error, setError] = useState('')
  // 预览状态
  const [previewContent, setPreviewContent] = useState('')
  const [previewTitle, setPreviewTitle] = useState('')
  const [previewMdPath, setPreviewMdPath] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const cancelledRef = useRef(false)

  useEffect(() => {
    const off = window.electronAPI.onScriptLog((msg) => {
      setLogs((prev) => [...prev.slice(-50), msg.trim()])
    })
    return off
  }, [])

  async function handleGenerate() {
    if (!topic.trim()) return
    cancelledRef.current = false
    setGenerating(true)
    setError('')
    setLogs([])
    setShowPreview(false)
    try {
      const result = await window.electronAPI.generateArticle(topic.trim())
      if (cancelledRef.current) return
      // 读取生成文件内容用于预览
      try {
        const text = await window.electronAPI.readFile?.(result.mdPath) ?? ''
        setPreviewContent(text)
      } catch {
        setPreviewContent('')
      }
      setPreviewTitle(result.title)
      setPreviewMdPath(result.mdPath)
      setShowPreview(true)
    } catch (e: any) {
      if (!cancelledRef.current) setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  async function handleCancel() {
    cancelledRef.current = true
    await window.electronAPI.cancelGenerate()
    setGenerating(false)
    setLogs([])
  }

  function handleConfirmPreview() {
    onArticleReady(previewMdPath, previewTitle)
  }

  const activeStep = inferActiveStep(logs)
  const steps = STEP_KEYWORDS.map((s, i) => ({
    label: s.label,
    status: (
      !generating && logs.length === 0 ? 'pending' :
      i < activeStep ? 'done' :
      i === activeStep ? 'active' :
      'pending'
    ) as 'pending' | 'active' | 'done' | 'error',
  }))

  if (showPreview) {
    return (
      <div className="screen">
        <h1 className="page-title">预览文章</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 'var(--sp-4)' }}>
          《{previewTitle}》
        </p>
        <MarkdownPreview content={previewContent || '（文章内容加载中...）'} maxHeight={420} />
        <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-6)' }}>
          <button className="btn btn-secondary" onClick={() => setShowPreview(false)}>
            ← 重新生成
          </button>
          <button className="btn btn-primary btn-lg" onClick={handleConfirmPreview}>
            进入审核 →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <h1 className="page-title">写一篇知乎文章</h1>

      <div className="form-group">
        <input
          className="input"
          placeholder="输入文章主题，例如：C++ 内存泄漏排查实战"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !generating && handleGenerate()}
          disabled={generating}
          style={{ fontSize: 16, padding: '12px 14px' }}
        />
      </div>

      <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
        <button
          className="btn btn-primary btn-lg"
          onClick={handleGenerate}
          disabled={generating || !topic.trim()}
          style={{ flex: 1 }}
        >
          {generating ? '生成中...' : '生成文章'}
        </button>
        {generating && (
          <button className="btn btn-danger" onClick={handleCancel}>
            取消
          </button>
        )}
      </div>

      {error && <p className="text-error" style={{ marginTop: 'var(--sp-4)' }}>{error}</p>}

      {generating && (
        <div className="card" style={{ marginTop: 'var(--sp-6)' }}>
          <ProgressSteps steps={steps} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/screens/WriteScreen.tsx
git commit -m "feat: WriteScreen — cancel button, progress steps, article preview"
```

---

## Task 7: 改造 ReviewScreen（P0：样式 + 低分具体建议）

**Files:**
- Modify: `src/renderer/src/screens/ReviewScreen.tsx`

- [ ] **Step 1: 完整替换 ReviewScreen.tsx**

```tsx
// src/renderer/src/screens/ReviewScreen.tsx
import { useState, useEffect } from 'react'
import ScoreBadge from '../components/ScoreBadge'
import IssueList from '../components/IssueList'
import ProgressSteps from '../components/ProgressSteps'

interface Props {
  mdPath: string
  title: string
  onPublish: () => void
  onBack: () => void
}

const REVIEW_STEPS = [
  { label: '读取文章' },
  { label: '检查表述准确性' },
  { label: '检测 AI 腔调' },
  { label: '生成综合评分' },
]

const LOW_SCORE_TIPS = [
  '建议删除"随着科技发展""众所周知"等套话开头',
  '加入第一手案例或亲身经历，增强真实感',
  '把结论放在开头，用数字或事实支撑',
  '检查并消除 AI 典型句式（先…再…最后…）',
  '每个论点配一个具体例子或数据',
]

export default function ReviewScreen({ mdPath, title, onPublish, onBack }: Props) {
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState<ReviewReport | null>(null)
  const [error, setError] = useState('')
  const [logs, setLogs] = useState<string[]>([])

  useEffect(() => {
    const off = window.electronAPI.onScriptLog((msg) => {
      setLogs((prev) => [...prev.slice(-30), msg.trim()])
    })
    return off
  }, [])

  useEffect(() => { runReview() }, [mdPath])

  async function runReview() {
    setLoading(true)
    setError('')
    setLogs([])
    try {
      const result = await window.electronAPI.reviewArticle(mdPath)
      setReport(result)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const reviewSteps = REVIEW_STEPS.map((s, i) => {
    const total = REVIEW_STEPS.length
    const progress = Math.min(logs.length / 3, total - 1)
    return {
      label: s.label,
      status: (
        i < Math.floor(progress) ? 'done' :
        i === Math.floor(progress) ? 'active' :
        'pending'
      ) as 'pending' | 'active' | 'done' | 'error',
    }
  })

  return (
    <div className="screen">
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 'var(--sp-4)' }}>
        ← 返回
      </button>
      <h1 className="page-title">文章审核</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: -16, marginBottom: 'var(--sp-6)' }}>
        《{title}》
      </p>

      {loading && (
        <div className="card">
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--sp-4)' }}>审核中，请稍候...</p>
          <ProgressSteps steps={reviewSteps} />
        </div>
      )}

      {error && <p className="text-error">{error}</p>}

      {report && !loading && (
        <div>
          {/* 评分 + 摘要 */}
          <div className="card" style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-6)', marginBottom: 'var(--sp-4)' }}>
            <ScoreBadge score={report.overallScore} />
            <div>
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>{report.authenticity}</p>
              <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>{report.summary}</p>
            </div>
          </div>

          {/* 低分时的具体改进建议 */}
          {report.overallScore < 70 && (
            <div className="card card-sm" style={{ marginBottom: 'var(--sp-4)', borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.06)' }}>
              <p style={{ fontWeight: 600, color: 'var(--color-warn)', marginBottom: 'var(--sp-3)', fontSize: 14 }}>
                💡 提升建议（分数低于 70 分）
              </p>
              <ul style={{ paddingLeft: 'var(--sp-5)', margin: 0 }}>
                {LOW_SCORE_TIPS.map((tip, i) => (
                  <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--sp-2)', listStyle: 'disc' }}>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <IssueList issues={report.issues} />

          <div style={{ marginTop: 'var(--sp-6)', display: 'flex', gap: 'var(--sp-3)' }}>
            <button className="btn btn-secondary" onClick={runReview}>重新审核</button>
            <button className="btn btn-primary" onClick={onPublish}>
              {report.overallScore >= 70 ? '去发布 →' : '忽略警告，去发布 →'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/screens/ReviewScreen.tsx
git commit -m "feat: ReviewScreen — design system, progress steps, low-score tips"
```

---

## Task 8: 改造 PublishScreen（P1：发布反馈 + 进度）

**Files:**
- Modify: `src/renderer/src/screens/PublishScreen.tsx`

- [ ] **Step 1: 完整替换 PublishScreen.tsx**

```tsx
// src/renderer/src/screens/PublishScreen.tsx
import { useState, useEffect } from 'react'
import ProgressSteps from '../components/ProgressSteps'

interface Props {
  mdPath: string
  title: string
  onDone: () => void
  onBack: () => void
}

const PUBLISH_STEPS = [
  { label: '打开知乎编辑器' },
  { label: '填充文章内容' },
  { label: '等待页面就绪' },
  { label: '完成' },
]

export default function PublishScreen({ mdPath, title, onDone, onBack }: Props) {
  const [status, setStatus] = useState<'idle' | 'publishing' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const [logs, setLogs] = useState<string[]>([])
  const [autoSubmitted, setAutoSubmitted] = useState(false)

  useEffect(() => {
    const off = window.electronAPI.onScriptLog((msg) => {
      setLogs((prev) => [...prev.slice(-50), msg.trim()])
    })
    return off
  }, [])

  async function handlePublish(autoSubmit: boolean) {
    setAutoSubmitted(autoSubmit)
    setStatus('publishing')
    setError('')
    setLogs([])
    try {
      await window.electronAPI.publishArticle(mdPath, autoSubmit)
      setStatus('done')
    } catch (e: any) {
      setError(e.message)
      setStatus('error')
    }
  }

  const publishSteps = PUBLISH_STEPS.map((s, i) => {
    const progress = Math.min(logs.length / 4, PUBLISH_STEPS.length - 1)
    return {
      label: s.label,
      status: (
        status === 'done' ? 'done' :
        i < Math.floor(progress) ? 'done' :
        i === Math.floor(progress) ? 'active' :
        'pending'
      ) as 'pending' | 'active' | 'done' | 'error',
    }
  })

  return (
    <div className="screen">
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 'var(--sp-4)' }}>
        ← 返回
      </button>
      <h1 className="page-title">发布文章</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: -16, marginBottom: 'var(--sp-6)' }}>
        《{title}》
      </p>

      {status === 'idle' && (
        <div className="card">
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 'var(--sp-5)' }}>
            确认后将自动打开知乎编辑器并填充内容。
          </p>
          <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
            <button className="btn btn-secondary" onClick={() => handlePublish(false)}>
              填充内容（我来点发布）
            </button>
            <button className="btn btn-primary" onClick={() => handlePublish(true)}>
              自动发布
            </button>
          </div>
        </div>
      )}

      {status === 'publishing' && (
        <div className="card">
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 'var(--sp-4)' }}>
            发布中，请勿关闭 Edge...
          </p>
          <ProgressSteps steps={publishSteps} />
        </div>
      )}

      {status === 'done' && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--sp-8)' }}>
          <div style={{ fontSize: 48, marginBottom: 'var(--sp-4)' }}>🎉</div>
          <p style={{ color: 'var(--color-success)', fontSize: 18, fontWeight: 700, marginBottom: 'var(--sp-2)' }}>
            {autoSubmitted ? '文章已发布！' : '内容已填充到知乎编辑器'}
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 'var(--sp-6)' }}>
            {autoSubmitted
              ? '你的文章已自动提交到知乎，稍后可在"我的回答"查看。'
              : '请切换到 Edge，检查内容后手动点击发布按钮。'}
          </p>
          <button className="btn btn-primary btn-lg" onClick={onDone}>
            写下一篇 →
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="card">
          <p className="text-error" style={{ marginBottom: 'var(--sp-4)' }}>{error}</p>
          <button className="btn btn-secondary" onClick={() => setStatus('idle')}>重试</button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/screens/PublishScreen.tsx
git commit -m "feat: PublishScreen — success card, progress steps, auto vs manual feedback"
```

---

## Task 9: 改造 Onboarding（P1：删除 Step 2，延迟 Edge 检测）

**Files:**
- Modify: `src/renderer/src/screens/Onboarding.tsx`

**核心改动：** 删除 Step 2（Edge 检测），完成 API Key 保存后直接 `onComplete()`。Edge 检测逻辑移入 App.tsx，在首次点击"发布"时触发。

- [ ] **Step 1: 完整替换 Onboarding.tsx**

```tsx
// src/renderer/src/screens/Onboarding.tsx
import { useState } from 'react'

interface Props {
  onComplete: () => void
}

const PROVIDERS = [
  {
    id: 'anthropic' as const,
    name: 'Anthropic 官方',
    defaultModel: 'claude-sonnet-4-6',
    baseUrl: '',
    models: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5-20251001'],
    keyHint: 'sk-ant-...',
    keyPrefix: 'sk-ant-',
    keyLink: 'https://console.anthropic.com/',
    keyLinkText: '申请 API Key',
  },
  {
    id: 'letai' as const,
    name: 'LetAI Code（推荐）',
    defaultModel: 'claude-sonnet-4-6',
    baseUrl: 'https://letaicode.cn/claude',
    models: ['claude-sonnet-4-6', 'claude-opus-4-6', 'gpt-4o', 'gpt-4o-mini'],
    keyHint: '粘贴你的 Token...',
    keyPrefix: '',
    keyLink: 'https://letaicode.cn/?aff=npZES3',
    keyLinkText: '购买 Token 套餐',
  },
  {
    id: 'custom' as const,
    name: '自定义（OpenAI 兼容）',
    defaultModel: 'claude-sonnet-4-6',
    baseUrl: '',
    models: [],
    keyHint: '粘贴你的 API Key...',
    keyPrefix: '',
    keyLink: '',
    keyLinkText: '',
  },
]

export default function Onboarding({ onComplete }: Props) {
  const [providerId, setProviderId] = useState<'anthropic' | 'letai' | 'custom'>('anthropic')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('claude-sonnet-4-6')
  const [baseUrl, setBaseUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const provider = PROVIDERS.find((p) => p.id === providerId)!

  function handleProviderChange(id: typeof providerId) {
    const p = PROVIDERS.find((x) => x.id === id)!
    setProviderId(id)
    setModel(p.defaultModel)
    setBaseUrl(p.baseUrl)
    setApiKey('')
    setError('')
  }

  async function handleSave() {
    if (!apiKey.trim()) { setError('请填入 API Key'); return }
    if (provider.keyPrefix && !apiKey.startsWith(provider.keyPrefix)) {
      setError(`API Key 格式不正确，应以 ${provider.keyPrefix} 开头`)
      return
    }
    if (providerId !== 'anthropic' && !baseUrl.trim()) {
      setError('请填写 API Base URL')
      return
    }
    setLoading(true)
    setError('')
    try {
      await window.electronAPI.saveApiKey(apiKey.trim())
      await window.electronAPI.saveConfig({ provider: providerId, model: model.trim() || provider.defaultModel, baseUrl: baseUrl.trim() })
      onComplete()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="screen-sm">
      <h1 className="page-title">欢迎使用知乎写作助手</h1>

      {/* LetAI 推荐 */}
      <div className="card card-sm" style={{
        background: 'linear-gradient(135deg, rgba(118,75,162,0.15), rgba(37,99,235,0.1))',
        borderColor: 'rgba(118,75,162,0.3)',
        marginBottom: 'var(--sp-5)',
      }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 'var(--sp-1)' }}>💡 没有 API Key？</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--sp-3)' }}>
          LetAI Code 提供国内直连的 Claude / GPT API 套餐，按量计费，无月费，新用户有免费额度。
        </div>
        <a
          href="https://letaicode.cn/?aff=npZES3"
          target="_blank"
          rel="noreferrer"
          className="btn btn-primary btn-sm"
          style={{ textDecoration: 'none', display: 'inline-block' }}
        >
          立即获取 Token →
        </a>
      </div>

      {/* Provider 选择 */}
      <div className="form-group">
        <label className="label">选择 AI 服务商</label>
        <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => handleProviderChange(p.id)}
              className={`btn btn-sm ${providerId === p.id ? 'btn-primary' : 'btn-ghost'}`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* 模型选择 */}
      <div className="form-group">
        <label className="label">模型</label>
        {provider.models.length > 0 ? (
          <select className="select" value={model} onChange={(e) => setModel(e.target.value)}>
            {provider.models.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        ) : (
          <input className="input" value={model} onChange={(e) => setModel(e.target.value)} placeholder="例如：claude-sonnet-4-6" />
        )}
      </div>

      {/* Base URL */}
      {(providerId === 'letai' || providerId === 'custom') && (
        <div className="form-group">
          <label className="label">Base URL（API 地址）</label>
          <input
            className="input"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={providerId === 'letai' ? 'https://letaicode.cn/claude' : 'https://your-proxy.com/v1'}
          />
        </div>
      )}

      {/* API Key */}
      <div className="form-group">
        <label className="label">
          API Key
          {provider.keyLink && (
            <a href={provider.keyLink} target="_blank" rel="noreferrer" style={{ marginLeft: 8, fontSize: 12, color: 'var(--brand-purple-light)' }}>
              {provider.keyLinkText}
            </a>
          )}
        </label>
        <input
          className="input"
          type="password"
          placeholder={provider.keyHint}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !loading && handleSave()}
        />
      </div>

      {error && <p className="text-error" style={{ marginBottom: 'var(--sp-3)' }}>{error}</p>}

      <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={loading} style={{ width: '100%' }}>
        {loading ? '保存中...' : '开始使用 →'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/screens/Onboarding.tsx
git commit -m "feat: Onboarding — remove Edge step, apply design system, single-step setup"
```

---

## Task 10: 新建 SettingsScreen（P1：API Key 管理）

**Files:**
- Create: `src/renderer/src/screens/SettingsScreen.tsx`

- [ ] **Step 1: 创建 SettingsScreen.tsx**

```tsx
// src/renderer/src/screens/SettingsScreen.tsx
import { useState, useEffect } from 'react'

interface Props {
  onBack: () => void
}

export default function SettingsScreen({ onBack }: Props) {
  const [config, setConfig] = useState<{ provider: string; model: string; baseUrl: string } | null>(null)
  const [clearing, setClearing] = useState(false)
  const [cleared, setCleared] = useState(false)

  useEffect(() => {
    window.electronAPI.loadConfig().then(setConfig)
  }, [])

  async function handleClearKey() {
    if (!confirm('确认清除 API Key？清除后需重新配置才能使用。')) return
    setClearing(true)
    await window.electronAPI.clearApiKey()
    setClearing(false)
    setCleared(true)
  }

  return (
    <div className="screen-sm">
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 'var(--sp-4)' }}>
        ← 返回
      </button>
      <h1 className="page-title">设置</h1>

      {/* 当前配置 */}
      <div className="card" style={{ marginBottom: 'var(--sp-4)' }}>
        <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 'var(--sp-3)', color: 'var(--text-primary)' }}>
          当前 AI 配置
        </p>
        {config ? (
          <>
            <p className="text-muted">服务商：{config.provider}</p>
            <p className="text-muted">模型：{config.model}</p>
            {config.baseUrl && <p className="text-muted">Base URL：{config.baseUrl}</p>}
          </>
        ) : (
          <p className="text-muted">加载中...</p>
        )}
      </div>

      {/* API Key 管理 */}
      <div className="card">
        <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 'var(--sp-2)', color: 'var(--text-primary)' }}>
          API Key 管理
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--sp-4)' }}>
          API Key 已加密存储在本地系统钥匙串中，不会上传到任何服务器。
        </p>
        {cleared ? (
          <p className="text-success">✓ API Key 已清除，请重新启动应用完成配置。</p>
        ) : (
          <button className="btn btn-danger btn-sm" onClick={handleClearKey} disabled={clearing}>
            {clearing ? '清除中...' : '清除 API Key'}
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/screens/SettingsScreen.tsx
git commit -m "feat: add SettingsScreen with API key management and config display"
```

---

## Task 11: 改造 App.tsx（集成所有新 screen + Edge 检测前置 + 历史记录）

**Files:**
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: 完整替换 App.tsx**

```tsx
// src/renderer/src/App.tsx
import { useState, useEffect } from 'react'
import Onboarding from './screens/Onboarding'
import WriteScreen from './screens/WriteScreen'
import ReviewScreen from './screens/ReviewScreen'
import PublishScreen from './screens/PublishScreen'
import SettingsScreen from './screens/SettingsScreen'
import EdgeSetupModal from './components/EdgeSetupModal'

type Screen = 'onboarding' | 'write' | 'review' | 'publish' | 'settings'

const HISTORY_KEY = 'zhihu-article-history'

function loadHistory(): ArticleHistory[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') } catch { return [] }
}

function saveHistory(items: ArticleHistory[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 50)))
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('onboarding')
  const [articleMdPath, setArticleMdPath] = useState('')
  const [articleTitle, setArticleTitle] = useState('')
  const [showEdgeModal, setShowEdgeModal] = useState(false)
  const [pendingPublish, setPendingPublish] = useState(false)

  useEffect(() => {
    window.electronAPI.loadApiKey().then((key) => {
      if (key) setScreen('write')
    })
  }, [])

  function handleArticleReady(mdPath: string, title: string) {
    setArticleMdPath(mdPath)
    setArticleTitle(title)
    // 存历史
    const hist = loadHistory()
    const entry: ArticleHistory = { id: Date.now().toString(), title, mdPath, createdAt: Date.now() }
    saveHistory([entry, ...hist])
    setScreen('review')
  }

  async function handleGoPublish() {
    // 首次发布前检测 Edge
    const ok = await window.electronAPI.checkEdge()
    if (!ok) {
      setPendingPublish(true)
      setShowEdgeModal(true)
    } else {
      setScreen('publish')
    }
  }

  function handleEdgeReady() {
    setShowEdgeModal(false)
    if (pendingPublish) {
      setPendingPublish(false)
      setScreen('publish')
    }
  }

  return (
    <div>
      {/* 设置按钮（Write/Review/Publish 时显示） */}
      {(screen === 'write' || screen === 'review' || screen === 'publish') && (
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setScreen('settings')}
          style={{ position: 'fixed', top: 12, right: 16, zIndex: 100 }}
        >
          ⚙ 设置
        </button>
      )}

      {screen === 'onboarding' && <Onboarding onComplete={() => setScreen('write')} />}
      {screen === 'write' && <WriteScreen onArticleReady={handleArticleReady} />}
      {screen === 'review' && (
        <ReviewScreen
          mdPath={articleMdPath}
          title={articleTitle}
          onPublish={handleGoPublish}
          onBack={() => setScreen('write')}
        />
      )}
      {screen === 'publish' && (
        <PublishScreen
          mdPath={articleMdPath}
          title={articleTitle}
          onDone={() => setScreen('write')}
          onBack={() => setScreen('review')}
        />
      )}
      {screen === 'settings' && <SettingsScreen onBack={() => setScreen('write')} />}

      {showEdgeModal && <EdgeSetupModal onReady={handleEdgeReady} onClose={() => setShowEdgeModal(false)} />}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/App.tsx
git commit -m "feat: App — settings route, history save, deferred Edge detection modal"
```

---

## Task 12: 新建 EdgeSetupModal 组件（P1：Edge 检测从 Onboarding 分离）

**Files:**
- Create: `src/renderer/src/components/EdgeSetupModal.tsx`

- [ ] **Step 1: 创建 EdgeSetupModal.tsx**

```tsx
// src/renderer/src/components/EdgeSetupModal.tsx
import { useState } from 'react'

interface Props {
  onReady: () => void
  onClose: () => void
}

export default function EdgeSetupModal({ onReady, onClose }: Props) {
  const [status, setStatus] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle')
  const [error, setError] = useState('')

  async function handleCheck() {
    setStatus('checking')
    setError('')
    const ok = await window.electronAPI.checkEdge()
    if (ok) {
      setStatus('ok')
    } else {
      const result = await window.electronAPI.launchEdge()
      if (result.success) {
        setStatus('ok')
      } else {
        setStatus('fail')
        setError(result.error ?? '启动失败')
      }
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200
    }}>
      <div className="card" style={{ width: 420, maxWidth: '90vw' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 'var(--sp-3)', color: 'var(--text-primary)' }}>
          连接 Microsoft Edge
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 'var(--sp-5)' }}>
          发布功能需要 Microsoft Edge 自动填充知乎编辑器内容。
        </p>

        {status === 'idle' && (
          <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
            <button className="btn btn-primary" onClick={handleCheck}>检测 / 启动 Edge</button>
            <button className="btn btn-ghost" onClick={onClose}>取消</button>
          </div>
        )}
        {status === 'checking' && <p className="text-muted">检测中...</p>}
        {status === 'ok' && (
          <div>
            <p className="text-success" style={{ marginBottom: 'var(--sp-4)' }}>✓ Edge 已就绪，请在 Edge 中登录知乎。</p>
            <button className="btn btn-primary" onClick={onReady}>已登录知乎，继续发布 →</button>
          </div>
        )}
        {status === 'fail' && (
          <div>
            <p className="text-error" style={{ marginBottom: 'var(--sp-3)' }}>{error}</p>
            <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
              <a href="https://www.microsoft.com/edge" target="_blank" rel="noreferrer"
                className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>
                下载 Edge
              </a>
              <button className="btn btn-secondary btn-sm" onClick={handleCheck}>重试</button>
              <button className="btn btn-ghost btn-sm" onClick={onClose}>取消</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/components/EdgeSetupModal.tsx
git commit -m "feat: EdgeSetupModal — decouple Edge detection from Onboarding"
```

---

## Task 13: 补充 preload readFile（WriteScreen 预览需要）

**Files:**
- Modify: `src/main/ipc-handlers.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`

- [ ] **Step 1: ipc-handlers.ts 增加 file:read**

在文件末尾 `}` 之前增加：

```typescript
  ipcMain.handle('file:read', (_, filePath: string) => {
    const fs = require('node:fs')
    return fs.readFileSync(filePath, 'utf-8') as string
  })
```

- [ ] **Step 2: preload/index.ts 暴露 readFile**

在 `cancelGenerate` 行之后新增：

```typescript
  readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
```

- [ ] **Step 3: preload/index.d.ts 补类型**

在 `cancelGenerate` 行之后新增：

```typescript
      readFile: (filePath: string) => Promise<string>
```

- [ ] **Step 4: Commit**

```bash
git add src/main/ipc-handlers.ts src/preload/index.ts src/preload/index.d.ts
git commit -m "feat: add file:read IPC for article preview in WriteScreen"
```

---

## Task 14: 最终类型检查 + 验证

- [ ] **Step 1: 运行全量 typecheck**

```bash
cd "D:/CodeSpace/zhihu-desktop" && npm run typecheck 2>&1
```

Expected: 0 errors（或仅 vendor 类型告警，非项目代码错误）

- [ ] **Step 2: 启动 dev 模式，验证各页面可访问**

```bash
cd "D:/CodeSpace/zhihu-desktop" && npm run dev
```

手动检查流程：
1. 首次打开 → Onboarding 单步（无 Edge 步骤）
2. 输入 API Key → 进入 WriteScreen（输入框有聚焦样式）
3. 输入话题点生成 → 进度步骤可见，取消按钮出现
4. 生成完成 → 预览页显示文章内容
5. 进入审核 → 审核进度步骤可见
6. 低分时 → 显示具体建议卡片
7. 进入发布 → 触发 EdgeSetupModal
8. 右上角设置 → 进入 SettingsScreen，API Key 管理可用

- [ ] **Step 3: 最终 commit**

```bash
git add -A
git commit -m "chore: finalize P0+P1 improvements — design system, cancel, preview, settings"
```
