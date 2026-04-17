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
const MAX_HISTORY_ITEMS = 50

function loadHistory(): ArticleHistory[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') } catch { return [] }
}

function saveHistory(items: ArticleHistory[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY_ITEMS)))
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('onboarding')
  const [articleMdPath, setArticleMdPath] = useState('')
  const [articleTitle, setArticleTitle] = useState('')
  const [articleTopic, setArticleTopic] = useState('')
  const [history, setHistory] = useState<ArticleHistory[]>([])
  const [showEdgeModal, setShowEdgeModal] = useState(false)
  const [pendingPublish, setPendingPublish] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    let disposed = false

    async function reconcileStoredHistory() {
      const storedHistory = loadHistory()
      const availableHistory = (
        await Promise.all(
          storedHistory.map(async (item) => ((await window.electronAPI.fileExists(item.mdPath)) ? item : null)),
        )
      ).filter((item): item is ArticleHistory => item !== null)

      if (availableHistory.length !== storedHistory.length) {
        saveHistory(availableHistory)
      }

      if (!disposed) {
        setHistory(availableHistory)
      }
    }

    setHistory(loadHistory())
    void reconcileStoredHistory()

    window.electronAPI.loadApiKey().then((key) => {
      if (key) setScreen('write')
    })

    return () => {
      disposed = true
    }
  }, [])

  useEffect(() => {
    if (screen !== 'write') {
      return
    }

    let disposed = false

    async function reconcileStoredHistory() {
      const storedHistory = loadHistory()
      const availableHistory = (
        await Promise.all(
          storedHistory.map(async (item) => ((await window.electronAPI.fileExists(item.mdPath)) ? item : null)),
        )
      ).filter((item): item is ArticleHistory => item !== null)

      if (availableHistory.length !== storedHistory.length) {
        saveHistory(availableHistory)
      }

      if (!disposed) {
        setHistory(availableHistory)
      }
    }

    const handleFocus = () => {
      void reconcileStoredHistory()
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void reconcileStoredHistory()
      }
    }

    void reconcileStoredHistory()
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      disposed = true
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [screen])

  function handleArticleReady(mdPath: string, title: string, topic = '') {
    setArticleMdPath(mdPath)
    setArticleTitle(title)
    setArticleTopic(topic)
    const entry: ArticleHistory = { id: Date.now().toString(), title, topic, mdPath, createdAt: Date.now() }
    setHistory((prev) => {
      const nextHistory = [entry, ...prev.filter((item) => item.mdPath !== mdPath)]
      saveHistory(nextHistory)
      return nextHistory.slice(0, MAX_HISTORY_ITEMS)
    })
    setScreen('review')
  }

  function handleDeleteHistory(id: string) {
    setHistory((prev) => {
      const nextHistory = prev.filter((item) => item.id !== id)
      saveHistory(nextHistory)
      return nextHistory
    })
  }

  function handleCredentialsCleared() {
    setArticleMdPath('')
    setArticleTitle('')
    setArticleTopic('')
    setPendingPublish(false)
    setShowSettings(false)
    setScreen('onboarding')
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
      {screen === 'write' && (
        <WriteScreen
          history={history}
          onArticleReady={handleArticleReady}
          onDeleteHistory={handleDeleteHistory}
        />
      )}
      {screen === 'review' && (
        <ReviewScreen
          mdPath={articleMdPath}
          title={articleTitle}
          topic={articleTopic}
          onPublish={handleGoPublish}
          onArticleReady={handleArticleReady}
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
            <SettingsScreen
              onBack={() => setShowSettings(false)}
              onCredentialsCleared={handleCredentialsCleared}
            />
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
