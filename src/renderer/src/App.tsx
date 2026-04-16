// src/renderer/src/App.tsx
import { useState, useEffect } from 'react'
import Onboarding from './screens/Onboarding'
import WriteScreen from './screens/WriteScreen'
import ReviewScreen from './screens/ReviewScreen'
import PublishScreen from './screens/PublishScreen'
import SettingsScreen from './screens/SettingsScreen'
import EdgeSetupModal from './components/EdgeSetupModal'
import ToastViewport from './components/ToastViewport'

type Screen = 'onboarding' | 'write' | 'review' | 'publish'

const HISTORY_KEY = 'zhihu-article-history'

function loadHistory(): ArticleHistory[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') } catch { return [] }
}

function saveHistory(items: ArticleHistory[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 50)))
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('onboarding')
  const [articleMdPath, setArticleMdPath] = useState('')
  const [articleTitle, setArticleTitle] = useState('')
  const [showEdgeModal, setShowEdgeModal] = useState(false)
  const [pendingPublish, setPendingPublish] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    window.electronAPI.loadApiKey().then((key) => {
      if (key) setScreen('write')
    })
  }, [])

  function handleArticleReady(mdPath: string, title: string) {
    setArticleMdPath(mdPath)
    setArticleTitle(title)
    const hist = loadHistory()
    const entry: ArticleHistory = { id: Date.now().toString(), title, mdPath, createdAt: Date.now() }
    saveHistory([entry, ...hist])
    setScreen('review')
  }

  async function handleGoPublish() {
    const ok = await window.electronAPI.checkEdge()
    if (!ok) {
      setPendingPublish(true)
      setShowEdgeModal(true)
    } else {
      setScreen('publish')
    }
  }

  function handleEdgeReady() {
    setShowEdgeModal(false)
    if (pendingPublish) {
      setPendingPublish(false)
      setScreen('publish')
    }
  }

  const showSettingsBtn = !showSettings && (screen === 'write' || screen === 'review' || screen === 'publish')

  return (
    <div>
      {showSettingsBtn && (
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setShowSettings(true)}
          style={{ position: 'fixed', top: 12, right: 16, zIndex: 100 }}
        >
          ⚙ 设置
        </button>
      )}

      {screen === 'onboarding' && <Onboarding onComplete={() => setScreen('write')} />}
      {screen === 'write' && <WriteScreen onArticleReady={handleArticleReady} />}
      {screen === 'review' && (
        <ReviewScreen
          mdPath={articleMdPath}
          title={articleTitle}
          onPublish={handleGoPublish}
          onBack={() => setScreen('write')}
        />
      )}
      {screen === 'publish' && (
        <PublishScreen
          mdPath={articleMdPath}
          title={articleTitle}
          onDone={() => setScreen('write')}
          onBack={() => setScreen('review')}
        />
      )}

      {showSettings && (
        <div className="settings-overlay">
          <div className="settings-overlay__backdrop" onClick={() => setShowSettings(false)} />
          <div className="settings-overlay__panel">
            <SettingsScreen onBack={() => setShowSettings(false)} />
          </div>
        </div>
      )}

      {showEdgeModal && (
        <EdgeSetupModal onReady={handleEdgeReady} onClose={() => setShowEdgeModal(false)} />
      )}

      <ToastViewport />
    </div>
  )
}
