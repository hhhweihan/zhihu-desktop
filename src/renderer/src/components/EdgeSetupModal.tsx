// src/renderer/src/components/EdgeSetupModal.tsx
import { useState } from 'react'
import { getTaskErrorMessage } from '../utils/task-events'

interface Props {
  onReady: () => void
  onClose: () => void
}

export default function EdgeSetupModal({ onReady, onClose }: Props) {
  const [status, setStatus] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle')
  const [error, setError] = useState('')
  const [zhihuState, setZhihuState] = useState<ZhihuLoginState | null>(null)
  const [checkingZhihuState, setCheckingZhihuState] = useState(false)

  async function refreshZhihuState() {
    setCheckingZhihuState(true)
    try {
      const state = await window.electronAPI.getZhihuLoginState()
      setZhihuState(state)
      setError('')
    } catch (e: any) {
      const message = getTaskErrorMessage(e)
      setZhihuState({
        edgeReady: false,
        loggedIn: false,
        reason: message,
      })
      setError(message)
    } finally {
      setCheckingZhihuState(false)
    }
  }

  async function handleCheck() {
    setStatus('checking')
    setError('')
    const ok = await window.electronAPI.checkEdge()
    if (ok) {
      setStatus('ok')
      await refreshZhihuState()
    } else {
      const result = await window.electronAPI.launchEdge()
      if (result.success) {
        setStatus('ok')
        await refreshZhihuState()
      } else {
        setStatus('fail')
        setError(result.error ?? '启动失败')
      }
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }}>
      <div className="card" style={{ width: 420, maxWidth: '90vw' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 'var(--sp-3)', color: 'var(--text-primary)' }}>
          连接 Microsoft Edge
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 'var(--sp-5)' }}>
          发布功能需要 Microsoft Edge 来自动填充知乎编辑器内容。
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
            <p className="text-success" style={{ marginBottom: 'var(--sp-4)' }}>
              ✓ Edge 已就绪。
            </p>
            <div className="login-state-card" style={{ marginBottom: 'var(--sp-4)' }}>
              <div className="login-state-card__header">
                <div>
                  <p className="login-state-card__title">知乎登录状态</p>
                  <p className="login-state-card__hint">
                    {checkingZhihuState
                      ? '检测中...'
                      : zhihuState?.loggedIn
                        ? `已同步 Edge 登录态${zhihuState.displayName ? `：${zhihuState.displayName}` : ''}`
                        : zhihuState?.reason || '请先在 Edge 中登录知乎'}
                  </p>
                </div>
                <span className={`status-badge ${zhihuState?.loggedIn ? 'status-badge--success' : 'status-badge--warning'}`}>
                  {checkingZhihuState ? '检测中' : zhihuState?.loggedIn ? '已登录' : '未登录'}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
              <button className="btn btn-ghost btn-sm" onClick={refreshZhihuState} disabled={checkingZhihuState}>
                刷新知乎登录状态
              </button>
              <button className="btn btn-primary" onClick={onReady} disabled={!zhihuState?.loggedIn || checkingZhihuState}>
                已登录知乎，继续发布 →
              </button>
            </div>
          </div>
        )}
        {status === 'fail' && (
          <div>
            <p className="text-error" style={{ marginBottom: 'var(--sp-3)' }}>{error}</p>
            <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
              <a
                href="https://www.microsoft.com/edge"
                target="_blank"
                rel="noreferrer"
                className="btn btn-ghost btn-sm"
                style={{ textDecoration: 'none' }}
              >
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
