// src/renderer/src/screens/PublishScreen.tsx
import { useState, useEffect } from 'react'
import ProgressSteps from '../components/ProgressSteps'
import LogPanel, { type LogEntry } from '../components/LogPanel'
import { createLogEntryFromTaskEvent, getTaskErrorMessage, isTaskEventFor } from '../utils/task-events'

interface Props {
  mdPath: string
  title: string
  onDone: () => void
  onBack: () => void
}

interface CoverFileState {
  pngPath?: string
  svgPath?: string
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
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [autoSubmitted, setAutoSubmitted] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [zhihuState, setZhihuState] = useState<ZhihuLoginState | null>(null)
  const [checkingZhihuState, setCheckingZhihuState] = useState(false)
  const [coverFiles, setCoverFiles] = useState<CoverFileState | null>(null)

  useEffect(() => {
    const off = window.electronAPI.onTaskEvent((event) => {
      if (!isTaskEventFor('publish', event)) return
      if (event.type === 'step') {
        setActiveStep(Math.max(0, Math.min(PUBLISH_STEPS.length - 1, event.step - 1)))
      }
      const line = createLogEntryFromTaskEvent(event)
      if (!line) return
      setLogs((prev) => [...prev.slice(-79), line])
    })
    return off
  }, [])

  useEffect(() => {
    void refreshZhihuState()
  }, [])

  useEffect(() => {
    void detectCoverFiles()
  }, [mdPath])

  async function detectCoverFiles() {
    const basePath = mdPath.replace(/\.md$/i, '')
    const pngPath = `${basePath}.cover.png`
    const svgPath = `${basePath}.cover.svg`

    const [hasPng, hasSvg] = await Promise.all([
      window.electronAPI.fileExists(pngPath),
      window.electronAPI.fileExists(svgPath),
    ])

    if (!hasPng && !hasSvg) {
      setCoverFiles(null)
      return
    }

    setCoverFiles({
      pngPath: hasPng ? pngPath : undefined,
      svgPath: hasSvg ? svgPath : undefined,
    })
  }

  async function refreshZhihuState() {
    setCheckingZhihuState(true)
    try {
      const state = await window.electronAPI.getZhihuLoginState()
      setZhihuState(state)
    } finally {
      setCheckingZhihuState(false)
    }
  }

  async function handlePublish(autoSubmit: boolean) {
    const latestState = await window.electronAPI.getZhihuLoginState()
    setZhihuState(latestState)
    if (!latestState.loggedIn) {
      setStatus('error')
      setError(latestState.reason || '知乎未登录，请先在 Edge 中登录知乎后再发布')
      return
    }

    setAutoSubmitted(autoSubmit)
    setStatus('publishing')
    setError('')
    setLogs([])
    setActiveStep(0)
    try {
      await window.electronAPI.publishArticle(mdPath, autoSubmit)
      setStatus('done')
    } catch (e: any) {
      setError(getTaskErrorMessage(e))
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
          {coverFiles && (
            <div className="cover-upload-reminder" style={{ marginBottom: 'var(--sp-5)' }}>
              <div className="cover-upload-reminder__header">
                <div>
                  <p className="cover-upload-reminder__title">已生成封面文件</p>
                  <p className="cover-upload-reminder__hint">正文填充完成后，请在知乎编辑器中手动上传封面图片，再检查后发布。</p>
                </div>
                <span className="status-badge status-badge--success">可上传</span>
              </div>
              {coverFiles.pngPath && (
                <p className="cover-upload-reminder__path">PNG：{coverFiles.pngPath}</p>
              )}
              {coverFiles.svgPath && (
                <p className="cover-upload-reminder__path">SVG：{coverFiles.svgPath}</p>
              )}
              <p className="cover-upload-reminder__tip">建议优先上传 PNG；SVG 可作为留档源文件保留。</p>
            </div>
          )}
          <div className="login-state-card" style={{ marginBottom: 'var(--sp-5)' }}>
            <div className="login-state-card__header">
              <div>
                <p className="login-state-card__title">知乎登录状态</p>
                <p className="login-state-card__hint">
                  {checkingZhihuState
                    ? '检测中...'
                    : zhihuState?.loggedIn
                      ? `已同步 Edge 登录态${zhihuState.displayName ? `：${zhihuState.displayName}` : ''}`
                      : zhihuState?.reason || '尚未检测'}
                </p>
              </div>
              <span className={`status-badge ${zhihuState?.loggedIn ? 'status-badge--success' : 'status-badge--warning'}`}>
                {checkingZhihuState ? '检测中' : zhihuState?.loggedIn ? '已登录' : zhihuState?.edgeReady === false ? '未连接 Edge' : '未登录'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', marginTop: 'var(--sp-4)' }}>
              <button className="btn btn-ghost btn-sm" onClick={refreshZhihuState} disabled={checkingZhihuState}>
                刷新登录状态
              </button>
              {!zhihuState?.loggedIn && (
                <p className="text-muted" style={{ margin: 0, alignSelf: 'center' }}>
                  请先在 Edge 中登录知乎，再回来点击发布。
                </p>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
            <button className="btn btn-secondary" onClick={() => handlePublish(false)} disabled={checkingZhihuState || !zhihuState?.loggedIn}>
              填充内容（我来点发布）
            </button>
            <button className="btn btn-primary" onClick={() => handlePublish(true)} disabled={checkingZhihuState || !zhihuState?.loggedIn}>
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
              : `请切换到 Edge，检查内容${coverFiles?.pngPath ? '并上传封面图片后' : '后'}手动点击发布按钮。`}
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
