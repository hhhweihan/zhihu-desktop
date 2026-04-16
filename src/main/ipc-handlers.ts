import { ipcMain, BrowserWindow, dialog } from 'electron'
import { saveApiKey, loadApiKey, clearApiKey, saveConfig, loadConfig, clearConfig, AIConfig, getDefaultOutputDir } from './secure-storage'
import { isEdgeDebugging, launchEdge } from './edge-launcher'
import { startArticleGeneration, suggestArticlePlans, type ArticlePlan } from './services/article-generation'
import { reviewArticle } from './services/article-review'
import { publishArticle, getZhihuLoginState } from './services/article-publish'
import { generateArticleCover, type CoverTemplate } from './services/article-cover'
import { checkForAppUpdates, downloadAppUpdate, getAppUpdateState, quitAndInstallAppUpdate } from './services/app-updater'
import { createTaskReporter, isTaskCancelledError, type TaskReporter } from './services/task-runtime'
import path from 'node:path'
import fs from 'node:fs'
import type { TaskEvent, TaskKind } from '../shared/task-events'

let currentGenerateAbort: (() => void) | null = null

function emitTaskEvent(mainWindow: BrowserWindow, event: TaskEvent): void {
  mainWindow.webContents.send('task:event', event)
}

function createReporter(mainWindow: BrowserWindow, task: TaskKind): TaskReporter {
  return createTaskReporter(task, (event) => emitTaskEvent(mainWindow, event))
}

async function runTaskWithReporter<T>(reporter: TaskReporter, executor: () => Promise<T>): Promise<T> {
  reporter.queued()
  reporter.running()

  try {
    const result = await executor()
    reporter.success()
    return result
  } catch (error) {
    const normalized = isTaskCancelledError(error)
      ? reporter.cancel(error)
      : reporter.fail(error)
    throw new Error(normalized.userMessage)
  }
}

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
  ipcMain.handle('edge:zhihu-login-state', () => getZhihuLoginState())

  // ── App Update ────────────────────────────────────────────
  ipcMain.handle('app-update:get-state', () => getAppUpdateState())
  ipcMain.handle('app-update:check', () => checkForAppUpdates())
  ipcMain.handle('app-update:download', () => downloadAppUpdate())
  ipcMain.handle('app-update:install', () => {
    quitAndInstallAppUpdate()
  })

  // ── Generate Article ──────────────────────────────────────
  ipcMain.handle('article:suggest-plans', async (_, topic: string) => {
    const apiKey = loadApiKey()
    if (!apiKey) throw new Error('API Key 未设置')

    const config = loadConfig()

    return suggestArticlePlans({
      topic,
      apiKey,
      model: config.model,
      baseUrl: config.baseUrl,
    })
  })

  ipcMain.handle('article:generate', async (_, topic: string, plan?: ArticlePlan) => {
    const reporter = createReporter(mainWindow, 'generate')
    return runTaskWithReporter(reporter, async () => {
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
        plan,
        reporter,
      })

      currentGenerateAbort = runningGeneration.abort

      try {
        return await runningGeneration.promise
      } finally {
        currentGenerateAbort = null
      }
    })
  })

  // ── Review Article ────────────────────────────────────────
  ipcMain.handle('article:review', async (_, mdPath: string) => {
    const reporter = createReporter(mainWindow, 'review')
    return runTaskWithReporter(reporter, async () => {
      const apiKey = loadApiKey()
      if (!apiKey) throw new Error('API Key 未设置')

      const config = loadConfig()

      return reviewArticle({
        filePath: mdPath,
        apiKey,
        baseUrl: config.baseUrl,
        reporter,
      })
    })
  })

  ipcMain.handle('article:generate-cover', async (_, payload: {
    mdPath: string
    template: CoverTemplate
    title?: string
    subtitle?: string
  }) => {
    const reporter = createReporter(mainWindow, 'cover')
    return runTaskWithReporter(reporter, async () => {
      return generateArticleCover({
        markdownPath: payload.mdPath,
        template: payload.template,
        title: payload.title,
        subtitle: payload.subtitle,
        reporter,
      })
    })
  })

  // ── Publish Article ───────────────────────────────────────
  ipcMain.handle('article:publish', async (_, mdPath: string, autoSubmit: boolean) => {
    const reporter = createReporter(mainWindow, 'publish')
    return runTaskWithReporter(reporter, async () => {
      return publishArticle({
        markdownPath: mdPath,
        autoSubmit,
        reporter,
      })
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
  ipcMain.handle('file:exists', (_, filePath: string) => {
    return fs.existsSync(filePath)
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
