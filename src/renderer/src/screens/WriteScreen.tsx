// src/renderer/src/screens/WriteScreen.tsx
import { useState, useEffect, useRef } from 'react'
import ProgressSteps from '../components/ProgressSteps'
import MarkdownPreview from '../components/MarkdownPreview'
import LogPanel, { type LogEntry } from '../components/LogPanel'

interface Props {
  history: ArticleHistory[]
  onArticleReady: (mdPath: string, title: string, topic?: string) => void
  onDeleteHistory: (id: string) => void
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

function extractTitleFromMarkdown(content: string, fallbackTitle: string): string {
  const titleMatch = content.match(/^#\s+(.+)$/m)
  return titleMatch?.[1]?.trim() || fallbackTitle
}

function normalizeTopic(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('zh-CN')
}

function formatHistoryDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function WriteScreen({ history, onArticleReady, onDeleteHistory }: Props) {
  const [topic, setTopic] = useState('')
  const [generating, setGenerating] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [error, setError] = useState('')
  const [previewContent, setPreviewContent] = useState('')
  const [originalPreviewContent, setOriginalPreviewContent] = useState('')
  const [previewTitle, setPreviewTitle] = useState('')
  const [previewMdPath, setPreviewMdPath] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [savingPreview, setSavingPreview] = useState(false)
  const [selectedHistory, setSelectedHistory] = useState<ArticleHistory | null>(null)
  const [historyPreviewContent, setHistoryPreviewContent] = useState('')
  const [historyPreviewError, setHistoryPreviewError] = useState('')
  const [loadingHistoryPreview, setLoadingHistoryPreview] = useState(false)
  const [historySearch, setHistorySearch] = useState('')
  const [showAllHistory, setShowAllHistory] = useState(false)
  const cancelledRef = useRef(false)

  const normalizedTopic = normalizeTopic(topic)
  const matchedHistory = normalizedTopic
    ? history.find((item) => normalizeTopic(item.topic || item.title) === normalizedTopic)
    : null
  const normalizedHistorySearch = normalizeTopic(historySearch)
  const filteredHistory = normalizedHistorySearch
    ? history.filter((item) => {
      const searchTarget = `${item.title} ${item.topic || ''} ${item.mdPath}`
      return normalizeTopic(searchTarget).includes(normalizedHistorySearch)
    })
    : history
  const visibleHistory = showAllHistory || normalizedHistorySearch ? filteredHistory : filteredHistory.slice(0, 6)

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

  async function runGeneration() {
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
        setOriginalPreviewContent(text)
      } catch {
        setPreviewContent('')
        setOriginalPreviewContent('')
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

  async function handleConfirmPreview() {
    setSavingPreview(true)
    setError('')
    try {
      const nextTitle = extractTitleFromMarkdown(previewContent, previewTitle)
      await window.electronAPI.writeFile(previewMdPath, previewContent)
      setPreviewTitle(nextTitle)
      onArticleReady(previewMdPath, nextTitle, topic.trim())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSavingPreview(false)
    }
  }

  async function handleUseHistory(entry: ArticleHistory) {
    setError('')
    try {
      await window.electronAPI.readFile(entry.mdPath)
      onArticleReady(entry.mdPath, entry.title, entry.topic || topic.trim())
    } catch (e: any) {
      setError(e.message || '历史文章读取失败，请强制重新生成')
    }
  }

  async function handleBrowseHistory(entry: ArticleHistory) {
    setSelectedHistory(entry)
    setLoadingHistoryPreview(true)
    setHistoryPreviewError('')
    setHistoryPreviewContent('')
    try {
      const content = await window.electronAPI.readFile(entry.mdPath)
      setHistoryPreviewContent(content)
    } catch (e: any) {
      setHistoryPreviewError(e.message || '读取历史文章失败')
    } finally {
      setLoadingHistoryPreview(false)
    }
  }

  async function handleDeleteHistory(entry: ArticleHistory) {
    const confirmed = confirm(`确认删除这条历史记录并同时删除本地 Markdown 文件？\n\n《${entry.title}》\n${entry.mdPath}`)
    if (!confirmed) return

    setError('')
    try {
      await window.electronAPI.deleteFile(entry.mdPath)
      onDeleteHistory(entry.id)
      if (selectedHistory?.id === entry.id) {
        setSelectedHistory(null)
        setHistoryPreviewContent('')
        setHistoryPreviewError('')
      }
    } catch (e: any) {
      setError(e.message || '删除历史记录失败')
    }
  }

  async function handlePrimaryAction(forceRegenerate = false) {
    if (!topic.trim()) return
    if (matchedHistory && !forceRegenerate) {
      await handleUseHistory(matchedHistory)
      return
    }
    await runGeneration()
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
      <div className="screen screen-wide">
        <h1 className="page-title">预览文章</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 'var(--sp-4)', marginTop: -16 }}>
          《{previewTitle}》
        </p>
        <div className="card card-sm" style={{ marginBottom: 'var(--sp-4)' }}>
          <p className="text-muted" style={{ marginBottom: 'var(--sp-1)' }}>文件路径</p>
          <p style={{ margin: 0, color: 'var(--text-secondary)', wordBreak: 'break-all', fontSize: 13 }}>{previewMdPath}</p>
        </div>
        <div className="preview-layout">
          <div className="card preview-editor-card">
            <div className="preview-card__header">
              <div>
                <p className="preview-card__title">Markdown 原文</p>
                <p className="preview-card__hint">这里可以人工修改内容，保存后再进入审核。</p>
              </div>
              {previewContent !== originalPreviewContent && (
                <button className="btn btn-ghost btn-sm" onClick={() => setPreviewContent(originalPreviewContent)}>
                  恢复原稿
                </button>
              )}
            </div>
            <textarea
              className="markdown-editor"
              value={previewContent}
              onChange={(event) => setPreviewContent(event.target.value)}
              spellCheck={false}
            />
          </div>
          <div className="card preview-render-card">
            <div className="preview-card__header">
              <div>
                <p className="preview-card__title">渲染预览</p>
                <p className="preview-card__hint">右侧实时展示修改后的文章效果。</p>
              </div>
            </div>
            <MarkdownPreview content={previewContent || '（文章内容为空）'} maxHeight={560} />
          </div>
        </div>
        {error && <p className="text-error" style={{ marginTop: 'var(--sp-4)' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-6)' }}>
          <button className="btn btn-secondary" onClick={() => setShowPreview(false)}>
            ← 重新生成
          </button>
          <button className="btn btn-primary btn-lg" onClick={handleConfirmPreview} disabled={savingPreview}>
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
          onKeyDown={(e) => e.key === 'Enter' && !generating && handlePrimaryAction()}
          disabled={generating}
          style={{ fontSize: 16, padding: '12px 14px' }}
        />
      </div>

      {matchedHistory && (
        <div className="card card-sm history-match-card">
          <div>
            <p className="history-match-card__title">检测到同主题历史文章</p>
            <p className="history-match-card__hint">
              上次生成时间：{formatHistoryDate(matchedHistory.createdAt)}，默认直接复用这篇稿子，不再重复生成。
            </p>
          </div>
          <div className="history-match-card__actions">
            <button className="btn btn-secondary btn-sm" onClick={() => handleBrowseHistory(matchedHistory)} disabled={generating}>
              浏览历史
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => handlePrimaryAction(true)} disabled={generating}>
              强制重新生成
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
        <button
          className="btn btn-primary btn-lg"
          onClick={() => handlePrimaryAction()}
          disabled={generating || !topic.trim()}
          style={{ flex: 1 }}
        >
          {generating ? '生成中...' : matchedHistory ? '使用历史文章' : '生成文章'}
        </button>
        {generating && (
          <button className="btn btn-danger" onClick={handleCancel}>
            取消
          </button>
        )}
      </div>

      {error && <p className="text-error" style={{ marginTop: 'var(--sp-4)' }}>{error}</p>}

      <div className="card" style={{ marginTop: 'var(--sp-6)' }}>
        <div className="history-card__header">
          <div>
            <p className="history-card__title">历史文章记录</p>
            <p className="history-card__hint">支持搜索、删除单条和展开全部列表。删除时会同步删除本地 Markdown 文件。</p>
          </div>
          <div className="history-toolbar">
            <input
              className="input history-search-input"
              placeholder="搜索标题、主题或文件路径"
              value={historySearch}
              onChange={(event) => setHistorySearch(event.target.value)}
            />
            {filteredHistory.length > 6 && !normalizedHistorySearch && (
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAllHistory((prev) => !prev)}>
                {showAllHistory ? '收起列表' : '显示全部'}
              </button>
            )}
          </div>
        </div>
        {history.length > 0 && (
          <p className="text-muted" style={{ marginTop: 0, marginBottom: 'var(--sp-4)' }}>
            共 {history.length} 条记录，当前显示 {visibleHistory.length} 条。
          </p>
        )}
        {filteredHistory.length === 0 ? (
          <p className="text-muted" style={{ margin: 0 }}>
            {history.length === 0 ? '还没有历史文章记录，先生成一篇再回来查看。' : '没有匹配的历史记录。'}
          </p>
        ) : (
          <div className="history-list">
            {visibleHistory.map((entry) => {
              const isMatched = matchedHistory?.mdPath === entry.mdPath
              return (
                <div key={entry.id} className={`history-item${isMatched ? ' history-item--matched' : ''}`}>
                  <div className="history-item__body">
                    <p className="history-item__title">{entry.title}</p>
                    <p className="history-item__meta">
                      主题：{entry.topic || '未记录'} · 保存于 {formatHistoryDate(entry.createdAt)}
                    </p>
                    <p className="history-item__path">{entry.mdPath}</p>
                  </div>
                  <div className="history-item__actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => handleBrowseHistory(entry)}>
                      浏览
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleUseHistory(entry)}>
                      使用
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteHistory(entry)}>
                      删除记录
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {generating && (
        <div className="card" style={{ marginTop: 'var(--sp-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-4)', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 4 }}>当前阶段</p>
              <p style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 700 }}>{activeStepLabel}</p>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>最近 {logs.length} 条日志</p>
          </div>
          <div className="activity-grid">
            <div className="activity-grid__column">
              <ProgressSteps steps={steps} />
            </div>
            <div className="activity-grid__column">
              <LogPanel logs={logs} emptyText="等待脚本输出日志..." defaultShowImportantOnly />
            </div>
          </div>
        </div>
      )}

      {selectedHistory && (
        <div className="settings-overlay">
          <div className="settings-overlay__backdrop" onClick={() => setSelectedHistory(null)} />
          <div className="settings-overlay__panel history-preview-overlay">
            <div className="screen screen-wide" style={{ padding: 'var(--sp-6)' }}>
              <div className="history-preview__header">
                <div>
                  <h2 className="page-title" style={{ marginBottom: 'var(--sp-2)' }}>历史文章浏览</h2>
                  <p className="history-item__meta" style={{ margin: 0 }}>
                    主题：{selectedHistory.topic || '未记录'} · 保存于 {formatHistoryDate(selectedHistory.createdAt)}
                  </p>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setSelectedHistory(null)}>
                  关闭
                </button>
              </div>
              <div className="card card-sm" style={{ marginBottom: 'var(--sp-4)' }}>
                <p className="text-muted" style={{ marginBottom: 'var(--sp-1)' }}>文件路径</p>
                <p style={{ margin: 0, color: 'var(--text-secondary)', wordBreak: 'break-all', fontSize: 13 }}>{selectedHistory.mdPath}</p>
              </div>
              {loadingHistoryPreview ? (
                <div className="card">
                  <p className="text-muted" style={{ margin: 0 }}>读取历史文章中...</p>
                </div>
              ) : historyPreviewError ? (
                <div className="card">
                  <p className="text-error" style={{ margin: 0 }}>{historyPreviewError}</p>
                </div>
              ) : (
                <div className="card">
                  <MarkdownPreview content={historyPreviewContent || '（文章内容为空）'} maxHeight={520} />
                </div>
              )}
              <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-5)' }}>
                <button className="btn btn-secondary" onClick={() => handleUseHistory(selectedHistory)} disabled={loadingHistoryPreview || !!historyPreviewError}>
                  使用此稿进入审核
                </button>
                <button className="btn btn-ghost" onClick={() => setSelectedHistory(null)}>
                  关闭浏览
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
