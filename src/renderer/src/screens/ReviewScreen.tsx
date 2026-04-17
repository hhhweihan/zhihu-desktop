// src/renderer/src/screens/ReviewScreen.tsx
import { useState, useEffect } from 'react'
import ScoreBadge from '../components/ScoreBadge'
import IssueList from '../components/IssueList'
import ProgressSteps from '../components/ProgressSteps'
import LogPanel, { type LogEntry } from '../components/LogPanel'
import { createLogEntryFromTaskEvent, getTaskErrorMessage, isTaskEventFor } from '../utils/task-events'
import type { TaskEvent } from '../../../shared/task-events'

interface Props {
  mdPath: string
  title: string
  topic: string
  onPublish: () => void
  onArticleReady: (mdPath: string, title: string, topic?: string) => void
  onBack: () => void
}

const REVIEW_STEPS = [
  { label: '读取文章' },
  { label: '检查表述准确性' },
  { label: '检测 AI 腔调' },
  { label: '生成综合评分' },
  { label: '审核完成' },
]

const LOW_SCORE_TIPS = [
  '删除"随着科技发展""众所周知"等套话开头',
  '加入第一手案例或亲身经历，增强真实感',
  '把结论放在开头，用数字或事实支撑',
  '检查并消除 AI 典型句式（先…再…最后…）',
  '每个论点配一个具体例子或数据',
]

function buildRevisionBrief(report: ReviewReport): string {
  const issueLines = report.issues.slice(0, 6).map((item, index) => {
    const location = item.location ? `位置：${item.location}` : '位置：全文'
    return `${index + 1}. 问题：${item.issue}；${location}；修改建议：${item.suggestion}`
  })

  return [
    `上次审核得分：${report.overallScore}`,
    `整体评价：${report.summary}`,
    `人味度判断：${report.authenticity}`,
    issueLines.length > 0 ? `优先修复：\n${issueLines.join('\n')}` : '优先修复：减少空话，增加更具体的经验和判断。',
  ].join('\n')
}

function toReviewLogEntry(event: TaskEvent): LogEntry | null {
  const entry = createLogEntryFromTaskEvent(event)
  if (!entry) {
    return null
  }

  if (event.task === 'generate') {
    return {
      ...entry,
      message: `重新生成：${entry.message}`,
    }
  }

  return entry
}

export default function ReviewScreen({ mdPath, title, topic, onPublish, onArticleReady, onBack }: Props) {
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState<ReviewReport | null>(null)
  const [error, setError] = useState('')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [activeStep, setActiveStep] = useState(0)
  const [pendingGeneratedReview, setPendingGeneratedReview] = useState(false)
  const [busyLabel, setBusyLabel] = useState('审核中，请稍候...')

  useEffect(() => {
    const off = window.electronAPI.onTaskEvent((event) => {
      if (!isTaskEventFor('review', event) && !isTaskEventFor('generate', event)) return
      if (event.task === 'review' && event.type === 'step') {
        setActiveStep(Math.max(0, Math.min(REVIEW_STEPS.length - 1, event.step - 1)))
      }
      const line = toReviewLogEntry(event)
      if (!line) return
      setLogs((prev) => [...prev.slice(-99), line])
    })
    return off
  }, [])

  useEffect(() => {
    void runReview(pendingGeneratedReview)
    if (pendingGeneratedReview) {
      setPendingGeneratedReview(false)
    }
  }, [mdPath])

  async function runReview(preserveLogs = false) {
    setLoading(true)
    setBusyLabel('审核中，请稍候...')
    setError('')
    setReport(null)
    if (!preserveLogs) {
      setLogs([])
    }
    setActiveStep(0)
    try {
      const result = await window.electronAPI.reviewArticle(mdPath)
      setReport(result)
    } catch (e: unknown) {
      setError(getTaskErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  async function handleRegenerate(useReviewSuggestions: boolean) {
    if (!topic.trim()) {
      setError('当前文章缺少原始主题，无法重新生成。请返回写作页重新发起。')
      return
    }

    setLoading(true)
    setError('')
    setReport(null)
    setLogs([])
    setActiveStep(0)
    setBusyLabel(useReviewSuggestions ? '正在根据审核建议重新生成...' : '正在重新生成文章...')

    try {
      const revisionBrief = useReviewSuggestions && report ? buildRevisionBrief(report) : undefined
      const result = await window.electronAPI.generateArticle(topic.trim(), undefined, revisionBrief)
      setPendingGeneratedReview(true)
      onArticleReady(result.mdPath, result.title, topic.trim())
    } catch (e: unknown) {
      setError(getTaskErrorMessage(e))
      setLoading(false)
    }
  }

  const reviewSteps = REVIEW_STEPS.map((s, i) => {
    return {
      label: s.label,
      status: (
        !loading && report ? 'done' :
        i < activeStep ? 'done' :
        i === activeStep ? 'active' :
        'pending'
      ) as 'pending' | 'active' | 'done' | 'error',
    }
  })

  return (
    <div className="screen screen-md">
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 'var(--sp-4)' }}>
        ← 返回
      </button>
      <h1 className="page-title">文章审核</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: -16, marginBottom: 'var(--sp-6)' }}>
        《{title}》
      </p>

      {loading && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-4)', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 4 }}>当前阶段</p>
              <p style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 700 }}>{busyLabel}</p>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>最近 {logs.length} 条日志</p>
          </div>
          <div className="activity-grid">
            <div className="activity-grid__column">
              <ProgressSteps steps={reviewSteps} />
            </div>
            <div className="activity-grid__column">
              <LogPanel logs={logs} emptyText="等待审核脚本输出日志..." defaultShowImportantOnly maxHeight={300} />
            </div>
          </div>
        </div>
      )}

      {!loading && logs.length > 0 && (
        <div style={{ marginTop: 'var(--sp-4)' }}>
          <LogPanel logs={logs} title="审核日志" emptyText="等待审核脚本输出日志..." />
        </div>
      )}

      {error && !loading && (
        <div className="card card-sm" style={{ marginTop: 'var(--sp-4)' }}>
          <p className="text-error" style={{ marginTop: 0, marginBottom: 'var(--sp-4)' }}>{error}</p>
          <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={() => void runReview()}>重试审核</button>
            <button className="btn btn-secondary" onClick={() => void handleRegenerate(false)}>重新生成</button>
            <button className="btn btn-ghost" onClick={onBack}>返回上一页</button>
          </div>
        </div>
      )}

      {report && !loading && (
        <div>
          <div className="card" style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-6)', marginBottom: 'var(--sp-4)' }}>
            <ScoreBadge score={report.overallScore} />
            <div>
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>{report.authenticity}</p>
              <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>{report.summary}</p>
            </div>
          </div>

          {report.overallScore < 70 && (
            <div className="card card-sm" style={{
              marginBottom: 'var(--sp-4)',
              borderColor: 'rgba(245,158,11,0.3)',
              background: 'rgba(245,158,11,0.06)',
            }}>
              <p style={{ fontWeight: 600, color: 'var(--color-warn)', marginBottom: 'var(--sp-3)', fontSize: 14 }}>
                💡 提升建议（分数低于 70）
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
            <button className="btn btn-secondary" onClick={() => void runReview()}>重新审核</button>
            <button className="btn btn-secondary" onClick={() => void handleRegenerate(false)}>重新生成</button>
            <button className="btn btn-secondary" onClick={() => void handleRegenerate(true)}>
              根据建议重新生成
            </button>
            <button className="btn btn-primary" onClick={onPublish}>
              {report.overallScore >= 70 ? '去发布 →' : '忽略警告，去发布 →'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
