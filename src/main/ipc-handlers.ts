import { ipcMain, BrowserWindow, dialog } from 'electron'
import { saveApiKey, loadApiKey, clearApiKey, saveConfig, loadConfig, clearConfig, AIConfig, getDefaultOutputDir } from './secure-storage'
import { isEdgeDebugging, launchEdge } from './edge-launcher'
import { startArticleGeneration } from './services/article-generation'
import { reviewArticle } from './services/article-review'
import { publishArticle } from './services/article-publish'
import { checkForAppUpdates, downloadAppUpdate, getAppUpdateState, quitAndInstallAppUpdate } from './services/app-updater'
import path from 'node:path'
import fs from 'node:fs'

let currentGenerateAbort: (() => void) | null = null

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  // ── API Key ──────────────────────────────────────────────
  ipcMain.handle('api-key:save', (_, key: string) => saveApiKey(key))
  ipcMain.handle('api-key:load', () => loadApiKey())
  ipcMain.handle('api-key:clear', () => clearApiKey())
  ipcMain.handle('config:clear', () => clearConfig())

  // ── AI Config ─────────────────────────────────────────────
  ipcMain.handle('config:save', (_, config: AIConfig) => saveConfig(config))
  ipcMain.handle('config:load', () => loadConfig())
  ipcMain.handle('path:default-output', () => getDefaultOutputDir())
  ipcMain.handle('directory:choose', async (_, defaultPath?: string) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择文章保存目录',
      defaultPath: defaultPath || getDefaultOutputDir(),
      properties: ['openDirectory', 'createDirectory'],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0]
  })

  // ── Edge ──────────────────────────────────────────────────
  ipcMain.handle('edge:check', () => isEdgeDebugging())
  ipcMain.handle('edge:launch', () => launchEdge())

  // ── App Update ────────────────────────────────────────────
  ipcMain.handle('app-update:get-state', () => getAppUpdateState())
  ipcMain.handle('app-update:check', () => checkForAppUpdates())
  ipcMain.handle('app-update:download', () => downloadAppUpdate())
  ipcMain.handle('app-update:install', () => {
    quitAndInstallAppUpdate()
  })

  // ── Generate Article ──────────────────────────────────────
  ipcMain.handle('article:generate', async (_, topic: string) => {
    const apiKey = loadApiKey()
    if (!apiKey) throw new Error('API Key 未设置')

    const config = loadConfig()
    const outputDir = config.outputDir || getDefaultOutputDir()

    const runningGeneration = startArticleGeneration({
      topic,
      apiKey,
      outputDir,
      model: config.model,
      baseUrl: config.baseUrl,
      onLog: (line) => mainWindow.webContents.send('script:log', line),
    })

    currentGenerateAbort = runningGeneration.abort

    try {
      return await runningGeneration.promise
    } finally {
      currentGenerateAbort = null
    }
  })

  // ── Review Article ────────────────────────────────────────
  ipcMain.handle('article:review', async (_, mdPath: string) => {
    const apiKey = loadApiKey()
    if (!apiKey) throw new Error('API Key 未设置')

    const config = loadConfig()

    return reviewArticle({
      filePath: mdPath,
      apiKey,
      baseUrl: config.baseUrl,
      onLog: (line) => mainWindow.webContents.send('script:log', line),
    })
  })

  // ── Publish Article ───────────────────────────────────────
  ipcMain.handle('article:publish', async (_, mdPath: string, autoSubmit: boolean) => {
    return publishArticle({
      markdownPath: mdPath,
      autoSubmit,
      onLog: (line) => mainWindow.webContents.send('script:log', line),
    })
  })

  // ── Cancel Generate ───────────────────────────────────────
  ipcMain.handle('article:cancel', () => {
    if (currentGenerateAbort) {
      currentGenerateAbort()
      currentGenerateAbort = null
    }
  })

  // ── Read File ─────────────────────────────────────────────
  ipcMain.handle('file:read', (_, filePath: string) => {
    return fs.readFileSync(filePath, 'utf-8')
  })
  ipcMain.handle('file:write', (_, filePath: string, content: string) => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, content, 'utf-8')
  })
  ipcMain.handle('file:delete', (_, filePath: string) => {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  })
}
