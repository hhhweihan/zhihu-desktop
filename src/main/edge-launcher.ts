import { spawn } from 'node:child_process'
import http from 'node:http'

const CDP_PORT = 9222
const ZHIHU_ENTRY_URL = 'https://www.zhihu.com/'
const EDGE_STARTUP_TIMEOUT_MS = 12000
const EDGE_POLL_INTERVAL_MS = 500

const EDGE_PATHS_WIN = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
]

const EDGE_PATHS_MAC = [
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
]

function getEdgePaths(): string[] {
  return process.platform === 'darwin' ? EDGE_PATHS_MAC : EDGE_PATHS_WIN
}

export async function isEdgeDebugging(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${CDP_PORT}/json/version`, (res) => {
      resolve(res.statusCode === 200)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(1500, () => {
      req.destroy()
      resolve(false)
    })
  })
}

export async function findEdgePath(): Promise<string | null> {
  const { existsSync } = await import('node:fs')
  for (const p of getEdgePaths()) {
    if (existsSync(p)) return p
  }
  return null
}

async function waitForEdgeDebugging(timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (await isEdgeDebugging()) {
      return true
    }

    await new Promise((resolve) => setTimeout(resolve, EDGE_POLL_INTERVAL_MS))
  }

  return false
}

export async function launchEdge(): Promise<{ success: boolean; error?: string }> {
  if (await isEdgeDebugging()) {
    return { success: true }
  }

  const edgePath = await findEdgePath()
  if (!edgePath) {
    return { success: false, error: 'Edge 未安装，请先安装 Microsoft Edge' }
  }

  return new Promise((resolve) => {
    let settled = false

    const child = spawn(edgePath, [`--remote-debugging-port=${CDP_PORT}`, '--new-window', ZHIHU_ENTRY_URL], {
      detached: true,
      stdio: 'ignore',
    })

    child.on('error', (error) => {
      if (settled) {
        return
      }

      settled = true
      resolve({ success: false, error: `Edge 启动失败：${error.message}` })
    })

    child.unref()

    void waitForEdgeDebugging(EDGE_STARTUP_TIMEOUT_MS).then((ok) => {
      if (settled) {
        return
      }

      settled = true
      if (ok) {
        resolve({ success: true })
        return
      }

      resolve({
        success: false,
        error: 'Edge 已尝试启动，但调试端口未就绪。请先关闭已有 Edge 窗口后重试，或手动打开 Edge 再重试。',
      })
    })
  })
}
