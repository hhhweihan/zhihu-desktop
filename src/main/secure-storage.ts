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
}

const DEFAULT_CONFIG: AIConfig = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
  baseUrl: ''
}

export function saveConfig(config: AIConfig): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

export function loadConfig(): AIConfig {
  if (!fs.existsSync(CONFIG_PATH)) return DEFAULT_CONFIG
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) }
  } catch {
    return DEFAULT_CONFIG
  }
}

export function clearConfig(): void {
  if (fs.existsSync(CONFIG_PATH)) fs.unlinkSync(CONFIG_PATH)
}
