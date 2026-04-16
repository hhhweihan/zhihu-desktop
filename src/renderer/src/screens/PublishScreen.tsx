// src/renderer/src/screens/PublishScreen.tsx
import { useState, useEffect } from 'react'
import ProgressSteps from '../components/ProgressSteps'
import LogPanel, { type LogEntry } from '../components/LogPanel'

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

function parsePublishLog(msg: string): { step?: number; line?: LogEntry } {
  const line = msg.trim()
  if (!line) return {}

  const stepMatch = line.match(/^__STEP__publish:(\d+):(.+)$/)
  if (stepMatch) {
    const step = Number(stepMatch[1])
    const label = stepMatch[2].trim()
    return { step, line: { message: `阶段更新：${label}`, timestamp: Date.now(), important: true, tone: 'step' } }
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
  if (line.startsWith('▶ ')) {
    return { line: { message: line, timestamp: Date.now(), important: true, tone: 'info' } }
  }

  return {
    line: {
      message: line,
      timestamp: Date.now(),
      important: false,
      tone: 'neutral',
    },
  }
}

export default function PublishScreen({ mdPath, title, onDone, onBack }: Props) {
  const [status, setStatus] = useState<'idle' | 'publishing' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [autoSubmitted, setAutoSubmitted] = useState(false)
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    const off = window.electronAPI.onScriptLog((msg) => {
      const parsed = parsePublishLog(msg)
      if (parsed.step) {
        setActiveStep(Math.max(0, Math.min(PUBLISH_STEPS.length - 1, parsed.step - 1)))
      }
      if (!parsed.line) return
      setLogs((prev) => [...prev.slice(-79), parsed.line!])
    })
    return off
  }, [])

  async function handlePublish(autoSubmit: boolean) {
    setAutoSubmitted(autoSubmit)
    setStatus('publishing')
    setError('')
    setLogs([])
    setActiveStep(0)
    try {
      await window.electronAPI.publishArticle(mdPath, autoSubmit)
      setStatus('done')
    } catch (e: any) {
      setError(e.message)
      setStatus('error')
    }
  }

  const publishSteps = PUBLISH_STEPS.map((s, i) => {
    return {
      label: s.label,
      status: (
        status === 'done' ? 'done' :
        i < activeStep ? 'done' :
        i === activeStep ? 'active' :
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

      {(status === 'publishing' || status === 'done' || status === 'error') && (
        <div style={{ marginTop: 'var(--sp-4)' }}>
          <LogPanel logs={logs} title="发布日志" emptyText="等待发布脚本输出日志..." maxHeight={260} />
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
              ? '你的文章已自动提交到知乎，稍后可在「我的内容」查看。'
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
