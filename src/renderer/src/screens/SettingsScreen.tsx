// src/renderer/src/screens/SettingsScreen.tsx
import { useState, useEffect } from 'react'

interface Props {
  onBack: () => void
}

export default function SettingsScreen({ onBack }: Props) {
  const [config, setConfig] = useState<{ provider: string; model: string; baseUrl: string } | null>(null)
  const [clearing, setClearing] = useState(false)
  const [cleared, setCleared] = useState(false)

  useEffect(() => {
    window.electronAPI.loadConfig().then(setConfig)
  }, [])

  async function handleClearKey() {
    if (!confirm('确认清除 API Key？清除后需重新配置才能使用。')) return
    setClearing(true)
    await window.electronAPI.clearApiKey()
    setClearing(false)
    setCleared(true)
  }

  return (
    <div className="screen-sm">
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 'var(--sp-4)' }}>
        ← 返回
      </button>
      <h1 className="page-title">设置</h1>

      {/* 当前配置 */}
      <div className="card" style={{ marginBottom: 'var(--sp-4)' }}>
        <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 'var(--sp-3)', color: 'var(--text-primary)' }}>
          当前 AI 配置
        </p>
        {config ? (
          <>
            <p className="text-muted" style={{ marginBottom: 'var(--sp-1)' }}>服务商：{config.provider}</p>
            <p className="text-muted" style={{ marginBottom: 'var(--sp-1)' }}>模型：{config.model}</p>
            {config.baseUrl && <p className="text-muted">Base URL：{config.baseUrl}</p>}
          </>
        ) : (
          <p className="text-muted">加载中...</p>
        )}
      </div>

      {/* API Key 管理 */}
      <div className="card">
        <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 'var(--sp-2)', color: 'var(--text-primary)' }}>
          API Key 管理
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--sp-4)' }}>
          API Key 已加密存储在本地系统钥匙串中，不会上传到任何服务器。
        </p>
        {cleared ? (
          <p className="text-success">✓ API Key 已清除，请重启应用完成重新配置。</p>
        ) : (
          <button className="btn btn-danger btn-sm" onClick={handleClearKey} disabled={clearing}>
            {clearing ? '清除中...' : '清除 API Key'}
          </button>
        )}
      </div>
    </div>
  )
}
