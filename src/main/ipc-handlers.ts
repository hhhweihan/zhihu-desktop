import { ipcMain, BrowserWindow } from 'electron'
import { saveApiKey, loadApiKey, clearApiKey, saveConfig, loadConfig, AIConfig } from './secure-storage'
import { isEdgeDebugging, launchEdge } from './edge-launcher'
import { runScript } from './bun-sidecar'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'

let currentGenerateAbort: (() => void) | null = null

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  // ── API Key ──────────────────────────────────────────────
  ipcMain.handle('api-key:save', (_, key: string) => saveApiKey(key))
  ipcMain.handle('api-key:load', () => loadApiKey())
  ipcMain.handle('api-key:clear', () => clearApiKey())

  // ── AI Config ─────────────────────────────────────────────
  ipcMain.handle('config:save', (_, config: AIConfig) => saveConfig(config))
  ipcMain.handle('config:load', () => loadConfig())

  // ── Edge ──────────────────────────────────────────────────
  ipcMain.handle('edge:check', () => isEdgeDebugging())
  ipcMain.handle('edge:launch', () => launchEdge())

  // ── Generate Article ──────────────────────────────────────
  ipcMain.handle('article:generate', async (_, topic: string) => {
    const apiKey = loadApiKey()
    if (!apiKey) throw new Error('API Key 未设置')

    const config = loadConfig()
    const outputDir = path.join(os.tmpdir(), 'zhihu-desktop', 'articles')

    const args = ['--topic', topic, '--api-key', apiKey, '--output-dir', outputDir, '--model', config.model]
    if (config.baseUrl) args.push('--base-url', config.baseUrl)

    currentGenerateAbort = null
    const result = await runScript(
      'generate-article.ts',
      args,
      {},
      (line) => mainWindow.webContents.send('script:log', line)
    )
    currentGenerateAbort = null

    if (result.exitCode !== 0) {
      throw new Error(`生成失败：${result.stderr.slice(-500)}`)
    }

    const resultMatch = result.stderr.match(/__RESULT__(.+)$/)
    if (!resultMatch) throw new Error('无法解析生成结果')
    return JSON.parse(resultMatch[1]) as { title: string; mdPath: string }
  })

  // ── Review Article ────────────────────────────────────────
  ipcMain.handle('article:review', async (_, mdPath: string) => {
    const apiKey = loadApiKey()
    if (!apiKey) throw new Error('API Key 未设置')

    const config = loadConfig()
    const env: Record<string, string> = { ANTHROPIC_API_KEY: apiKey }
    if (config.baseUrl) env['ANTHROPIC_BASE_URL'] = config.baseUrl

    const result = await runScript(
      'review-article.ts',
      [mdPath],
      env,
      (line) => mainWindow.webContents.send('script:log', line)
    )

    if (result.exitCode !== 0) {
      throw new Error(`审核失败：${result.stderr.slice(-500)}`)
    }

    return JSON.parse(result.stdout)
  })

  // ── Publish Article ───────────────────────────────────────
  ipcMain.handle('article:publish', async (_, mdPath: string, autoSubmit: boolean) => {
    const args = ['--markdown', mdPath]
    if (autoSubmit) args.push('--submit')

    const result = await runScript(
      'publish-article.ts',
      args,
      {},
      (line) => mainWindow.webContents.send('script:log', line)
    )

    if (result.exitCode !== 0) {
      throw new Error(`发布失败：${result.stderr.slice(-500)}`)
    }

    return { status: autoSubmit ? 'published' : 'filled' }
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
}
