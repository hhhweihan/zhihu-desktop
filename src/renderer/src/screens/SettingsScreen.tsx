// src/renderer/src/screens/SettingsScreen.tsx
import { useState, useEffect } from 'react'

interface Props {
  onBack: () => void
  onCredentialsCleared: () => void
}

export default function SettingsScreen({ onBack, onCredentialsCleared }: Props) {
  const [config, setConfig] = useState<AIConfig | null>(null)
  const [defaultOutputDir, setDefaultOutputDir] = useState('')
  const [clearing, setClearing] = useState(false)
  const [cleared, setCleared] = useState(false)
  const [savingOutputDir, setSavingOutputDir] = useState(false)
  const [outputDirMessage, setOutputDirMessage] = useState('')

  useEffect(() => {
    window.electronAPI.loadConfig().then(setConfig)
    window.electronAPI.getDefaultOutputDir().then(setDefaultOutputDir)
  }, [])

  async function handleClearKey() {
    if (!confirm('确认清除 API Key？清除后需重新配置才能使用。')) return
    setClearing(true)
    try {
      await window.electronAPI.clearApiKey()
      await window.electronAPI.clearConfig()
      const nextConfig = await window.electronAPI.loadConfig()
      setConfig(nextConfig)
      setOutputDirMessage('')
      setCleared(true)
      onCredentialsCleared()
    } finally {
      setClearing(false)
    }
  }

  async function handleChooseOutputDir() {
    if (!config) return
    setSavingOutputDir(true)
    setOutputDirMessage('')
    try {
      const selectedDir = await window.electronAPI.chooseDirectory(config.outputDir)
      if (!selectedDir) return
      const nextConfig: AIConfig = { ...config, outputDir: selectedDir }
      await window.electronAPI.saveConfig(nextConfig)
      setConfig(nextConfig)
      setOutputDirMessage('已更新文章保存目录')
    } catch (e: any) {
      setOutputDirMessage(e.message || '保存目录失败')
    } finally {
      setSavingOutputDir(false)
    }
  }

  async function handleResetOutputDir() {
    if (!config || !defaultOutputDir) return
    setSavingOutputDir(true)
    setOutputDirMessage('')
    try {
      const nextConfig: AIConfig = { ...config, outputDir: defaultOutputDir }
      await window.electronAPI.saveConfig(nextConfig)
      setConfig(nextConfig)
      setOutputDirMessage('已恢复为默认目录')
    } catch (e: any) {
      setOutputDirMessage(e.message || '恢复默认目录失败')
    } finally {
      setSavingOutputDir(false)
    }
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

      <div className="card" style={{ marginBottom: 'var(--sp-4)' }}>
        <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 'var(--sp-2)', color: 'var(--text-primary)' }}>
          文章存放路径
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--sp-3)' }}>
          默认保存到安装目录下的 articles 文件夹，也可以改成你自己的目录。
        </p>
        <div className="path-field">
          <span className="path-field__value">{config?.outputDir || '加载中...'}</span>
        </div>
        {defaultOutputDir && (
          <p className="text-muted" style={{ marginTop: 'var(--sp-2)', marginBottom: 0 }}>
            默认目录：{defaultOutputDir}
          </p>
        )}
        {outputDirMessage && (
          <p className={outputDirMessage.startsWith('已') ? 'text-success' : 'text-error'} style={{ marginTop: 'var(--sp-3)', marginBottom: 0 }}>
            {outputDirMessage}
          </p>
        )}
        <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-4)', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleChooseOutputDir} disabled={!config || savingOutputDir}>
            {savingOutputDir ? '处理中...' : '选择目录'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={handleResetOutputDir} disabled={!config || savingOutputDir || !defaultOutputDir}>
            恢复默认目录
          </button>
        </div>
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
          <p className="text-success">✓ API Key 与 AI 配置已清除，请重新完成引导配置。</p>
        ) : (
          <button className="btn btn-danger btn-sm" onClick={handleClearKey} disabled={clearing}>
            {clearing ? '清除中...' : '清除 API Key'}
          </button>
        )}
      </div>
    </div>
  )
}
