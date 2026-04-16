// src/renderer/src/screens/ReviewScreen.tsx
import { useState, useEffect } from 'react'
import ScoreBadge from '../components/ScoreBadge'
import IssueList from '../components/IssueList'
import ProgressSteps from '../components/ProgressSteps'
import LogPanel, { type LogEntry } from '../components/LogPanel'

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

function parseReviewLog(msg: string): { step?: number; line?: LogEntry } {
  const line = msg.trim()
  if (!line) return {}

  const stepMatch = line.match(/^__STEP__review:(\d+):(.+)$/)
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
  if (line.startsWith('检查中：') || line.startsWith('▶ ') || line.startsWith('总体评价')) {
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

const LOW_SCORE_TIPS = [
  '删除"随着科技发展""众所周知"等套话开头',
  '加入第一手案例或亲身经历，增强真实感',
  '把结论放在开头，用数字或事实支撑',
  '检查并消除 AI 典型句式（先…再…最后…）',
  '每个论点配一个具体例子或数据',
]

export default function ReviewScreen({ mdPath, title, onPublish, onBack }: Props) {
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState<ReviewReport | null>(null)
  const [error, setError] = useState('')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    const off = window.electronAPI.onScriptLog((msg) => {
      const parsed = parseReviewLog(msg)
      if (parsed.step) {
        setActiveStep(Math.max(0, Math.min(REVIEW_STEPS.length - 1, parsed.step - 1)))
      }
      if (!parsed.line) return
      setLogs((prev) => [...prev.slice(-59), parsed.line!])
    })
    return off
  }, [])

  useEffect(() => { runReview() }, [mdPath])

  async function runReview() {
    setLoading(true)
    setError('')
    setLogs([])
    setActiveStep(0)
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

      {(loading || error || logs.length > 0) && (
        <div style={{ marginTop: 'var(--sp-4)' }}>
          <LogPanel logs={logs} title="审核日志" emptyText="等待审核脚本输出日志..." />
        </div>
      )}

      {error && <p className="text-error">{error}</p>}

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
