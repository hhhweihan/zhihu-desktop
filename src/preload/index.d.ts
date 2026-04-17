import { ElectronAPI } from '@electron-toolkit/preload'
import type { TaskEvent } from '../shared/task-events'
import type { CoverGenerationResult, CoverTemplate } from '../main/services/article-cover'

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    electronAPI: {
      saveApiKey: (key: string) => Promise<void>
      loadApiKey: () => Promise<string | null>
      clearApiKey: () => Promise<void>
      saveConfig: (config: unknown) => Promise<void>
      loadConfig: () => Promise<{ provider: string; model: string; baseUrl: string; outputDir: string }>
      clearConfig: () => Promise<void>
      getDefaultOutputDir: () => Promise<string>
      chooseDirectory: (defaultPath?: string) => Promise<string | null>
      checkEdge: () => Promise<boolean>
      launchEdge: () => Promise<{ success: boolean; error?: string }>
      killEdgeAndRelaunch: () => Promise<{ success: boolean; error?: string }>
      getZhihuLoginState: () => Promise<ZhihuLoginState>
      getAppUpdateState: () => Promise<AppUpdateState>
      checkForAppUpdates: () => Promise<AppUpdateState>
      downloadAppUpdate: () => Promise<AppUpdateState>
      installAppUpdate: () => Promise<void>
      suggestArticlePlans: (topic: string) => Promise<ArticlePlan[]>
      generateArticle: (topic: string, plan?: ArticlePlan, revisionBrief?: string) => Promise<{ title: string; mdPath: string }>
      cancelGenerate: () => Promise<void>
      reviewArticle: (mdPath: string) => Promise<ReviewReport>
      generateArticleCover: (payload: { mdPath: string; template: CoverTemplate; title?: string; subtitle?: string }) => Promise<CoverGenerationResult>
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
