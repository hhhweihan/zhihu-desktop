import { spawn } from 'node:child_process'
import path from 'node:path'
import { app } from 'electron'

function getBunPath(): string {
  if (app.isPackaged) {
    const ext = process.platform === 'win32' ? '.exe' : ''
    return path.join(process.resourcesPath, `bun${ext}`)
  }
  return 'bun'
}

function getScriptsDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'scripts')
  }
  return path.join(app.getAppPath(), '..', 'scripts')
}

export interface RunResult {
  stdout: string
  stderr: string
  exitCode: number
}

export function runScript(
  scriptName: string,
  args: string[],
  env: Record<string, string> = {},
  onStderr?: (line: string) => void
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(getScriptsDir(), scriptName)
    const proc = spawn(getBunPath(), ['run', scriptPath, ...args], {
      env: { ...process.env, ...env },
      cwd: getScriptsDir(),
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.stderr.on('data', (d: Buffer) => {
      const line = d.toString()
      stderr += line
      onStderr?.(line)
    })

    proc.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 0 })
    })

    proc.on('error', reject)
  })
}
