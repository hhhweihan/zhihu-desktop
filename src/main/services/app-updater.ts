import { app, BrowserWindow } from 'electron'
import { autoUpdater, type ProgressInfo, type UpdateDownloadedEvent, type UpdateInfo } from 'electron-updater'

export type AppUpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'up-to-date'
  | 'error'
  | 'unsupported'

export interface AppUpdateState {
  status: AppUpdateStatus
  currentVersion: string
  availableVersion: string | null
  progress: number | null
  message: string
}

let isInitialized = false
let mainWindowRef: BrowserWindow | null = null
let updateState: AppUpdateState = createState({
  status: app.isPackaged ? 'idle' : 'unsupported',
  message: app.isPackaged ? '可检查新版本' : '当前环境不支持自动更新',
})

function createState(overrides: Partial<AppUpdateState>): AppUpdateState {
  return {
    status: 'idle',
    currentVersion: app.getVersion(),
    availableVersion: null,
    progress: null,
    message: '',
    ...overrides,
  }
}

function emitState(overrides: Partial<AppUpdateState>): AppUpdateState {
  updateState = createState({
    ...updateState,
    ...overrides,
    currentVersion: app.getVersion(),
  })
  mainWindowRef?.webContents.send('app-update:state', updateState)
  return updateState
}

function resolveVersion(info?: UpdateInfo | UpdateDownloadedEvent | null): string | null {
  return info?.version ?? null
}

function handleUpdateAvailable(info: UpdateInfo): void {
  emitState({
    status: 'available',
    availableVersion: resolveVersion(info),
    progress: null,
    message: `发现新版本 ${info.version}`,
  })
}

function handleUpdateDownloaded(info: UpdateDownloadedEvent): void {
  emitState({
    status: 'downloaded',
    availableVersion: resolveVersion(info),
    progress: 100,
    message: `新版本 ${info.version} 已下载完成，可立即安装`,
  })
}

function handleDownloadProgress(progress: ProgressInfo): void {
  emitState({
    status: 'downloading',
    progress: Math.max(0, Math.min(100, Math.round(progress.percent))),
    message: `正在下载更新 ${Math.round(progress.percent)}%`,
  })
}

export function initializeAppUpdater(mainWindow: BrowserWindow): void {
  mainWindowRef = mainWindow

  if (isInitialized) {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.send('app-update:state', updateState)
    })
    return
  }

  isInitialized = true

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  if (!app.isPackaged) {
    updateState = createState({
      status: 'unsupported',
      message: '开发环境不支持自动更新，请使用打包后的安装包测试',
    })
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.send('app-update:state', updateState)
    })
    return
  }

  autoUpdater.on('checking-for-update', () => {
    emitState({
      status: 'checking',
      progress: null,
      message: '正在检查更新',
    })
  })

  autoUpdater.on('update-available', (info) => {
    handleUpdateAvailable(info)
  })

  autoUpdater.on('update-not-available', () => {
    emitState({
      status: 'up-to-date',
      availableVersion: null,
      progress: null,
      message: '当前已经是最新版本',
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    handleDownloadProgress(progress)
  })

  autoUpdater.on('update-downloaded', (info) => {
    handleUpdateDownloaded(info)
  })

  autoUpdater.on('error', (error) => {
    emitState({
      status: 'error',
      progress: null,
      message: error?.message || '自动更新失败',
    })
  })

  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.webContents.send('app-update:state', updateState)
  })
}

export function getAppUpdateState(): AppUpdateState {
  return updateState
}

export async function checkForAppUpdates(): Promise<AppUpdateState> {
  if (!app.isPackaged) {
    return emitState({
      status: 'unsupported',
      progress: null,
      message: '开发环境不支持自动更新，请使用打包后的安装包测试',
    })
  }

  if (updateState.status === 'checking' || updateState.status === 'downloading') {
    return updateState
  }

  await autoUpdater.checkForUpdates()
  return updateState
}

export async function downloadAppUpdate(): Promise<AppUpdateState> {
  if (!app.isPackaged) {
    return emitState({
      status: 'unsupported',
      progress: null,
      message: '开发环境不支持自动更新，请使用打包后的安装包测试',
    })
  }

  if (updateState.status === 'downloaded' || updateState.status === 'downloading') {
    return updateState
  }

  if (updateState.status !== 'available') {
    throw new Error('当前没有可下载的更新')
  }

  await autoUpdater.downloadUpdate()
  return updateState
}

export function quitAndInstallAppUpdate(): void {
  if (updateState.status !== 'downloaded') {
    throw new Error('更新尚未下载完成')
  }

  autoUpdater.quitAndInstall()
}