import { execFile } from 'node:child_process'
import http from 'node:http'

const CDP_PORT = 9222

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

export async function launchEdge(): Promise<{ success: boolean; error?: string }> {
  if (await isEdgeDebugging()) {
    return { success: true }
  }

  const edgePath = await findEdgePath()
  if (!edgePath) {
    return { success: false, error: 'Edge 未安装，请先安装 Microsoft Edge' }
  }

  return new Promise((resolve) => {
    execFile(edgePath, [`--remote-debugging-port=${CDP_PORT}`], (err) => {
      if (err && !err.message.includes('ENOENT')) {
        // Edge 进程启动后会立即返回
      }
    })

    setTimeout(async () => {
      const ok = await isEdgeDebugging()
      if (ok) {
        resolve({ success: true })
      } else {
        resolve({ success: false, error: 'Edge 启动超时，请手动启动 Edge 后重试' })
      }
    }, 2000)
  })
}
