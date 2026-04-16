// src/renderer/src/screens/WriteScreen.tsx
import { useState, useEffect, useRef } from 'react'
import ProgressSteps from '../components/ProgressSteps'
import MarkdownPreview from '../components/MarkdownPreview'
import LogPanel, { type LogEntry } from '../components/LogPanel'

interface Props {
  onArticleReady: (mdPath: string, title: string) => void
}

const WRITE_STEPS = [
  { label: '整理写作要求' },
  { label: '构建提示词' },
  { label: '流式生成正文' },
  { label: '保存文章文件' },
  { label: '生成完成' },
]

function normalizeLogLine(message: string): string | null {
  const line = message.trim()
  if (!line || line.startsWith('__RESULT__')) return null
  return line
}

function parseWriteLog(msg: string): { step?: number; line?: LogEntry } {
  const line = normalizeLogLine(msg)
  if (!line) return {}

  const stepMatch = line.match(/^__STEP__write:(\d+):(.+)$/)
  if (stepMatch) {
    const step = Number(stepMatch[1])
    const label = stepMatch[2].trim()
    return {
      step,
      line: { message: `阶段更新：${label}`, timestamp: Date.now(), important: true, tone: 'step' },
    }
  }

  if (line.startsWith('✓ ')) {
    return { line: { message: line, timestamp: Date.now(), important: true, tone: 'success' } }
  }
  if (line.startsWith('✗ ') || line.startsWith('Error:')) {
    return { line: { message: line, timestamp: Date.now(), important: true, tone: 'error' } }
  }
  if (line.startsWith('⚠ ')) {
    return { line: { message: line, timestamp: Date.now(), important: true, tone: 'warning' } }
  }
  if (line.startsWith('▶ ') || line.startsWith('使用模型：') || line.startsWith('写作中：') || line.startsWith('阶段 ')) {
    return { line: { message: line, timestamp: Date.now(), important: true, tone: 'info' } }
  }

  return { line: { message: line, timestamp: Date.now(), important: false, tone: 'neutral' } }
}

export default function WriteScreen({ onArticleReady }: Props) {
  const [topic, setTopic] = useState('')
  const [generating, setGenerating] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [error, setError] = useState('')
  const [previewContent, setPreviewContent] = useState('')
  const [previewTitle, setPreviewTitle] = useState('')
  const [previewMdPath, setPreviewMdPath] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const cancelledRef = useRef(false)

  useEffect(() => {
    const off = window.electronAPI.onScriptLog((msg) => {
      const parsed = parseWriteLog(msg)
      if (parsed.step) {
        setActiveStep(Math.max(0, Math.min(WRITE_STEPS.length - 1, parsed.step - 1)))
      }
      if (!parsed.line) return
      setLogs((prev) => [...prev.slice(-79), parsed.line!])
    })
    return off
  }, [])

  async function handleGenerate() {
    if (!topic.trim()) return
    cancelledRef.current = false
    setGenerating(true)
    setError('')
    setLogs([])
    setActiveStep(0)
    setShowPreview(false)
    try {
      const result = await window.electronAPI.generateArticle(topic.trim())
      if (cancelledRef.current) return
      try {
        const text = await window.electronAPI.readFile(result.mdPath)
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

  const activeStepLabel = WRITE_STEPS[activeStep]?.label ?? '准备中'
  const steps = WRITE_STEPS.map((s, i) => ({
    label: s.label,
    status: (
      !generating && logs.length === 0 ? 'pending' :
      !generating && showPreview ? 'done' :
      i < activeStep ? 'done' :
      i === activeStep ? 'active' :
      'pending'
    ) as 'pending' | 'active' | 'done' | 'error',
  }))

  if (showPreview) {
    return (
      <div className="screen">
        <h1 className="page-title">预览文章</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 'var(--sp-4)', marginTop: -16 }}>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-4)', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 4 }}>当前阶段</p>
              <p style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 700 }}>{activeStepLabel}</p>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>最近 {logs.length} 条日志</p>
          </div>
          <ProgressSteps steps={steps} />
          <div style={{ marginTop: 'var(--sp-5)' }}>
            <LogPanel logs={logs} emptyText="等待脚本输出日志..." />
          </div>
        </div>
      )}
    </div>
  )
}
