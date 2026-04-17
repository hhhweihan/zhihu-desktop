// src/renderer/src/screens/Onboarding.tsx
import { useState } from 'react'
import { getTaskErrorMessage } from '../utils/task-events'

interface Props {
  onComplete: () => void
}

const PROVIDERS = [
  {
    id: 'anthropic' as const,
    name: 'Anthropic 官方',
    defaultModel: 'claude-sonnet-4-6',
    baseUrl: '',
    models: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5-20251001'],
    keyHint: 'sk-ant-...',
    keyPrefix: 'sk-ant-',
    keyLink: 'https://console.anthropic.com/',
    keyLinkText: '申请 API Key',
  },
  {
    id: 'letai' as const,
    name: 'LetAI Code（推荐）',
    defaultModel: 'claude-sonnet-4-6',
    baseUrl: 'https://letaicode.cn/claude',
    models: ['claude-sonnet-4-6', 'claude-opus-4-6', 'gpt-4o', 'gpt-4o-mini'],
    keyHint: '粘贴你的 Token...',
    keyPrefix: '',
    keyLink: 'https://letaicode.cn/?aff=npZES3',
    keyLinkText: '购买 Token 套餐',
  },
  {
    id: 'custom' as const,
    name: '自定义（OpenAI 兼容）',
    defaultModel: 'claude-sonnet-4-6',
    baseUrl: '',
    models: [],
    keyHint: '粘贴你的 API Key...',
    keyPrefix: '',
    keyLink: '',
    keyLinkText: '',
  },
]

export default function Onboarding({ onComplete }: Props) {
  const [providerId, setProviderId] = useState<'anthropic' | 'letai' | 'custom'>('anthropic')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('claude-sonnet-4-6')
  const [baseUrl, setBaseUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const provider = PROVIDERS.find((p) => p.id === providerId)!

  function handleProviderChange(id: typeof providerId) {
    const p = PROVIDERS.find((x) => x.id === id)!
    setProviderId(id)
    setModel(p.defaultModel)
    setBaseUrl(p.baseUrl)
    setApiKey('')
    setError('')
  }

  async function handleSave() {
    if (!apiKey.trim()) { setError('请填入 API Key'); return }
    if (provider.keyPrefix && !apiKey.startsWith(provider.keyPrefix)) {
      setError(`API Key 格式不正确，应以 ${provider.keyPrefix} 开头`)
      return
    }
    if (providerId !== 'anthropic' && !baseUrl.trim()) {
      setError('请填写 API Base URL')
      return
    }
    setLoading(true)
    setError('')
    try {
      const defaultOutputDir = await window.electronAPI.getDefaultOutputDir()
      await window.electronAPI.saveApiKey(apiKey.trim())
      await window.electronAPI.saveConfig({
        provider: providerId,
        model: model.trim() || provider.defaultModel,
        baseUrl: baseUrl.trim(),
        outputDir: defaultOutputDir,
      })
      onComplete()
    } catch (e: unknown) {
      setError(getTaskErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="screen-sm">
      <h1 className="page-title">欢迎使用知乎写作助手</h1>

      {/* LetAI 推荐卡 */}
      <div className="card card-sm" style={{
        background: 'linear-gradient(135deg, rgba(118,75,162,0.15), rgba(37,99,235,0.1))',
        borderColor: 'rgba(118,75,162,0.3)',
        marginBottom: 'var(--sp-5)',
      }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 'var(--sp-1)' }}>💡 没有 API Key？</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--sp-3)' }}>
          LetAI Code 提供国内直连的 Claude / GPT API 套餐，按量计费，无月费，新用户有免费额度。
        </div>
        <a
          href="https://letaicode.cn/?aff=npZES3"
          target="_blank"
          rel="noreferrer"
          className="btn btn-primary btn-sm"
          style={{ textDecoration: 'none', display: 'inline-block' }}
        >
          立即获取 Token →
        </a>
      </div>

      {/* Provider 选择 */}
      <div className="form-group">
        <label className="label">选择 AI 服务商</label>
        <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => handleProviderChange(p.id)}
              className={`btn btn-sm ${providerId === p.id ? 'btn-primary' : 'btn-ghost'}`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* 模型选择 */}
      <div className="form-group">
        <label className="label">模型</label>
        {provider.models.length > 0 ? (
          <select className="select" value={model} onChange={(e) => setModel(e.target.value)}>
            {provider.models.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        ) : (
          <input
            className="input"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="例如：claude-sonnet-4-6"
          />
        )}
      </div>

      {/* Base URL */}
      {(providerId === 'letai' || providerId === 'custom') && (
        <div className="form-group">
          <label className="label">Base URL（API 地址）</label>
          <input
            className="input"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={providerId === 'letai' ? 'https://letaicode.cn/claude' : 'https://your-proxy.com/v1'}
          />
        </div>
      )}

      {/* API Key */}
      <div className="form-group">
        <label className="label">
          API Key
          {provider.keyLink && (
            <a
              href={provider.keyLink}
              target="_blank"
              rel="noreferrer"
              style={{ marginLeft: 8, fontSize: 12, color: 'var(--brand-purple-light)' }}
            >
              {provider.keyLinkText}
            </a>
          )}
        </label>
        <input
          className="input"
          type="password"
          placeholder={provider.keyHint}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !loading && handleSave()}
        />
      </div>

      {error && <p className="text-error" style={{ marginBottom: 'var(--sp-3)' }}>{error}</p>}

      <button
        className="btn btn-primary btn-lg"
        onClick={handleSave}
        disabled={loading}
        style={{ width: '100%' }}
      >
        {loading ? '保存中...' : '开始使用 →'}
      </button>
    </div>
  )
}
