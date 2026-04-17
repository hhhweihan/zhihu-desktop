// src/renderer/src/screens/WriteScreen.tsx
import { useState, useEffect, useRef } from 'react'
import ProgressSteps from '../components/ProgressSteps'
import MarkdownPreview from '../components/MarkdownPreview'
import LogPanel, { type LogEntry } from '../components/LogPanel'
import { createLogEntryFromTaskEvent, getTaskErrorMessage, isTaskEventFor } from '../utils/task-events'

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

const HISTORY_PANEL_VISIBILITY_KEY = 'zhihu-history-panel-visible'
const COVER_TEMPLATE_OPTIONS: Array<{ value: CoverTemplate; label: string; description: string }> = [
  { value: 'comparison', label: '对比型', description: '适合方案对比、路线选择、成本分析类文章' },
  { value: 'minimalist', label: '极简型', description: '适合概念讲解、总结盘点和轻量教程' },
  { value: 'feature', label: '主视觉型', description: '适合教程、实战指南和能力介绍类文章' },
]

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

function loadHistoryPanelVisible(): boolean {
  try {
    const saved = localStorage.getItem(HISTORY_PANEL_VISIBILITY_KEY)
    return saved === null ? true : saved === 'true'
  } catch {
    return true
  }
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
  const [showHistoryPanel, setShowHistoryPanel] = useState(loadHistoryPanelVisible)
  const [planOptions, setPlanOptions] = useState<ArticlePlan[]>([])
  const [planError, setPlanError] = useState('')
  const [loadingPlans, setLoadingPlans] = useState(false)
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(0)
  const [planTopic, setPlanTopic] = useState('')
  const [assistCover, setAssistCover] = useState(false)
  const [coverTemplate, setCoverTemplate] = useState<CoverTemplate>('comparison')
  const [coverTitle, setCoverTitle] = useState('')
  const [coverSubtitle, setCoverSubtitle] = useState('')
  const [generatingCover, setGeneratingCover] = useState(false)
  const [coverError, setCoverError] = useState('')
  const [coverResult, setCoverResult] = useState<CoverGenerationResult | null>(null)
  const cancelledRef = useRef(false)

  const normalizedTopic = normalizeTopic(topic)
  const hasTypedTopic = topic.trim().length > 0
  const hasCurrentPlanOptions = normalizedTopic.length > 0 && planTopic === normalizedTopic && planOptions.length > 0
  const selectedPlan = hasCurrentPlanOptions ? planOptions[selectedPlanIndex] ?? planOptions[0] ?? null : null
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
  const shouldShowHistoryLibrary = !hasTypedTopic

  useEffect(() => {
    const off = window.electronAPI.onTaskEvent((event) => {
      if (!isTaskEventFor('generate', event)) return
      if (event.type === 'step') {
        setActiveStep(Math.max(0, Math.min(WRITE_STEPS.length - 1, event.step - 1)))
      }
      const line = createLogEntryFromTaskEvent(event)
      if (!line) return
      setLogs((prev) => [...prev.slice(-79), line])
    })
    return off
  }, [])

  useEffect(() => {
    if (!selectedHistory) {
      return
    }

    const stillExists = history.some((item) => item.id === selectedHistory.id)
    if (!stillExists) {
      setSelectedHistory(null)
      setHistoryPreviewContent('')
      setHistoryPreviewError('')
    }
  }, [history, selectedHistory])

  useEffect(() => {
    if (!normalizedTopic) {
      setPlanOptions([])
      setSelectedPlanIndex(0)
      setPlanError('')
      setPlanTopic('')
      return
    }

    if (planTopic && planTopic !== normalizedTopic) {
      setPlanOptions([])
      setSelectedPlanIndex(0)
      setPlanError('')
      setPlanTopic('')
    }
  }, [normalizedTopic, planTopic])

  async function requestPlanOptions() {
    if (!topic.trim()) return

    setLoadingPlans(true)
    setPlanError('')
    setError('')

    try {
      const nextPlans = await window.electronAPI.suggestArticlePlans(topic.trim())
      setPlanOptions(nextPlans)
      setSelectedPlanIndex(0)
      setPlanTopic(normalizedTopic)
    } catch (e: any) {
      setPlanOptions([])
      setSelectedPlanIndex(0)
      setPlanTopic('')
      setPlanError(e.message || '获取标题方案失败')
    } finally {
      setLoadingPlans(false)
    }
  }

  async function runGeneration(plan?: ArticlePlan) {
    if (!topic.trim()) return
    cancelledRef.current = false
    setGenerating(true)
    setError('')
    setLogs([])
    setActiveStep(0)
    setShowPreview(false)
    try {
      const result = await window.electronAPI.generateArticle(topic.trim(), plan)
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
      setAssistCover(false)
      setCoverTemplate('comparison')
      setCoverTitle(result.title)
      setCoverSubtitle('')
      setCoverError('')
      setCoverResult(null)
      setShowPreview(true)
    } catch (e: any) {
      if (!cancelledRef.current) setError(getTaskErrorMessage(e))
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
      if (!coverTitle.trim()) {
        setCoverTitle(nextTitle)
      }
      onArticleReady(previewMdPath, nextTitle, topic.trim())
    } catch (e: any) {
      setError(getTaskErrorMessage(e))
    } finally {
      setSavingPreview(false)
    }
  }

  async function handleGenerateCover() {
    if (!previewMdPath) return

    setGeneratingCover(true)
    setCoverError('')
    try {
      await window.electronAPI.writeFile(previewMdPath, previewContent)
      const result = await window.electronAPI.generateArticleCover({
        mdPath: previewMdPath,
        template: coverTemplate,
        title: coverTitle.trim() || previewTitle,
        subtitle: coverSubtitle.trim() || undefined,
      })
      setCoverTitle(result.title)
      setCoverSubtitle(result.subtitle || '')
      setCoverResult(result)
    } catch (e: any) {
      setCoverError(getTaskErrorMessage(e))
    } finally {
      setGeneratingCover(false)
    }
  }

  async function handleUseHistory(entry: ArticleHistory) {
    setError('')
    try {
      const exists = await window.electronAPI.fileExists(entry.mdPath)
      if (!exists) {
        onDeleteHistory(entry.id)
        setError('历史文章对应的本地 Markdown 文件已不存在，已从列表移除')
        return
      }

      await window.electronAPI.readFile(entry.mdPath)
      onArticleReady(entry.mdPath, entry.title, entry.topic || topic.trim())
    } catch (e: any) {
      setError(getTaskErrorMessage(e) || '历史文章读取失败，请强制重新生成')
    }
  }

  async function handleBrowseHistory(entry: ArticleHistory) {
    try {
      const exists = await window.electronAPI.fileExists(entry.mdPath)
      if (!exists) {
        onDeleteHistory(entry.id)
        setError('历史文章对应的本地 Markdown 文件已不存在，已从列表移除')
        return
      }

      setSelectedHistory(entry)
      setLoadingHistoryPreview(true)
      setHistoryPreviewError('')
      setHistoryPreviewContent('')
      const content = await window.electronAPI.readFile(entry.mdPath)
      setHistoryPreviewContent(content)
    } catch (e: any) {
      setHistoryPreviewError(getTaskErrorMessage(e) || '读取历史文章失败')
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
      setError(getTaskErrorMessage(e) || '删除历史记录失败')
    }
  }

  function handleToggleHistoryPanel() {
    setShowHistoryPanel((prev) => {
      const next = !prev
      try {
        localStorage.setItem(HISTORY_PANEL_VISIBILITY_KEY, String(next))
      } catch {
        // Ignore storage failures and keep the in-memory state.
      }
      return next
    })
  }

  async function handlePrimaryAction(forceRegenerate = false) {
    if (!topic.trim()) return

    if (matchedHistory && !forceRegenerate) {
      if (!hasCurrentPlanOptions) {
        await handleUseHistory(matchedHistory)
        return
      }
    }

    if (!hasCurrentPlanOptions) {
      await requestPlanOptions()
      return
    }

    await runGeneration(selectedPlan ?? undefined)
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
        <div className="card cover-card" style={{ marginBottom: 'var(--sp-4)' }}>
          <div className="cover-card__header">
            <div>
              <p className="preview-card__title">封面图片</p>
              <p className="preview-card__hint">你可以决定是否让我协助生成并保存一张本地封面，文件会保存到文章同目录。</p>
            </div>
          </div>

          <div className="cover-mode-toggle">
            <button
              type="button"
              className={`cover-mode-toggle__item${assistCover ? '' : ' cover-mode-toggle__item--active'}`}
              onClick={() => {
                setAssistCover(false)
                setCoverError('')
              }}
            >
              暂不生成封面
            </button>
            <button
              type="button"
              className={`cover-mode-toggle__item${assistCover ? ' cover-mode-toggle__item--active' : ''}`}
              onClick={() => {
                setAssistCover(true)
                if (!coverTitle.trim()) {
                  setCoverTitle(previewTitle)
                }
              }}
            >
              协助生成并保存封面
            </button>
          </div>

          {assistCover && (
            <>
              <div className="cover-template-grid">
                {COVER_TEMPLATE_OPTIONS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={`cover-template-card${coverTemplate === item.value ? ' cover-template-card--active' : ''}`}
                    onClick={() => setCoverTemplate(item.value)}
                  >
                    <p className="cover-template-card__title">{item.label}</p>
                    <p className="cover-template-card__desc">{item.description}</p>
                  </button>
                ))}
              </div>

              <div className="cover-form-grid">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="label">封面标题</label>
                  <input
                    className="input"
                    value={coverTitle}
                    onChange={(event) => setCoverTitle(event.target.value)}
                    placeholder="默认使用文章标题"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="label">封面副标题</label>
                  <input
                    className="input"
                    value={coverSubtitle}
                    onChange={(event) => setCoverSubtitle(event.target.value)}
                    placeholder="可选，不填则由模板使用默认副标题"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', marginTop: 'var(--sp-4)' }}>
                <button className="btn btn-secondary" onClick={handleGenerateCover} disabled={generatingCover}>
                  {generatingCover ? '生成中...' : coverResult ? '重新生成封面' : '生成封面并保存'}
                </button>
                <p className="text-muted" style={{ margin: 0, alignSelf: 'center' }}>
                  生成后会保存 `.cover.svg` 和 `.cover.png` 两个文件。
                </p>
              </div>

              {coverError && <p className="text-error" style={{ marginTop: 'var(--sp-4)', marginBottom: 0 }}>{coverError}</p>}

              {coverResult && (
                <div className="cover-preview-panel">
                  <div className="cover-preview-panel__meta">
                    <p className="text-success" style={{ marginTop: 0 }}>封面已生成并保存</p>
                    <p className="text-muted" style={{ marginBottom: 'var(--sp-2)' }}>SVG：{coverResult.svgPath}</p>
                    <p className="text-muted" style={{ marginBottom: 0 }}>PNG：{coverResult.pngPath}</p>
                  </div>
                  <div className="cover-preview-frame">
                    <img src={coverResult.previewDataUrl} alt="生成的封面预览" className="cover-preview-image" />
                  </div>
                </div>
              )}
            </>
          )}
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
    <div className={`screen${generating || hasCurrentPlanOptions ? ' screen-wide' : ''}`}>
      <h1 className="page-title">写一篇知乎文章</h1>

      <div className="form-group">
        <input
          className="input"
          placeholder="输入文章主题，例如：C++ 内存泄漏排查实战"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !generating && !loadingPlans && handlePrimaryAction()}
          disabled={generating}
          style={{ fontSize: 16, padding: '12px 14px' }}
        />
      </div>

      {matchedHistory && (
        <div className="card card-sm history-match-card">
          <div>
            <p className="history-match-card__title">检测到同主题历史文章</p>
            <p className="history-match-card__hint">
              上次生成时间：{formatHistoryDate(matchedHistory.createdAt)}，默认直接复用这篇稿子；如果要写新稿，先点“强制重新生成”选择标题方案。
            </p>
          </div>
          <div className="history-match-card__actions">
            <button className="btn btn-secondary btn-sm" onClick={() => handleBrowseHistory(matchedHistory)} disabled={generating || loadingPlans}>
              浏览历史
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => handlePrimaryAction(true)} disabled={generating || loadingPlans}>
              强制重新生成
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
        <button
          className="btn btn-primary btn-lg"
          onClick={() => handlePrimaryAction()}
          disabled={generating || loadingPlans || !topic.trim()}
          style={{ flex: 1 }}
        >
          {generating ? '生成中...' : loadingPlans ? '方案生成中...' : matchedHistory && !hasCurrentPlanOptions ? '使用历史文章' : hasCurrentPlanOptions ? '按所选方案生成' : '获取标题方案'}
        </button>
        {generating && (
          <button className="btn btn-danger" onClick={handleCancel}>
            取消
          </button>
        )}
      </div>

      {error && <p className="text-error" style={{ marginTop: 'var(--sp-4)' }}>{error}</p>}

      {hasTypedTopic && !generating && (
        <div className="card suggestion-card" style={{ marginTop: 'var(--sp-6)' }}>
          <div className="suggestion-card__header">
            <div>
              <p className="suggestion-card__title">标题与大纲建议</p>
              <p className="suggestion-card__hint">先确认方向，再生成正文。这里会保留 2-3 套不同切入角度的方案。</p>
            </div>
            <div className="suggestion-card__actions">
              <button className="btn btn-ghost btn-sm" onClick={requestPlanOptions} disabled={loadingPlans}>
                {hasCurrentPlanOptions ? '重新出方案' : '获取方案'}
              </button>
              {hasCurrentPlanOptions && (
                <button className="btn btn-secondary btn-sm" onClick={() => runGeneration()} disabled={loadingPlans}>
                  跳过方案直接生成
                </button>
              )}
            </div>
          </div>

          {planError && (
            <div style={{ marginBottom: 'var(--sp-4)' }}>
              <p className="text-error" style={{ marginTop: 0, marginBottom: 'var(--sp-3)' }}>{planError}</p>
              <button className="btn btn-secondary btn-sm" onClick={requestPlanOptions} disabled={loadingPlans}>
                {loadingPlans ? '重试中...' : '重试获取方案'}
              </button>
            </div>
          )}

          {loadingPlans ? (
            <div className="suggestion-empty-state">
              <p className="suggestion-empty-state__title">正在生成标题和大纲建议...</p>
              <p className="suggestion-empty-state__hint">通常几秒内返回，生成后可直接选择其中一个方案继续。</p>
            </div>
          ) : hasCurrentPlanOptions ? (
            <div className="suggestion-grid">
              {planOptions.map((plan, index) => (
                <button
                  key={`${plan.title}-${index}`}
                  type="button"
                  className={`suggestion-option${selectedPlanIndex === index ? ' suggestion-option--selected' : ''}`}
                  onClick={() => setSelectedPlanIndex(index)}
                >
                  <div className="suggestion-option__badge">方案 {index + 1}</div>
                  <p className="suggestion-option__title">{plan.title}</p>
                  <p className="suggestion-option__angle">{plan.angle}</p>
                  <div className="suggestion-option__outline">
                    {plan.outline.map((item, outlineIndex) => (
                      <p key={`${item}-${outlineIndex}`} className="suggestion-option__outline-item">
                        {outlineIndex + 1}. {item}
                      </p>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="suggestion-empty-state">
              <p className="suggestion-empty-state__title">先出 2-3 个标题和大纲方案</p>
              <p className="suggestion-empty-state__hint">输入主题后点击“获取标题方案”，确认方向再开始写正文，避免直接出成稿后返工。</p>
            </div>
          )}
        </div>
      )}

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
              <LogPanel logs={logs} emptyText="等待脚本输出日志..." defaultShowImportantOnly maxHeight={300} />
            </div>
          </div>
        </div>
      )}

      {shouldShowHistoryLibrary && (
        <div className={`card history-card${showHistoryPanel ? '' : ' history-card--collapsed'}`} style={{ marginTop: 'var(--sp-6)' }}>
          <div className="history-card__header">
            <div>
              <p className="history-card__title">历史文章记录</p>
              <p className="history-card__hint">
                {showHistoryPanel
                  ? '仅在主题未确定前展示，支持搜索、删除单条和展开全部列表。删除时会同步删除本地 Markdown 文件。'
                  : '面板当前已隐藏，需要时可以随时展开查看历史文章记录。'}
              </p>
            </div>
            <div className="history-toolbar">
              {!showHistoryPanel && history.length > 0 && (
                <span className="history-card__summary">共 {history.length} 条记录</span>
              )}
              {showHistoryPanel && (
                <input
                  className="input history-search-input"
                  placeholder="搜索标题、主题或文件路径"
                  value={historySearch}
                  onChange={(event) => setHistorySearch(event.target.value)}
                />
              )}
              {showHistoryPanel && filteredHistory.length > 6 && !normalizedHistorySearch && (
                <button className="btn btn-ghost btn-sm" onClick={() => setShowAllHistory((prev) => !prev)}>
                  {showAllHistory ? '收起列表' : '显示全部'}
                </button>
              )}
              <button className="btn btn-ghost btn-sm" onClick={handleToggleHistoryPanel}>
                {showHistoryPanel ? '收起面板' : '展开面板'}
              </button>
            </div>
          </div>
          {showHistoryPanel && (
            <>
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
            </>
          )}
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
