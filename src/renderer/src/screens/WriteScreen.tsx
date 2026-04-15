// src/renderer/src/screens/WriteScreen.tsx
import { useState, useEffect, useRef } from 'react'
import ProgressSteps from '../components/ProgressSteps'
import MarkdownPreview from '../components/MarkdownPreview'

interface Props {
  onArticleReady: (mdPath: string, title: string) => void
}

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
          <ProgressSteps steps={steps} />
        </div>
      )}
    </div>
  )
}
