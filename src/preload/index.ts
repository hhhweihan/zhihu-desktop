import { contextBridge, ipcRenderer } from 'electron'
import type { AppUpdateState } from '../main/services/app-updater'

contextBridge.exposeInMainWorld('electronAPI', {
  // API Key
  saveApiKey: (key: string) => ipcRenderer.invoke('api-key:save', key),
  loadApiKey: () => ipcRenderer.invoke('api-key:load'),
  clearApiKey: () => ipcRenderer.invoke('api-key:clear'),

  // AI Config
  saveConfig: (config: unknown) => ipcRenderer.invoke('config:save', config),
  loadConfig: () => ipcRenderer.invoke('config:load'),
  clearConfig: () => ipcRenderer.invoke('config:clear'),
  getDefaultOutputDir: () => ipcRenderer.invoke('path:default-output'),
  chooseDirectory: (defaultPath?: string) => ipcRenderer.invoke('directory:choose', defaultPath),

  // Edge
  checkEdge: () => ipcRenderer.invoke('edge:check'),
  launchEdge: () => ipcRenderer.invoke('edge:launch'),

  // App Update
  getAppUpdateState: () => ipcRenderer.invoke('app-update:get-state'),
  checkForAppUpdates: () => ipcRenderer.invoke('app-update:check'),
  downloadAppUpdate: () => ipcRenderer.invoke('app-update:download'),
  installAppUpdate: () => ipcRenderer.invoke('app-update:install'),

  // Article
  generateArticle: (topic: string) => ipcRenderer.invoke('article:generate', topic),
  cancelGenerate: () => ipcRenderer.invoke('article:cancel'),
  reviewArticle: (mdPath: string) => ipcRenderer.invoke('article:review', mdPath),
  publishArticle: (mdPath: string, autoSubmit: boolean) =>
    ipcRenderer.invoke('article:publish', mdPath, autoSubmit),
  readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('file:write', filePath, content),
  deleteFile: (filePath: string) => ipcRenderer.invoke('file:delete', filePath),

  // 流式事件
  onGenerateChunk: (cb: (chunk: string) => void) => {
    const handler = (_: unknown, chunk: string) => cb(chunk)
    ipcRenderer.on('generate:chunk', handler)
    return () => ipcRenderer.removeListener('generate:chunk', handler)
  },
  onScriptLog: (cb: (msg: string) => void) => {
    const handler = (_: unknown, msg: string) => cb(msg)
    ipcRenderer.on('script:log', handler)
    return () => ipcRenderer.removeListener('script:log', handler)
  },
  onAppUpdateState: (cb: (state: AppUpdateState) => void) => {
    const handler = (_: unknown, state: AppUpdateState) => cb(state)
    ipcRenderer.on('app-update:state', handler)
    return () => ipcRenderer.removeListener('app-update:state', handler)
  },
})
