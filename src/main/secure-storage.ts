import { safeStorage, app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

const STORAGE_PATH = path.join(app.getPath('userData'), 'secure.dat')
const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json')

export function saveApiKey(key: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('系统加密不可用')
  }
  const encrypted = safeStorage.encryptString(key)
  fs.writeFileSync(STORAGE_PATH, encrypted)
}

export function loadApiKey(): string | null {
  if (!fs.existsSync(STORAGE_PATH)) return null
  try {
    const encrypted = fs.readFileSync(STORAGE_PATH)
    return safeStorage.decryptString(encrypted)
  } catch {
    return null
  }
}

export function clearApiKey(): void {
  if (fs.existsSync(STORAGE_PATH)) {
    fs.unlinkSync(STORAGE_PATH)
  }
}

export interface AIConfig {
  provider: 'anthropic' | 'letai' | 'custom'
  model: string
  baseUrl: string
  outputDir: string
}

function createDefaultConfig(): AIConfig {
  return {
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    baseUrl: '',
    outputDir: getDefaultOutputDir(),
  }
}

export function getDefaultOutputDir(): string {
  const baseDir = app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath()
  return path.join(baseDir, 'articles')
}

export function saveConfig(config: AIConfig): void {
  const nextConfig: AIConfig = {
    ...createDefaultConfig(),
    ...config,
    outputDir: config.outputDir?.trim() || getDefaultOutputDir(),
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(nextConfig, null, 2), 'utf-8')
}

export function loadConfig(): AIConfig {
  const defaultConfig = createDefaultConfig()
  if (!fs.existsSync(CONFIG_PATH)) return defaultConfig
  try {
    return { ...defaultConfig, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) }
  } catch {
    return defaultConfig
  }
}

export function clearConfig(): void {
  if (fs.existsSync(CONFIG_PATH)) fs.unlinkSync(CONFIG_PATH)
}
