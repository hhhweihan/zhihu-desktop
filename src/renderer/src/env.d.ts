/// <reference types="vite/client" />

import type { TaskEvent } from '../../shared/task-events'

declare global {
interface AIConfig {
  provider: 'anthropic' | 'letai' | 'custom'
  model: string
  baseUrl: string
  outputDir: string
}

interface Window {
  electronAPI: {
    saveApiKey: (key: string) => Promise<void>
    loadApiKey: () => Promise<string | null>
    clearApiKey: () => Promise<void>
    saveConfig: (config: AIConfig) => Promise<void>
    loadConfig: () => Promise<AIConfig>
    clearConfig: () => Promise<void>
    getDefaultOutputDir: () => Promise<string>
    chooseDirectory: (defaultPath?: string) => Promise<string | null>
    checkEdge: () => Promise<boolean>
    launchEdge: () => Promise<{ success: boolean; error?: string }>
    getZhihuLoginState: () => Promise<ZhihuLoginState>
    getAppUpdateState: () => Promise<AppUpdateState>
    checkForAppUpdates: () => Promise<AppUpdateState>
    downloadAppUpdate: () => Promise<AppUpdateState>
    installAppUpdate: () => Promise<void>
    suggestArticlePlans: (topic: string) => Promise<ArticlePlan[]>
    generateArticle: (topic: string, plan?: ArticlePlan) => Promise<{ mdPath: string; title: string }>
    cancelGenerate: () => Promise<void>
    reviewArticle: (mdPath: string) => Promise<ReviewReport>
    generateArticleCover: (payload: {
      mdPath: string
      template: CoverTemplate
      title?: string
      subtitle?: string
    }) => Promise<CoverGenerationResult>
    publishArticle: (mdPath: string, autoSubmit: boolean) => Promise<{ status: string }>
    readFile: (filePath: string) => Promise<string>
    fileExists: (filePath: string) => Promise<boolean>
    writeFile: (filePath: string, content: string) => Promise<void>
    deleteFile: (filePath: string) => Promise<void>
    onGenerateChunk: (cb: (chunk: string) => void) => () => void
    onScriptLog: (cb: (msg: string) => void) => () => void
    onTaskEvent: (cb: (event: TaskEvent) => void) => () => void
    onAppUpdateState: (cb: (state: AppUpdateState) => void) => () => void
  }
}

type AppUpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'up-to-date'
  | 'error'
  | 'unsupported'

interface AppUpdateState {
  status: AppUpdateStatus
  currentVersion: string
  availableVersion: string | null
  progress: number | null
  message: string
}

interface ReviewReport {
  title: string
  overallScore: number
  issues: ReviewIssue[]
  summary: string
  readabilityScore: number
  authenticity: string
}

interface ReviewIssue {
  type: string
  severity: 'high' | 'medium' | 'low'
  location: string
  issue: string
  suggestion: string
}

interface ArticleHistory {
  id: string
  title: string
  topic?: string
  mdPath: string
  createdAt: number
  score?: number
}

interface ArticlePlan {
  title: string
  angle: string
  outline: string[]
}

interface ZhihuLoginState {
  edgeReady: boolean
  loggedIn: boolean
  displayName?: string
  currentUrl?: string
  reason?: string
}

type CoverTemplate = 'comparison' | 'minimalist' | 'feature'

interface CoverGenerationResult {
  title: string
  subtitle?: string
  template: CoverTemplate
  svgPath: string
  pngPath: string
  previewDataUrl: string
}
}

export {}
