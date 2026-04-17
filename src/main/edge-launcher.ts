import { spawn, exec } from 'node:child_process'
import http from 'node:http'
import { promisify } from 'node:util'
import { CDP_PORT, ZHIHU_URLS } from './constants'
const EDGE_STARTUP_TIMEOUT_MS = 12000
const EDGE_POLL_INTERVAL_MS = 500
const EDGE_DEBUG_REQUEST_TIMEOUT_MS = 1500

const execAsync = promisify(exec)

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
    req.setTimeout(EDGE_DEBUG_REQUEST_TIMEOUT_MS, () => {
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

export async function killEdgeProcesses(): Promise<void> {
  try {
    if (process.platform === 'darwin') {
      await execAsync('pkill -f "Microsoft Edge"')
    } else {
      await execAsync('taskkill /IM msedge.exe /F')
    }
  } catch {
    // Process may already be gone — not an error
  }
}

async function waitForPortClosed(timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const open = await isEdgeDebugging()
    if (!open) return true
    await new Promise((resolve) => setTimeout(resolve, EDGE_POLL_INTERVAL_MS))
  }
  return false
}

export async function restartEdge(): Promise<{ success: boolean; error?: string }> {
  await killEdgeProcesses()
  await waitForPortClosed(5000)
  return launchEdge()
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

async function isEdgeProcessRunning(): Promise<boolean> {
  try {
    const { stdout } = await execAsync(
      process.platform === 'darwin' ? 'pgrep -x "Microsoft Edge"' : 'tasklist /FI "IMAGENAME eq msedge.exe" /NH',
    )
    return process.platform === 'darwin' ? stdout.trim().length > 0 : /msedge/i.test(stdout)
  } catch {
    return false
  }
}

export async function launchEdge(): Promise<{ success: boolean; error?: string }> {
  if (await isEdgeDebugging()) {
    return { success: true }
  }

  if (await isEdgeProcessRunning()) {
    await killEdgeProcesses()
    await waitForPortClosed(5000)
  }

  const edgePath = await findEdgePath()
  if (!edgePath) {
    return { success: false, error: 'Edge 未安装，请先安装 Microsoft Edge' }
  }

  return new Promise((resolve) => {
    let settled = false

    const child = spawn(edgePath, [`--remote-debugging-port=${CDP_PORT}`, '--new-window', ZHIHU_URLS.HOME], {
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
        error: 'Edge 启动超时，调试端口未就绪。可能是之前的 Edge 进程未完全关闭。请稍后重试。',
      })
    })
  })
}
