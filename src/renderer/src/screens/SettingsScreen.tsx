// src/renderer/src/screens/SettingsScreen.tsx
import { useState, useEffect } from 'react'
import { showAppToast } from '../utils/app-toast'
import { getTaskErrorMessage } from '../utils/task-events'

interface Props {
  onBack: () => void
  onCredentialsCleared: () => void
  zhihuLoginState: ZhihuLoginState | null
  onRefreshZhihuLogin: () => Promise<ZhihuLoginState>
}

export default function SettingsScreen({ onBack, onCredentialsCleared, zhihuLoginState, onRefreshZhihuLogin }: Props) {
  const [config, setConfig] = useState<AIConfig | null>(null)
  const [updateState, setUpdateState] = useState<AppUpdateState | null>(null)
  const [defaultOutputDir, setDefaultOutputDir] = useState('')
  const [clearing, setClearing] = useState(false)
  const [cleared, setCleared] = useState(false)
  const [savingOutputDir, setSavingOutputDir] = useState(false)
  const [outputDirMessage, setOutputDirMessage] = useState('')
  const [zhihuAction, setZhihuAction] = useState<'idle' | 'checking' | 'launching' | 'disconnecting'>('idle')

  useEffect(() => {
    window.electronAPI.loadConfig().then(setConfig)
    window.electronAPI.getDefaultOutputDir().then(setDefaultOutputDir)
    window.electronAPI.getAppUpdateState().then(setUpdateState)

    const dispose = window.electronAPI.onAppUpdateState((nextState) => {
      setUpdateState(nextState)

      if (nextState.status === 'available') {
        showAppToast(`发现新版本 ${nextState.availableVersion ?? ''}`.trim(), 'info')
      }

      if (nextState.status === 'up-to-date') {
        showAppToast('当前已经是最新版本', 'success')
      }

      if (nextState.status === 'downloaded') {
        showAppToast('更新已下载完成，重启后安装', 'success')
      }

      if (nextState.status === 'error') {
        showAppToast(nextState.message || '自动更新失败', 'error')
      }
    })

    return dispose
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
    } catch (e: unknown) {
      setOutputDirMessage(getTaskErrorMessage(e) || '保存目录失败')
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
    } catch (e: unknown) {
      setOutputDirMessage(getTaskErrorMessage(e) || '恢复默认目录失败')
    } finally {
      setSavingOutputDir(false)
    }
  }

  async function handleCheckUpdates() {
    try {
      const nextState = await window.electronAPI.checkForAppUpdates()
      setUpdateState(nextState)
      if (nextState.status === 'unsupported') {
        showAppToast(nextState.message, 'warning')
      }
    } catch (e: unknown) {
      showAppToast(getTaskErrorMessage(e) || '检查更新失败', 'error')
    }
  }

  async function handleDownloadUpdate() {
    try {
      await window.electronAPI.downloadAppUpdate()
    } catch (e: unknown) {
      showAppToast(getTaskErrorMessage(e) || '下载更新失败', 'error')
    }
  }

  async function handleInstallUpdate() {
    try {
      showAppToast('应用即将重启并安装更新', 'info')
      await window.electronAPI.installAppUpdate()
    } catch (e: unknown) {
      showAppToast(getTaskErrorMessage(e) || '安装更新失败', 'error')
    }
  }

  async function handleConnectZhihu() {
    setZhihuAction('launching')
    try {
      const result = await window.electronAPI.launchEdge()
      if (!result.success) {
        showAppToast(result.error || 'Edge 启动失败', 'error')
        return
      }
      await onRefreshZhihuLogin()
    } catch (e: unknown) {
      showAppToast(getTaskErrorMessage(e) || '连接失败', 'error')
    } finally {
      setZhihuAction('idle')
    }
  }

  async function handleDisconnectZhihu() {
    setZhihuAction('disconnecting')
    try {
      await window.electronAPI.killEdgeAndRelaunch()
      showAppToast('已断开知乎登录（Edge 已重启）', 'info')
      await onRefreshZhihuLogin()
    } catch (e: unknown) {
      showAppToast(getTaskErrorMessage(e) || '断开失败', 'error')
    } finally {
      setZhihuAction('idle')
    }
  }

  async function handleRefreshZhihuState() {
    setZhihuAction('checking')
    try {
      await onRefreshZhihuLogin()
    } finally {
      setZhihuAction('idle')
    }
  }

  const canCheckUpdates = updateState?.status !== 'checking' && updateState?.status !== 'downloading'
  const canDownloadUpdate = updateState?.status === 'available'
  const canInstallUpdate = updateState?.status === 'downloaded'

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

      <div className="card" style={{ marginBottom: 'var(--sp-4)' }}>
        <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 'var(--sp-2)', color: 'var(--text-primary)' }}>
          应用更新
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--sp-3)' }}>
          当前版本：{updateState?.currentVersion || '加载中...'}
        </p>
        {updateState?.availableVersion && (
          <p className="text-muted" style={{ marginBottom: 'var(--sp-2)' }}>
            可更新到：{updateState.availableVersion}
          </p>
        )}
        <p
          className={updateState?.status === 'error' ? 'text-error' : updateState?.status === 'downloaded' || updateState?.status === 'up-to-date' ? 'text-success' : 'text-muted'}
          style={{ marginBottom: 0 }}
        >
          {updateState?.message || '正在读取更新状态'}
          {typeof updateState?.progress === 'number' ? `（${updateState.progress}%）` : ''}
        </p>
        <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-4)', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleCheckUpdates} disabled={!canCheckUpdates}>
            {updateState?.status === 'checking' ? '检查中...' : '检查更新'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleDownloadUpdate} disabled={!canDownloadUpdate}>
            {updateState?.status === 'downloading' ? '下载中...' : '下载更新'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleInstallUpdate} disabled={!canInstallUpdate}>
            立即安装
          </button>
        </div>
      </div>

      {/* Zhihu 登录 */}
      <div className="card" style={{ marginBottom: 'var(--sp-4)' }}>
        <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 'var(--sp-3)', color: 'var(--text-primary)' }}>
          知乎登录
        </p>
        {zhihuLoginState && (
          <div className="login-state-card" style={{ marginBottom: 'var(--sp-4)' }}>
            <div className="login-state-card__header">
              <div>
                <p className="login-state-card__title">知乎登录状态</p>
                <p className="login-state-card__hint">
                  {zhihuLoginState.loggedIn
                    ? `已登录：${zhihuLoginState.displayName || '未获取昵称'}`
                    : zhihuLoginState.edgeReady
                      ? '未登录'
                      : 'Edge 未连接'}
                </p>
              </div>
              <span className={`status-badge ${zhihuLoginState.loggedIn ? 'status-badge--success' : 'status-badge--warning'}`}>
                {zhihuLoginState.loggedIn ? '已登录' : '未连接'}
              </span>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleRefreshZhihuState} disabled={zhihuAction !== 'idle'}>
            {zhihuAction === 'checking' ? '检测中...' : '刷新状态'}
          </button>
          {!zhihuLoginState?.loggedIn && (
            <button className="btn btn-secondary btn-sm" onClick={handleConnectZhihu} disabled={zhihuAction !== 'idle'}>
              {zhihuAction === 'launching' ? '启动中...' : '启动 Edge 登录'}
            </button>
          )}
          {zhihuLoginState?.loggedIn && (
            <button className="btn btn-danger btn-sm" onClick={handleDisconnectZhihu} disabled={zhihuAction !== 'idle'}>
              {zhihuAction === 'disconnecting' ? '断开中...' : '断开登录'}
            </button>
          )}
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
