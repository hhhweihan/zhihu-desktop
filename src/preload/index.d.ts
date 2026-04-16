import { ElectronAPI } from '@electron-toolkit/preload'

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
      getZhihuLoginState: () => Promise<ZhihuLoginState>
      getAppUpdateState: () => Promise<AppUpdateState>
      checkForAppUpdates: () => Promise<AppUpdateState>
      downloadAppUpdate: () => Promise<AppUpdateState>
      installAppUpdate: () => Promise<void>
      suggestArticlePlans: (topic: string) => Promise<ArticlePlan[]>
      generateArticle: (topic: string, plan?: ArticlePlan) => Promise<{ title: string; mdPath: string }>
      cancelGenerate: () => Promise<void>
      reviewArticle: (mdPath: string) => Promise<ReviewReport>
      publishArticle: (mdPath: string, autoSubmit: boolean) => Promise<{ status: string }>
      readFile: (filePath: string) => Promise<string>
      writeFile: (filePath: string, content: string) => Promise<void>
      deleteFile: (filePath: string) => Promise<void>
      onGenerateChunk: (cb: (chunk: string) => void) => () => void
      onScriptLog: (cb: (msg: string) => void) => () => void
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
}
