import { useEffect, useRef, useState } from 'react'
import { showAppToast } from '../utils/app-toast'

export interface LogEntry {
  message: string
  timestamp: number
  important?: boolean
  tone?: 'neutral' | 'step' | 'info' | 'success' | 'warning' | 'error'
}

interface Props {
  logs: LogEntry[]
  title?: string
  emptyText?: string
  maxHeight?: number
  defaultShowImportantOnly?: boolean
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('zh-CN', { hour12: false })
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()

  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)

  if (!copied) throw new Error('copy failed')
}

async function notifyCopyResult(title: string, body: string): Promise<boolean> {
  if (!('Notification' in window)) return false

  if (Notification.permission === 'default') {
    try {
      await Notification.requestPermission()
    } catch {
      return false
    }
  }

  if (Notification.permission === 'granted') {
    new Notification(title, { body, silent: true })
    return true
  }

  return false
}

export default function LogPanel({
  logs,
  title = '实时日志',
  emptyText = '暂无日志输出',
  maxHeight = 220,
  defaultShowImportantOnly = false,
}: Props) {
  const [copyState, setCopyState] = useState<'idle' | 'failed'>('idle')
  const [showImportantOnly, setShowImportantOnly] = useState(defaultShowImportantOnly)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const resetTimerRef = useRef<number | null>(null)
  const importantLogs = logs.filter((log) => log.important)
  const shouldFallbackToAllLogs = logs.length > 0 && importantLogs.length === 0
  const displayedLogs = showImportantOnly && !shouldFallbackToAllLogs ? importantLogs : logs
  const canFilter = importantLogs.length > 0 && importantLogs.length < logs.length

  useEffect(() => {
    if (!bodyRef.current) return
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [displayedLogs])

  useEffect(() => {
    if (shouldFallbackToAllLogs && showImportantOnly) {
      setShowImportantOnly(false)
    }
  }, [shouldFallbackToAllLogs, showImportantOnly])

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current)
      }
    }
  }, [])

  async function handleCopy(): Promise<void> {
    try {
      const content = displayedLogs
        .map((log) => `[${formatTimestamp(log.timestamp)}] ${log.message}`)
        .join('\n')
      await copyText(content)
      setCopyState('idle')
      const notified = await notifyCopyResult('日志已复制', `已复制 ${displayedLogs.length} 条${showImportantOnly ? '关键阶段' : ''}日志`)
      if (!notified) {
        showAppToast('日志已复制，但系统通知不可用或权限被拒绝', 'warning')
      }
    } catch {
      setCopyState('failed')
      showAppToast('复制日志失败，请稍后重试', 'error')
    }

    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current)
    }
    resetTimerRef.current = window.setTimeout(() => setCopyState('idle'), 1600)
  }

  return (
    <div className="log-panel">
      <div className="log-panel__header">
        <div>
          <div>{title}</div>
          <div className="log-panel__hint">
            共 {logs.length} 条{showImportantOnly ? `，显示 ${displayedLogs.length} 条关键阶段` : ''}，自动滚动到底部
          </div>
        </div>
        <div className="log-panel__actions">
          {canFilter && (
            <label className="log-panel__toggle">
              <input
                type="checkbox"
                checked={showImportantOnly}
                onChange={(event) => setShowImportantOnly(event.target.checked)}
              />
              <span>只看关键阶段</span>
            </label>
          )}
          <button className="btn btn-ghost btn-sm" onClick={handleCopy} disabled={displayedLogs.length === 0}>
            {copyState === 'failed' ? '复制失败' : '复制日志'}
          </button>
        </div>
      </div>
      <div ref={bodyRef} className="log-panel__body" style={{ maxHeight }}>
        {displayedLogs.length === 0 ? (
          <div className="log-panel__empty">{emptyText}</div>
        ) : (
          displayedLogs.map((log, index) => (
            <div key={`${log.timestamp}-${index}`} className={`log-panel__line log-panel__line--${log.tone ?? 'neutral'}`}>
              <span className="log-panel__time">[{formatTimestamp(log.timestamp)}]</span>
              <span className="log-panel__message">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}